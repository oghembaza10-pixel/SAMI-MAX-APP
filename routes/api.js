// ======================================================
// SAMII OS — API V3
// ======================================================

const express          = require("express");
const router           = express.Router();
const planner          = require("../brain/planner");
const axios            = require("axios");
const workspaceService = require("../services/workspaceService");

const AIRTABLE_API_KEY  = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE_CONNECTEURS = process.env.TABLE_CONNECTEURS || "CONNECTEURS";
const TABLE_COMMANDES   = process.env.TABLE_COMMANDES   || "COMMANDES";
const TABLE_CLIENTS     = process.env.TABLE_CLIENTS     || "CLIENTS";

const airtable = (table) =>
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`;

const headers = () => ({
    Authorization : `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
});

// ── HELPERS ───────────────────────────────────────────
function parseConfig(config) {
    try {
        if (!config) return {};
        return JSON.parse(
            config
                .replace(/\\_/g, "_")
                .replace(/\\n/g, "")
                .replace(/\n/g,  "")
                .replace(/\r/g,  "")
                .trim()
        );
    } catch { return {}; }
}

function emptyQgResponse(workspace) {
    return {
        success    : true,
        workspace  : { nom: workspace?.nom || "", metier: workspace?.metier || "" },
        stats      : { total_commandes: 0, total_revenus: "0.00", en_attente: 0, confirmees: 0, annulees: 0, vip: 0, blacklist: 0 },
        livraison  : { livrees: 0, en_cours: 0, echecs: 0 },
        mission    : { date: new Date().toISOString().split("T")[0], commandes: 0, revenus: "0.00" },
        performance: { revenus_mois: "0.00", commandes_mois: 0, evolution: "—" },
        commandes  : [],
        clients    : [],
    };
}

function getMontant(c) {
    return parseFloat(c.montant || c.Total || 0) || 0;
}

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.status(401).json({ error: "Non connecté" });
    next();
}

// ── Vérifier qu'une commande appartient au workspace ──
async function verifyCommande(commandeId, workspaceId) {
    const verification = await axios.get(airtable(TABLE_COMMANDES), {
        headers: headers(),
        params : {
            filterByFormula: `AND(RECORD_ID()="${commandeId}",{workspace_id}="${workspaceId}")`,
            maxRecords     : 1,
        },
    });
    return verification.data.records.length > 0;
}

// ── CHAT SAMII ────────────────────────────────────────
router.post("/chat", async (req, res) => {
    try {
        const message = req.body.message;
        if (!message) return res.json({ success: false, reply: "Écris un message." });

        const context = {
            user       : { lang: req.body.lang || "" },
            workspaceId: req.session?.workspaceId || req.body.workspaceId || "",
            client     : req.body.client     || "",
            commande   : req.body.commande   || "",
            page       : req.body.page       || "",
            lastAction : req.body.lastAction || "",
        };

        const result = await planner.build({ goal: message }, context);
        res.json(result);

    } catch (err) {
        console.error("❌ API chat :", err.message);
        res.json({ success: false, reply: "SAMII démarre. Réessaie dans quelques instants." });
    }
});

// ── CONNECTEURS ───────────────────────────────────────
router.get("/connecteurs", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.status(403).json({ error: "Workspace introuvable." });

    try {
        const r = await axios.get(airtable(TABLE_CONNECTEURS), {
            headers: headers(),
            params : {
                filterByFormula: `{workspace_id}="${workspaceId}"`,
                maxRecords     : 50,
            },
        });

        const connecteurs = {};
        r.data.records.forEach(rec => {
            const f    = rec.fields;
            const type = (f.type || "").toLowerCase();
            connecteurs[type] = {
                actif      : f.actif === true,
                identifiant: f.identifiant || "",
                ...parseConfig(f.config),
            };
        });

        res.json({ success: true, connecteurs });

    } catch (err) {
        console.error("❌ API connecteurs :", err.message);
        res.status(500).json({ error: "Erreur chargement connecteurs." });
    }
});

