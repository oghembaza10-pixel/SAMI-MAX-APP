// ==========================================================================
// SAMII OS — API PUBLIQUE v1 (partenaires, n8n, Make, ERP...)
//
// Authentification par clé, pas par session : c'est ce qui permet à un
// système externe de nous appeler. Chaque clé est liée à UN espace de
// travail, et tout ce que la clé peut lire ou écrire est automatiquement
// borné à cet espace — un partenaire ne peut jamais atteindre les données
// d'un autre marchand, même en falsifiant un identifiant dans l'URL.
//
// Conventions volontairement classiques (Bearer token, JSON, verbes REST)
// pour que ça se branche dans n8n avec le nœud HTTP standard, sans nœud
// dédié ni SDK à installer.
// ==========================================================================
const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const db = require("../services/db");
const apiPartenaire = require("../services/apiPartenaire");
const metiers = require("../services/metiers");

// Limite par clé plutôt que par IP : plusieurs partenaires peuvent sortir
// de la même IP (un n8n auto-hébergé mutualisé), et une clé qui s'emballe
// ne doit pas pénaliser les autres.
const limiteur = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.headers.authorization || req.ip,
    message: { erreur: "Trop de requêtes. Limite : 120 par minute." },
});

async function authentifier(req, res, next) {
    const entete = req.headers.authorization || "";
    const cle = entete.startsWith("Bearer ") ? entete.slice(7).trim() : "";
    const workspaceId = await apiPartenaire.resoudreCle(cle);
    if (!workspaceId) {
        return res.status(401).json({
            erreur: "Clé API absente, invalide ou révoquée.",
            aide: "Envoyez l'en-tête : Authorization: Bearer sk_samii_…",
        });
    }
    req.workspaceId = workspaceId;
    next();
}

router.use(limiteur, express.json({ limit: "256kb" }), authentifier);

// ── IDENTITÉ ─────────────────────────────────────────────────────────────
// Premier appel que fait tout intégrateur pour valider sa clé.
router.get("/moi", async (req, res) => {
    try {
        const rows = await db.query(
            `SELECT id, nom, metier, pays, devise FROM workspaces WHERE id = $1`,
            [req.workspaceId],
        );
        if (!rows[0]) return res.status(404).json({ erreur: "Espace introuvable." });
        const w = rows[0];
        res.json({
            espace: {
                id: w.id,
                nom: w.nom,
                metier: w.metier,
                metierLabel: metiers.label(w.metier),
                parcours: metiers.estRdv(w.metier) ? "rendez-vous" : "commandes",
                pays: w.pays,
                devise: w.devise,
            },
        });
    } catch (err) {
        console.error("❌ API v1 /moi :", err.message);
        res.status(500).json({ erreur: "Erreur interne." });
    }
});

// ── COMMANDES ────────────────────────────────────────────────────────────
router.get("/commandes", async (req, res) => {
    try {
        const limite = Math.min(parseInt(req.query.limite, 10) || 50, 200);
        const statut = req.query.statut;
        const params = [req.workspaceId];
        let filtre = "";
        if (statut) { params.push(statut); filtre = ` AND statut = $${params.length}`; }
        params.push(limite);

        const rows = await db.query(
            `SELECT id, nom_client, telephone, adresse, produit, statut, montant,
                    source, date_commande, confirme_le
               FROM commandes
              WHERE workspace_id = $1${filtre}
              ORDER BY date_commande DESC
              LIMIT $${params.length}`,
            params,
        );
        res.json({ commandes: rows, total: rows.length });
    } catch (err) {
        console.error("❌ API v1 GET /commandes :", err.message);
        res.status(500).json({ erreur: "Erreur interne." });
    }
});

