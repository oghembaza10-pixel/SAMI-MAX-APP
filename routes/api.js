const express = require("express");
const router  = express.Router();
const planner = require("../brain/planner");
const axios   = require("axios");

const AIRTABLE_API_KEY  = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE_WORKSPACES  = process.env.TABLE_WORKSPACES  || "WORKSPACES";
const TABLE_CONNECTEURS = process.env.TABLE_CONNECTEURS || "CONNECTEURS";
const TABLE_COMMANDES   = process.env.TABLE_COMMANDES   || "COMMANDES";
const TABLE_CLIENTS     = process.env.TABLE_CLIENTS     || "CLIENTS";

const airtable = (table) =>
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`;

const headers = () => ({
    Authorization : `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
});

// ── HELPER — parse config JSON ────────────────────────
function parseConfig(config) {
    try { return JSON.parse(config || "{}"); } catch { return {}; }
}

// ── RÉPONSE VIDE SÉCURISÉE ────────────────────────────
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

// ── AUTH GUARD ────────────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.status(401).json({ error: "Non connecté" });
    next();
}

// ── CHAT SAMII ────────────────────────────────────────
router.post("/chat", async (req, res) => {
    try {
        const message = req.body.message;
        if (!message) return res.json({ success: false, reply: "Écris un message." });

        const context = {
            user        : { lang: req.body.lang || "" },
            workspaceId : req.session?.workspaceId || req.body.workspaceId || "",
            client      : req.body.client     || "",
            commande    : req.body.commande   || "",
            page        : req.body.page       || "",
            lastAction  : req.body.lastAction || "",
        };

        const result = await planner.build({ goal: message }, context);
        res.json(result);

    } catch (err) {
        console.error("❌ API chat :", err.message);
        res.json({ success: false, reply: "SAMII démarre. Réessaie dans quelques instants." });
    }
});

// ── CONNECTEURS — liste des connecteurs actifs ────────
router.get("/connecteurs", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;

    // ✅ SÉCURITÉ : workspaceId obligatoire
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
            const f      = rec.fields;
            const type   = (f.type || "").toLowerCase();
            const config = parseConfig(f.config);

            connecteurs[type] = {
                actif      : f.actif === true,
                identifiant: f.identifiant || "",
                ...config,
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

    // ✅ SÉCURITÉ : workspaceId obligatoire
    if (!workspaceId) return res.status(403).json({ error: "Workspace introuvable." });

    try {
        // ── Workspace ──
        const wsRes = await axios.get(airtable(TABLE_WORKSPACES), {
            headers: headers(),
            params : { filterByFormula: `{workspace_id}="${workspaceId}"`, maxRecords: 1 },
        });
        const workspace = wsRes.data.records[0]?.fields || {};

        // ── Connecteur Shopify — V1 : un seul connecteur Shopify actif par workspace ──
        const connRes = await axios.get(airtable(TABLE_CONNECTEURS), {
            headers: headers(),
            params : {
                filterByFormula: `AND({workspace_id}="${workspaceId}",{type}="shopify",{actif}=1)`,
                maxRecords     : 1,
            },
        });
        const shopifyConfig = parseConfig(connRes.data.records[0]?.fields?.config);
        const shop          = shopifyConfig.shop_url || "";

        // ✅ SÉCURITÉ : pas de shop = pas de données
        if (!shop) return res.json(emptyQgResponse(workspace));

        // ── Commandes ──
        const commandesRes = await axios.get(airtable(TABLE_COMMANDES), {
            headers: headers(),
            params : {
                filterByFormula     : `{Boutique}="${shop}"`,
                "sort[0][field]"    : "Date Commande",
                "sort[0][direction]": "desc",
                maxRecords          : 100,
            },
        });
        const commandes = commandesRes.data.records.map(r => r.fields);

        // ── Clients ──
        const clientsRes = await axios.get(airtable(TABLE_CLIENTS), {
            headers: headers(),
            params : {
                filterByFormula     : `{Boutique}="${shop}"`,
                "sort[0][field]"    : "Total Dépensé",
                "sort[0][direction]": "desc",
                maxRecords          : 50,
            },
        });
        const clients = clientsRes.data.records.map(r => r.fields);

        // ── Helper montant ──
        const getMontant = (c) => parseFloat(c.montant || c.Total || 0) || 0;

        // ── Stats globales ──
        const total_commandes = commandes.length;
        const total_revenus   = commandes.reduce((sum, c) => sum + getMontant(c), 0);
        const en_attente      = commandes.filter(c => c.Statut === "en attente").length;
        const confirmees      = commandes.filter(c => c.Statut === "confirmée").length;
        const annulees        = commandes.filter(c => c.Statut === "annulée").length;
        const vip             = clients.filter(c => c.VIP      === true).length;
        const blacklist       = clients.filter(c => c.Blacklist === true).length;

        // ── Livraison ──
        const livrees  = commandes.filter(c => c.Statut === "livrée").length;
        const en_cours = commandes.filter(c => c.Statut === "en cours").length;
        const echecs   = commandes.filter(c => c.Statut === "échoué").length;

        // ── Mission du jour ──
        const aujourd     = new Date().toISOString().split("T")[0];
        const cmd_aujourd = commandes.filter(c => (c["Date Commande"] || "").slice(0, 10) === aujourd);
        const rev_aujourd = cmd_aujourd.reduce((s, c) => s + getMontant(c), 0);

        // ── Performance du mois ──
        const moisActuel = aujourd.slice(0, 7);
        const moisPrec   = new Date(new Date().setMonth(new Date().getMonth() - 1))
                            .toISOString().slice(0, 7);
        const cmd_mois  = commandes.filter(c => (c["Date Commande"] || "").startsWith(moisActuel));
        const cmd_moisP = commandes.filter(c => (c["Date Commande"] || "").startsWith(moisPrec));
        const rev_mois  = cmd_mois.reduce((s, c)  => s + getMontant(c), 0);
        const rev_moisP = cmd_moisP.reduce((s, c) => s + getMontant(c), 0);
        const evolution = rev_moisP > 0
            ? ((rev_mois - rev_moisP) / rev_moisP * 100).toFixed(1) + "%"
            : "—";

        res.json({
            success  : true,
            workspace: { nom: workspace.nom || "", metier: workspace.metier || "" },
            stats    : { total_commandes, total_revenus: total_revenus.toFixed(2), en_attente, confirmees, annulees, vip, blacklist },
            livraison: { livrees, en_cours, echecs },
            mission  : { date: aujourd, commandes: cmd_aujourd.length, revenus: rev_aujourd.toFixed(2) },
            performance: { revenus_mois: rev_mois.toFixed(2), commandes_mois: cmd_mois.length, evolution },
            commandes,
            clients,
        });

    } catch (err) {
        console.error("❌ API qg-data :", err.response?.data || err.message);
        res.status(500).json({ error: "Erreur chargement données." });
    }
});
// ── DEBUG SESSION (à supprimer après test) ────────────
router.get("/debug-session", requireAuth, (req, res) => {
    res.json({
        workspaceId: req.session.workspaceId,
        userId     : req.session.userId,
        email      : req.session.email,
    });
});

module.exports = router;

