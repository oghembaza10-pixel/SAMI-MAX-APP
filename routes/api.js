// ======================================================
// SAMII OS — API V5 — PostgreSQL + Universel (produit / rendez-vous)
// ======================================================
const express = require("express");
const router = express.Router();
const planner = require("../brain/planner");
const db = require("../services/db");

const METIERS_RDV = [
    "dentiste", "medecin", "avocat", "comptable", "coiffeur", "kine",
    "veterinaire", "notaire", "courtier", "immobilier", "garage",
    "lavage", "mecanicien", "esthetique", "tatoueur", "photographe",
    "formateur", "architecte", "agence", "service",
];

function typeParcours(metier) {
    const m = (metier || "").toLowerCase();
    return METIERS_RDV.includes(m) ? "rdv" : "produit";
}

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.status(401).json({ error: "Non connecté" });
    next();
}

function getMontant(c) {
    return parseFloat(c.montant || 0) || 0;
}

// ── CHAT SAMII ──────────────────────────────────────────
router.post("/chat", async (req, res) => {
    try {
        const message = req.body.message;
        if (!message) return res.json({ success: false, reply: "Écris un message." });
        const context = {
            user: { lang: req.body.lang || "" },
            workspaceId: req.session?.workspaceId || req.body.workspaceId || "",
            client: req.body.client || "",
            commande: req.body.commande || "",
            page: req.body.page || "",
            lastAction: req.body.lastAction || "",
        };
        const result = await planner.build({ goal: message }, context);
        res.json(result);
    } catch (err) {
        console.error("❌ API chat :", err.message);
        res.json({ success: false, reply: "SAMII démarre. Réessaie dans quelques instants." });
    }
});

