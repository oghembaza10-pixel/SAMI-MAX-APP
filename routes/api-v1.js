// ==========================================================================
// SAMII OS — API PUBLIQUE v1 (partenaires, n8n, Make, ERP...)
//
// Authentification par clé, pas par session : c'est ce qui permet à un
// système externe de nous appeler.
//
// Une clé de MARCHAND est liée à un seul espace : tout ce qu'elle lit ou
// écrit y est borné, elle ne peut atteindre aucun autre espace même en
// falsifiant un identifiant. Une clé d'AGENCE couvre le portefeuille de
// l'agence : l'appelant désigne l'espace visé, et son appartenance est
// revérifiée en base à chaque appel — désigner l'espace d'un marchand qui
// n'est pas au portefeuille renvoie 403, pas des données.
//
// Conventions volontairement classiques (Bearer token, JSON, verbes REST)
// pour que ça se branche dans n8n avec le nœud HTTP standard, sans nœud
// dédié ni SDK à installer.
// ==========================================================================
const express = require("express");
const crypto = require("crypto");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const router = express.Router();
const db = require("../services/db");
const apiPartenaire = require("../services/apiPartenaire");
const evenements = require("../services/evenements");
const metiers = require("../services/metiers");
const portees = require("../services/portees");

// Limite par clé plutôt que par IP : plusieurs partenaires peuvent sortir
// de la même IP (un n8n auto-hébergé mutualisé), et une clé qui s'emballe
// ne doit pas pénaliser les autres.
const limiteur = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    // Repli sur l'IP quand aucune clé n'est envoyée (appel anonyme, refusé
    // juste après en 401). ipKeyGenerator regroupe les adresses IPv6 par
    // préfixe /64 : sans lui, un appelant IPv6 change d'adresse à volonté
    // dans son propre bloc et la limite ne retient plus rien.
    keyGenerator: (req) => req.headers.authorization || ipKeyGenerator(req.ip),
    message: { erreur: "Trop de requêtes. Limite : 120 par minute." },
});

// Deux portées de clé :
//   • marchand — la clé désigne son espace, il n'y a rien à préciser ;
//   • agence   — la clé couvre tout le portefeuille, l'appelant désigne
//                l'espace visé par l'en-tête X-SAMII-Espace (ou ?espace=).
//                L'appartenance de cet espace à l'agence est revérifiée à
//                chaque appel, jamais déduite de la clé seule.
async function authentifier(req, res, next) {
    const entete = req.headers.authorization || "";
    const cle = entete.startsWith("Bearer ") ? entete.slice(7).trim() : "";
    const portee = await apiPartenaire.resoudreCle(cle);
    if (!portee) {
        return res.status(401).json({
            erreur: "Clé API absente, invalide ou révoquée.",
            aide: "Envoyez l'en-tête : Authorization: Bearer sk_samii_…",
        });
    }

    req.cleId = portee.cleId;
    req.portees = portee.portees;
    req.agenceId = portee.agenceId;

    if (portee.workspaceId) {
        req.workspaceId = portee.workspaceId;
        return next();
    }

    // Clé d'agence : /espaces et /moi restent accessibles sans cibler un
    // client — c'est précisément là qu'on découvre les identifiants à viser.
    const vise = String(
        req.headers["x-samii-espace"] || req.query.espace || req.body?.espace || "",
    ).trim();

    if (!vise) {
        req.workspaceId = null;
        return next();
    }

    const espace = await apiPartenaire.espaceDeLAgence(portee.agenceId, vise);
    if (!espace) {
        return res.status(403).json({
            erreur: "Cet espace ne fait pas partie de votre portefeuille.",
            aide: "GET /api/v1/espaces liste les espaces accessibles avec cette clé.",
        });
    }
    req.workspaceId = espace;
    next();
}

// Toutes les routes ci-dessous, sauf /espaces et /moi, ont besoin d'un espace
// cible. Avec une clé marchand il est implicite ; avec une clé d'agence il
// doit être désigné.
function exigerEspace(req, res, next) {
    if (req.workspaceId) return next();
    res.status(400).json({
        erreur: "Aucun espace ciblé.",
        aide: "Clé d'agence : précisez l'en-tête X-SAMII-Espace (ou ?espace=). GET /api/v1/espaces donne la liste.",
    });
}

// Policy Engine : la permission est vérifiée ICI, à l'entrée de chaque route,
// et jamais déduite de ce que l'appelant prétend être. Le refus nomme la
// portée manquante — un intégrateur doit pouvoir corriger sans nous écrire.
function exiger(portee) {
    return (req, res, next) => {
        if (portees.autorise(req.portees, portee)) return next();
        req.porteeRefusee = portee;
        res.status(403).json({
            erreur: "Cette clé n'a pas la permission nécessaire.",
            porteeRequise: portee,
            aide: `Ajoutez « ${portees.label(portee)} » aux permissions de la clé, ou créez-en une nouvelle.`,
        });
    };
}