// ── QG DATA ───────────────────────────────────────────
router.get("/qg-data", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.status(403).json({ error: "Workspace introuvable." });

    try {
        // ✅ workspaceService — source de vérité unique
        const workspace = await workspaceService.getById(workspaceId);
        if (!workspace) return res.status(404).json({ error: "Workspace introuvable." });

        // Commandes
        const commandesRes = await axios.get(airtable(TABLE_COMMANDES), {
            headers: headers(),
            params : {
                filterByFormula     : `{workspace_id}="${workspaceId}"`,
                "sort[0][field]"    : "Date Commande",
                "sort[0][direction]": "desc",
                maxRecords          : 100,
            },
        });
        const commandes = commandesRes.data.records.map(r => ({
            ...r.fields,
            airtableId: r.id,
        }));

        // Clients
        const clientsRes = await axios.get(airtable(TABLE_CLIENTS), {
            headers: headers(),
            params : {
                filterByFormula     : `{workspace_id}="${workspaceId}"`,
                "sort[0][field]"    : "Total Dépensé",
                "sort[0][direction]": "desc",
                maxRecords          : 50,
            },
        });
        const clients = clientsRes.data.records.map(r => r.fields);

        // Stats
        const total_commandes = commandes.length;
        const total_revenus   = commandes.reduce((s, c) => s + getMontant(c), 0);
        const en_attente      = commandes.filter(c => c.Statut === "en attente").length;
        const confirmees      = commandes.filter(c => c.Statut === "confirmée").length;
        const annulees        = commandes.filter(c => c.Statut === "annulée").length;
        const vip             = clients.filter(c => c.VIP      === true).length;
        const blacklist       = clients.filter(c => c.Blacklist === true).length;

        // Livraison
        const livrees  = commandes.filter(c => c.Statut === "livrée").length;
        const en_cours = commandes.filter(c => c.Statut === "en cours").length;
        const echecs   = commandes.filter(c => c.Statut === "échoué").length;

        // Mission du jour
        const aujourd     = new Date().toISOString().split("T")[0];
        const cmd_aujourd = commandes.filter(c => (c["Date Commande"] || "").slice(0, 10) === aujourd);
        const rev_aujourd = cmd_aujourd.reduce((s, c) => s + getMontant(c), 0);

        // Performance mensuelle
        const moisActuel = aujourd.slice(0, 7);
        const moisPrec   = new Date(new Date().setMonth(new Date().getMonth() - 1))
                            .toISOString().slice(0, 7);
        const cmd_mois   = commandes.filter(c => (c["Date Commande"] || "").startsWith(moisActuel));
        const cmd_moisP  = commandes.filter(c => (c["Date Commande"] || "").startsWith(moisPrec));
        const rev_mois   = cmd_mois.reduce((s, c)  => s + getMontant(c), 0);
        const rev_moisP  = cmd_moisP.reduce((s, c) => s + getMontant(c), 0);
        const evolution  = rev_moisP > 0
            ? ((rev_mois - rev_moisP) / rev_moisP * 100).toFixed(1) + "%"
            : "—";

        res.json({
            success    : true,
            workspace  : { nom: workspace.nom || "", metier: workspace.metier || "" },
            stats      : { total_commandes, total_revenus: total_revenus.toFixed(2), en_attente, confirmees, annulees, vip, blacklist },
            livraison  : { livrees, en_cours, echecs },
            mission    : { date: aujourd, commandes: cmd_aujourd.length, revenus: rev_aujourd.toFixed(2) },
            performance: { revenus_mois: rev_mois.toFixed(2), commandes_mois: cmd_mois.length, evolution },
            commandes,
            clients,
        });

    } catch (err) {
        console.error("❌ API qg-data :", err.response?.data || err.message);
        res.status(500).json({ error: "Erreur chargement données." });
    }
});

// ── CONFIRMER COMMANDE ────────────────────────────────
router.post("/commandes/:id/confirmer", requireAuth, async (req, res) => {
    try {
        // ✅ Vérifier ownership
        const ok = await verifyCommande(req.params.id, req.session.workspaceId);
        if (!ok) return res.status(403).json({ error: "Commande introuvable." });

        await axios.patch(
            `${airtable(TABLE_COMMANDES)}/${req.params.id}`,
            { fields: { "Statut": "confirmée" } },
            { headers: headers() }
        );
        res.json({ success: true });

    } catch (err) {
        console.error("❌ Confirmer :", err.message);
        res.status(500).json({ error: "Erreur confirmation." });
    }
});

// ── ANNULER COMMANDE ──────────────────────────────────
router.post("/commandes/:id/annuler", requireAuth, async (req, res) => {
    try {
        // ✅ Vérifier ownership
        const ok = await verifyCommande(req.params.id, req.session.workspaceId);
        if (!ok) return res.status(403).json({ error: "Commande introuvable." });

        await axios.patch(
            `${airtable(TABLE_COMMANDES)}/${req.params.id}`,
            { fields: { "Statut": "annulée" } },
            { headers: headers() }
        );
        res.json({ success: true });

    } catch (err) {
        console.error("❌ Annuler :", err.message);
        res.status(500).json({ error: "Erreur annulation." });
    }
});
// ── FEEDBACK CLIENT ───────────────────────────────────
router.post("/feedback", requireAuth, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) return res.json({ success: false, error: "Message vide." });

        const workspaceId = req.session.workspaceId;

        await axios.post(
            airtable(process.env.TABLE_JOURNAL || "JOURNAL"),
            {
                fields: {
                    type        : "feedback",
                    message     : text.trim(),
                    workspace_id: workspaceId || "",
                },
                typecast: true,
            },
            { headers: headers() }
        );

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /api/feedback :", err.response?.data || err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// ── DEBUG SESSION ─────────────────────────────────────
router.get("/debug-session", requireAuth, (req, res) => {
    res.json({
        workspaceId: req.session.workspaceId,
        userId     : req.session.userId,
        email      : req.session.email,
    });
});

module.exports = router;