router.post("/commandes", async (req, res) => {
    try {
        const { nomClient, telephone, adresse, produit, montant } = req.body || {};
        if (!nomClient || !String(nomClient).trim()) {
            return res.status(400).json({ erreur: "Le champ nomClient est obligatoire." });
        }
        const id = `API-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
        await db.query(
            `INSERT INTO commandes
                (id, workspace_id, nom_client, telephone, adresse, produit, statut, source, montant, date_commande)
             VALUES ($1, $2, $3, $4, $5, $6, 'en attente', 'api', $7, NOW())`,
            [
                id, req.workspaceId, String(nomClient).slice(0, 120),
                String(telephone || "").slice(0, 30), String(adresse || "").slice(0, 250),
                String(produit || "").slice(0, 250), parseFloat(montant) || 0,
            ],
        );

        // Une commande créée par l'API déclenche les mêmes webhooks qu'une
        // commande venue de WhatsApp : pour un partenaire, la provenance ne
        // doit rien changer au comportement.
        apiPartenaire.emettre(req.workspaceId, "commande.creee", {
            id, nomClient, telephone, produit, montant: parseFloat(montant) || 0,
        });

        res.status(201).json({ commande: { id, statut: "en attente" } });
    } catch (err) {
        console.error("❌ API v1 POST /commandes :", err.message);
        res.status(500).json({ erreur: "Erreur interne." });
    }
});

// ── RENDEZ-VOUS ──────────────────────────────────────────────────────────
router.get("/rendez-vous", async (req, res) => {
    try {
        const limite = Math.min(parseInt(req.query.limite, 10) || 50, 200);
        const rows = await db.query(
            `SELECT id, client_nom, client_telephone, motif, date_rdv, statut, source, created_at
               FROM rendez_vous
              WHERE workspace_id = $1
              ORDER BY date_rdv DESC
              LIMIT $2`,
            [req.workspaceId, limite],
        );
        res.json({ rendezVous: rows, total: rows.length });
    } catch (err) {
        console.error("❌ API v1 GET /rendez-vous :", err.message);
        res.status(500).json({ erreur: "Erreur interne." });
    }
});

router.post("/rendez-vous", async (req, res) => {
    try {
        const { clientNom, telephone, motif, dateRdv } = req.body || {};
        if (!clientNom || !dateRdv) {
            return res.status(400).json({ erreur: "Les champs clientNom et dateRdv sont obligatoires." });
        }
        if (isNaN(new Date(dateRdv).getTime())) {
            return res.status(400).json({ erreur: "dateRdv doit être une date ISO valide (ex : 2026-09-12T14:30:00Z)." });
        }
        const rows = await db.query(
            `INSERT INTO rendez_vous
                (workspace_id, client_nom, client_telephone, motif, date_rdv, statut, source)
             VALUES ($1, $2, $3, $4, $5, 'en_attente', 'api') RETURNING id`,
            [
                req.workspaceId, String(clientNom).slice(0, 120),
                String(telephone || "").slice(0, 30), String(motif || "").slice(0, 250), dateRdv,
            ],
        );
        const id = rows[0].id;
        apiPartenaire.emettre(req.workspaceId, "rendezvous.cree", { id, clientNom, telephone, motif, dateRdv });
        res.status(201).json({ rendezVous: { id, statut: "en_attente" } });
    } catch (err) {
        console.error("❌ API v1 POST /rendez-vous :", err.message);
        res.status(500).json({ erreur: "Erreur interne." });
    }
});

// ── CLIENTS ──────────────────────────────────────────────────────────────
router.get("/clients", async (req, res) => {
    try {
        const limite = Math.min(parseInt(req.query.limite, 10) || 50, 200);
        const rows = await db.query(
            `SELECT nom_client AS nom, telephone,
                    COUNT(*)::int AS commandes,
                    COALESCE(SUM(montant), 0)::numeric AS total_depense,
                    MAX(date_commande) AS derniere_commande
               FROM commandes
              WHERE workspace_id = $1 AND telephone <> ''
              GROUP BY nom_client, telephone
              ORDER BY total_depense DESC
              LIMIT $2`,
            [req.workspaceId, limite],
        );
        res.json({ clients: rows, total: rows.length });
    } catch (err) {
        console.error("❌ API v1 GET /clients :", err.message);
        res.status(500).json({ erreur: "Erreur interne." });
    }
});

module.exports = router;