router.use(limiteur, express.json({ limit: "256kb" }), authentifier);

// Traçabilité : on écrit la trace quand la réponse part, pour connaître son
// code réel. Le journal répond à la question que pose tout marchand avant de
// confier son espace — « qu'est-ce que cette clé a fait chez moi ? ».
router.use((req, res, next) => {
    res.on("finish", () => {
        apiPartenaire.tracer({
            cleId: req.cleId,
            workspaceId: req.workspaceId,
            agenceId: req.agenceId,
            methode: req.method,
            chemin: req.originalUrl.split("?")[0],
            statut: res.statusCode,
            portee: req.porteeRefusee || null,
            refusee: res.statusCode === 403,
            ip: req.ip,
        });
    });
    next();
});

// ── PORTEFEUILLE (clés d'agence) ─────────────────────────────────────────
// Les espaces que cette clé peut atteindre. Sur une clé marchand, il n'y en
// a qu'un — le sien — pour que le même flux n8n fonctionne dans les deux cas
// sans être réécrit.
router.get("/espaces", exiger("espaces:lire"), async (req, res) => {
    try {
        if (req.agenceId) {
            const espaces = await apiPartenaire.listerEspacesAgence(req.agenceId);
            return res.json({
                espaces: espaces.map(e => ({
                    id: e.id, nom: e.nom, metier: e.metier,
                    metierLabel: metiers.label(e.metier),
                    parcours: metiers.estRdv(e.metier) ? "rendez-vous" : "commandes",
                    pays: e.pays, devise: e.devise,
                })),
                total: espaces.length,
            });
        }
        const rows = await db.query(
            `SELECT id, nom, metier, pays, devise FROM workspaces WHERE id = $1`,
            [req.workspaceId],
        );
        res.json({
            espaces: rows.map(e => ({
                id: e.id, nom: e.nom, metier: e.metier,
                metierLabel: metiers.label(e.metier),
                parcours: metiers.estRdv(e.metier) ? "rendez-vous" : "commandes",
                pays: e.pays, devise: e.devise,
            })),
            total: rows.length,
        });
    } catch (err) {
        console.error("❌ API v1 /espaces :", err.message);
        res.status(500).json({ erreur: "Erreur interne." });
    }
});

// ── IDENTITÉ ─────────────────────────────────────────────────────────────
// Premier appel que fait tout intégrateur pour valider sa clé.
router.get("/moi", exiger("espaces:lire"), async (req, res) => {
    try {
        // Clé d'agence sans espace ciblé : on décrit l'agence elle-même.
        if (!req.workspaceId && req.agenceId) {
            const espaces = await apiPartenaire.listerEspacesAgence(req.agenceId);
            return res.json({
                portee: "agence",
                agence: { id: req.agenceId, espaces: espaces.length },
                aide: "Ciblez un espace avec l'en-tête X-SAMII-Espace. GET /api/v1/espaces donne la liste.",
            });
        }
        const rows = await db.query(
            `SELECT id, nom, metier, pays, devise FROM workspaces WHERE id = $1`,
            [req.workspaceId],
        );
        if (!rows[0]) return res.status(404).json({ erreur: "Espace introuvable." });
        const w = rows[0];
        res.json({
            portee: req.agenceId ? "agence" : "marchand",
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
router.get("/commandes", exigerEspace, exiger("commandes:lire"), async (req, res) => {
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

router.post("/commandes", exigerEspace, exiger("commandes:ecrire"), async (req, res) => {
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

        // Une commande créée par l'API passe par le même bus qu'une commande
        // venue de WhatsApp : pour un partenaire, la provenance ne doit rien
        // changer au comportement.
        evenements.publier(req.workspaceId, "commande.creee", {
            id, nomClient, telephone, produit,
            montant: parseFloat(montant) || 0, source: "api",
        }, { socketDonnees: { id } });

        res.status(201).json({ commande: { id, statut: "en attente" } });
    } catch (err) {
        console.error("❌ API v1 POST /commandes :", err.message);
        res.status(500).json({ erreur: "Erreur interne." });
    }
});

// ── RENDEZ-VOUS ──────────────────────────────────────────────────────────
router.get("/rendez-vous", exigerEspace, exiger("rendezvous:lire"), async (req, res) => {
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

router.post("/rendez-vous", exigerEspace, exiger("rendezvous:ecrire"), async (req, res) => {
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
        evenements.publier(req.workspaceId, "rendezvous.cree",
            { id, clientNom, telephone, motif, dateRdv, source: "api" },
            { socketDonnees: { id } });
        res.status(201).json({ rendezVous: { id, statut: "en_attente" } });
    } catch (err) {
        console.error("❌ API v1 POST /rendez-vous :", err.message);
        res.status(500).json({ erreur: "Erreur interne." });
    }
});

// ── CLIENTS ──────────────────────────────────────────────────────────────
router.get("/clients", exigerEspace, exiger("clients:lire"), async (req, res) => {
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