router.post("/speak", async (req, res) => {
    try {
        const elevenlabs = require("../services/elevenlabs");
        const { text } = req.body;
        if (!elevenlabs.isEnabled()) return res.json({ success: false, fallback: true });
        const result = await elevenlabs.textToSpeech(text);
        res.json(result);
    } catch (err) {
        console.error("❌ POST /api/speak :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// ── CONNECTEURS (PostgreSQL) ─────────────────────────────
router.get("/connecteurs", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.status(403).json({ error: "Workspace introuvable." });
    try {
        const rows = await db.query(
            `SELECT * FROM connecteurs WHERE workspace_id = $1 ORDER BY created_at DESC`,
            [workspaceId]
        );

        const connecteurs = {};
        rows.forEach(r => {
            const type = (r.type || "").toLowerCase();
            const actif = r.actif === true;
            if (connecteurs[type] && connecteurs[type].actif && !actif) return;

            let config = {};
            try { config = r.config ? JSON.parse(r.config) : {}; } catch { config = {}; }

            connecteurs[type] = { actif, identifiant: config.chatId || "", ...config };
        });

        res.json({ success: true, connecteurs });
    } catch (err) {
        console.error("❌ API connecteurs :", err.message);
        res.status(500).json({ error: "Erreur chargement connecteurs." });
    }
});

// ── QG DATA — universel (produit ou rendez-vous selon métier) ──
router.get("/qg-data", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.status(403).json({ error: "Workspace introuvable." });

    try {
        const wsRows = await db.query(`SELECT * FROM workspaces WHERE id = $1`, [workspaceId]);
        const workspace = wsRows[0];
        if (!workspace) return res.status(404).json({ error: "Workspace introuvable." });

        const parcours = typeParcours(workspace.metier);

        if (parcours === "rdv") {
            return await buildRdvResponse(res, workspace, workspaceId);
        }
        return await buildProduitResponse(res, workspace, workspaceId);
    } catch (err) {
        console.error("❌ API qg-data :", err.message);
        res.status(500).json({ error: "Erreur chargement données." });
    }
});

// ── Réponse QG — métiers produit (e-commerce, restaurant...) ──
async function buildProduitResponse(res, workspace, workspaceId) {
    const commandesRows = await db.query(
        `SELECT * FROM commandes WHERE workspace_id = $1 ORDER BY date_commande DESC LIMIT 100`,
        [workspaceId]
    );
    const commandes = commandesRows.map(c => ({
        "ID Commande": c.id,
        "Nom Client": c.nom_client,
        "Téléphone": c.telephone,
        "Produit": c.produit,
        "montant": c.montant,
        "Devise": c.devise || "DZD",
        "Statut": c.statut,
        "Source": c.source,
        "Date Commande": c.date_commande,
        airtableId: c.id,
    }));

    const clientsRows = await db.query(
        `SELECT * FROM clients WHERE workspace_id = $1 ORDER BY total_depense DESC LIMIT 50`,
        [workspaceId]
    );
    const clients = clientsRows.map(c => ({
        "Nom": c.nom,
        "Téléphone": c.telephone,
        "Total Dépensé": c.total_depense,
        "VIP": c.statut === "vip",
        "Blacklist": c.statut === "blacklist",
    }));

    const total_commandes = commandes.length;
    const total_revenus = commandes.reduce((s, c) => s + getMontant(c), 0);
    const en_attente = commandes.filter(c => c.Statut === "en attente").length;
    const confirmees = commandes.filter(c => c.Statut === "confirmée").length;
    const annulees = commandes.filter(c => c.Statut === "annulée").length;
    const vip = clients.filter(c => c.VIP === true).length;
    const blacklist = clients.filter(c => c.Blacklist === true).length;

    const livrees = commandes.filter(c => c.Statut === "livrée").length;
    const en_cours = commandes.filter(c => c.Statut === "en cours").length;
    const echecs = commandes.filter(c => c.Statut === "échoué").length;

    const aujourd = new Date().toISOString().split("T")[0];
    const cmd_aujourd = commandes.filter(c => {
        const d = c["Date Commande"] ? new Date(c["Date Commande"]).toISOString().slice(0, 10) : "";
        return d === aujourd;
    });
    const rev_aujourd = cmd_aujourd.reduce((s, c) => s + getMontant(c), 0);

    const moisActuel = aujourd.slice(0, 7);
    const moisPrec = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
    const cmd_mois = commandes.filter(c => {
        const d = c["Date Commande"] ? new Date(c["Date Commande"]).toISOString().slice(0, 7) : "";
        return d === moisActuel;
    });
    const cmd_moisP = commandes.filter(c => {
        const d = c["Date Commande"] ? new Date(c["Date Commande"]).toISOString().slice(0, 7) : "";
        return d === moisPrec;
    });
    const rev_mois = cmd_mois.reduce((s, c) => s + getMontant(c), 0);
    const rev_moisP = cmd_moisP.reduce((s, c) => s + getMontant(c), 0);
    const evolution = rev_moisP > 0 ? (((rev_mois - rev_moisP) / rev_moisP) * 100).toFixed(1) + "%" : "—";

    res.json({
        success: true,
        parcours: "produit",
        workspace: { nom: workspace.nom || "", metier: workspace.metier || "" },
        stats: { total_commandes, total_revenus: total_revenus.toFixed(2), en_attente, confirmees, annulees, vip, blacklist },
        livraison: { livrees, en_cours, echecs },
        mission: { date: aujourd, commandes: cmd_aujourd.length, revenus: rev_aujourd.toFixed(2) },
        performance: { revenus_mois: rev_mois.toFixed(2), commandes_mois: cmd_mois.length, evolution },
        commandes,
        clients,
    });
}

// ── Réponse QG — métiers rendez-vous (dentiste, avocat...) ──
async function buildRdvResponse(res, workspace, workspaceId) {
    const rdvRows = await db.query(
        `SELECT * FROM rendez_vous WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [workspaceId]
    );

    const commandes = rdvRows.map(r => ({
        "ID Commande": r.id,
        "Nom Client": r.client_nom,
        "Téléphone": r.client_telephone,
        "Produit": r.motif,
        "DateRdv": r.date_rdv,
        "montant": 0,
        "Devise": workspace.devise || "DZD",
        "Statut": r.statut,
        "Source": r.source,
        "Date Commande": r.created_at,
        airtableId: r.id,
    }));

    const total_rdv = commandes.length;
    const en_attente = commandes.filter(c => c.Statut === "en_attente").length;
    const confirmees = commandes.filter(c => c.Statut === "confirmé").length;
    const annulees = commandes.filter(c => c.Statut === "annulé").length;

    const aujourd = new Date().toISOString().split("T")[0];
    const rdv_aujourd = commandes.filter(c => {
        const d = c["Date Commande"] ? new Date(c["Date Commande"]).toISOString().slice(0, 10) : "";
        return d === aujourd;
    });

    const moisActuel = aujourd.slice(0, 7);
    const moisPrec = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
    const rdv_mois = commandes.filter(c => {
        const d = c["Date Commande"] ? new Date(c["Date Commande"]).toISOString().slice(0, 7) : "";
        return d === moisActuel;
    });
    const rdv_moisP = commandes.filter(c => {
        const d = c["Date Commande"] ? new Date(c["Date Commande"]).toISOString().slice(0, 7) : "";
        return d === moisPrec;
    });
    const evolution = rdv_moisP.length > 0
        ? (((rdv_mois.length - rdv_moisP.length) / rdv_moisP.length) * 100).toFixed(1) + "%"
        : "—";

    res.json({
        success: true,
        parcours: "rdv",
        workspace: { nom: workspace.nom || "", metier: workspace.metier || "" },
        stats: {
            total_commandes: total_rdv, total_revenus: "0.00",
            en_attente, confirmees, annulees, vip: 0, blacklist: 0,
        },
        livraison: { livrees: 0, en_cours: 0, echecs: 0 },
        mission: { date: aujourd, commandes: rdv_aujourd.length, revenus: "0.00" },
        performance: { revenus_mois: "0.00", commandes_mois: rdv_mois.length, evolution },
        commandes,
        clients: [],
    });
}

// ── CONFIRMER (commande ou rendez-vous, détection automatique) ──
router.post("/commandes/:id/confirmer", requireAuth, async (req, res) => {
    try {
        const checkCmd = await db.query(
            `SELECT id FROM commandes WHERE id = $1 AND workspace_id = $2`,
            [req.params.id, req.session.workspaceId]
        );
        if (checkCmd.length) {
            await db.query(`UPDATE commandes SET statut = 'confirmée' WHERE id = $1`, [req.params.id]);
            return res.json({ success: true });
        }

        const checkRdv = await db.query(
            `SELECT id FROM rendez_vous WHERE id = $1 AND workspace_id = $2`,
            [req.params.id, req.session.workspaceId]
        );
        if (checkRdv.length) {
            await db.query(`UPDATE rendez_vous SET statut = 'confirmé' WHERE id = $1`, [req.params.id]);
            return res.json({ success: true });
        }

        res.status(403).json({ error: "Introuvable." });
    } catch (err) {
        console.error("❌ Confirmer :", err.message);
        res.status(500).json({ error: "Erreur confirmation." });
    }
});

// ── ANNULER (commande ou rendez-vous, détection automatique) ──
router.post("/commandes/:id/annuler", requireAuth, async (req, res) => {
    try {
        const checkCmd = await db.query(
            `SELECT id FROM commandes WHERE id = $1 AND workspace_id = $2`,
            [req.params.id, req.session.workspaceId]
        );
        if (checkCmd.length) {
            await db.query(`UPDATE commandes SET statut = 'annulée' WHERE id = $1`, [req.params.id]);
            return res.json({ success: true });
        }

        const checkRdv = await db.query(
            `SELECT id FROM rendez_vous WHERE id = $1 AND workspace_id = $2`,
            [req.params.id, req.session.workspaceId]
        );
        if (checkRdv.length) {
            await db.query(`UPDATE rendez_vous SET statut = 'annulé' WHERE id = $1`, [req.params.id]);
            return res.json({ success: true });
        }

        res.status(403).json({ error: "Introuvable." });
    } catch (err) {
        console.error("❌ Annuler :", err.message);
        res.status(500).json({ error: "Erreur annulation." });
    }
});

// ── FEEDBACK CLIENT ───────────────────────────────────────
router.post("/feedback", requireAuth, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) return res.json({ success: false, error: "Message vide." });

        await db.query(
            `INSERT INTO journal (action, details, workspace_id, user_id) VALUES ($1, $2, $3, $4)`,
            ["feedback", text.trim(), req.session.workspaceId || null, req.session.userId || null]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /api/feedback :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// ── DEBUG SESSION ─────────────────────────────────────────
router.get("/debug-session", requireAuth, (req, res) => {
    res.json({
        workspaceId: req.session.workspaceId,
        userId: req.session.userId,
        email: req.session.email,
    });
});

module.exports = router;
