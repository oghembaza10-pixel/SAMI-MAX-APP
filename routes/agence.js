// ==========================================================================
// SAMII OS — QG AGENCE
// Un compte "agence" (utilisateurs.type_compte = 'agence', choisi à
// l'inscription) crée et pilote les boutiques de ses clients, en autonomie.
// Chaque client garde son propre accès direct (mêmes règles que n'importe
// quel compte SAMII — connexion par email, workspace lié via owner_email) ;
// l'agence, elle, entre dans ces mêmes boutiques via le lien supplémentaire
// workspaces.agence_id → utilisateurs.id (voir
// scripts/alter-workspaces-agence.js et services/workspaceService.js).
// ==========================================================================
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../services/db");
const gmail = require("../services/gmail");
const CONFIG = require("../config");
const workspaceService = require("../services/workspaceService");
const journalService = require("../services/journalService");

function requireAgence(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    if (req.session.typeCompte !== "agence") return res.redirect("/hub");
    next();
}

// L'agence est autonome : elle crée les espaces de ses clients quand elle
// veut, sans validation préalable — c'est elle qui tient la relation client.
//
// Le contrôle se fait donc EN AVAL, pas en amont :
//   1. chaque création est tracée dans le journal (action agence.client.cree)
//      et remonte en direct dans l'espace admin ;
//   2. le client est prévenu par email dès que son espace est créé, avec le
//      nom de l'agence — le vrai propriétaire de l'adresse sait donc
//      immédiatement qu'un espace existe à son nom, et peut le signaler.
// Un abus reste visible et réversible, sans jamais ralentir une agence
// légitime.

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function generateWorkspaceId() {
    return `WS-${crypto.randomUUID()}`;
}

const METIERS_VALIDES = new Set([
    "ecommerce", "restaurant", "immobilier", "livreur", "sante", "finance",
    "education", "technologie", "agriculture", "industrie", "services", "tourisme",
]);

const PAYS_DEVISE = {
    DZ: { label: "Algérie",  devise: "DZD" },
    FR: { label: "France",   devise: "EUR" },
    MA: { label: "Maroc",    devise: "MAD" },
    TN: { label: "Tunisie",  devise: "TND" },
    US: { label: "États-Unis", devise: "USD" },
    CA: { label: "Canada",   devise: "CAD" },
    SA: { label: "Arabie Saoudite", devise: "SAR" },
    AE: { label: "Émirats arabes unis", devise: "AED" },
    autre: { label: "Autre", devise: "" },
};

// Métiers qui fonctionnent en rendez-vous (médical, hôtellerie, immobilier,
// services...) plutôt qu'en commandes : une agence gère souvent les deux
// mondes en même temps — un resto, une clinique, un hôtel, une boutique en
// ligne — et chaque fiche doit montrer le chiffre qui compte pour CE métier.
const METIERS_RDV = new Set(["sante", "immobilier", "services", "tourisme", "education", "finance"]);

const ICONE_METIER = {
    ecommerce: "🛍️", restaurant: "🍽️", sante: "🩺", tourisme: "🏨",
    immobilier: "🏘️", livreur: "🚚", finance: "💳", education: "🎓",
    technologie: "💻", agriculture: "🌾", industrie: "🏭", services: "🧰",
};

// Les identifiants de métier sont sans accent en base (contrainte technique),
// mais ce qui s'affiche à une agence doit être écrit correctement.
const LABEL_METIER = {
    ecommerce: "E-commerce", restaurant: "Restauration", sante: "Santé",
    tourisme: "Hôtellerie & Tourisme", immobilier: "Immobilier", livreur: "Livraison",
    finance: "Finance", education: "Éducation", technologie: "Technologie",
    agriculture: "Agriculture", industrie: "Industrie", services: "Services",
};

// Une agence qui ne voit qu'une liste de noms doit entrer dans chaque espace
// pour savoir si ça tourne. Ces agrégats lui donnent l'état réel de tout son
// portefeuille d'un coup d'œil, en une seule requête par table plutôt qu'une
// par client (sinon 30 clients = 60 requêtes à chaque chargement).
async function chargerActivite(workspaceIds) {
    if (!workspaceIds.length) return {};

    const [commandes, rdvs] = await Promise.all([
        db.query(
            `SELECT workspace_id,
                    COUNT(*) FILTER (WHERE date_commande >= CURRENT_DATE)::int          AS jour,
                    COUNT(*) FILTER (WHERE date_commande >= CURRENT_DATE - 7)::int      AS semaine,
                    COUNT(*) FILTER (WHERE statut = 'en attente')::int                  AS attente,
                    COALESCE(SUM(montant) FILTER (WHERE date_commande >= CURRENT_DATE - 30), 0)::numeric AS ca_mois,
                    MAX(date_commande)                                                  AS derniere
               FROM commandes
              WHERE workspace_id = ANY($1)
              GROUP BY workspace_id`,
            [workspaceIds],
        ),
        db.query(
            `SELECT workspace_id,
                    COUNT(*) FILTER (WHERE date_rdv >= CURRENT_DATE)::int               AS a_venir,
                    COUNT(*) FILTER (WHERE statut = 'en_attente')::int                  AS attente,
                    MAX(created_at)                                                     AS derniere
               FROM rendez_vous
              WHERE workspace_id = ANY($1)
              GROUP BY workspace_id`,
            [workspaceIds],
        ),
    ]);

    const parWorkspace = {};
    for (const id of workspaceIds) {
        parWorkspace[id] = { jour: 0, semaine: 0, attente: 0, caMois: 0, rdvAVenir: 0, derniere: null };
    }
    for (const c of commandes) {
        const e = parWorkspace[c.workspace_id];
        if (!e) continue;
        e.jour = c.jour; e.semaine = c.semaine; e.attente = c.attente;
        e.caMois = Number(c.ca_mois) || 0;
        e.derniere = c.derniere;
    }
    for (const r of rdvs) {
        const e = parWorkspace[r.workspace_id];
        if (!e) continue;
        e.rdvAVenir = r.a_venir;
        e.attente += r.attente;
        if (r.derniere && (!e.derniere || new Date(r.derniere) > new Date(e.derniere))) e.derniere = r.derniere;
    }
    return parWorkspace;
}

function joursDepuis(date) {
    if (!date) return null;
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

router.get("/", requireAgence, async (req, res) => {
    const clients = await workspaceService.getByAgence(req.session.userId);
    const nbActifs = clients.filter(c => c.agenceStatut === "actif").length;
    const nbAbandon = clients.filter(c => c.agenceStatut === "abandon_demande").length;

    let activite = {};
    try {
        activite = await chargerActivite(clients.map(c => c.workspaceId));
    } catch (err) {
        // Le portefeuille doit rester consultable même si l'agrégat échoue :
        // on perd les chiffres, jamais la liste des clients.
        console.error("❌ QG Agence — activité :", err.message);
    }

    // Un client "en alerte" = aucune commande ni RDV depuis plus de 7 jours,
    // ou des demandes en attente non traitées. C'est exactement ce qu'une
    // agence doit voir en premier : là où son intervention est nécessaire.
    const enAlerte = clients.filter(c => {
        const a = activite[c.workspaceId];
        if (!a || c.agenceStatut !== "actif") return false;
        const jours = joursDepuis(a.derniere);
        return a.attente > 0 || jours === null || jours > 7;
    }).length;

    const totalJour = Object.values(activite).reduce((s, a) => s + (a.jour || 0), 0);
    const totalAttente = Object.values(activite).reduce((s, a) => s + (a.attente || 0), 0);

    // L'agence est autonome, mais elle doit savoir que son client est
    // prévenu : c'est ce qui rend la démarche propre vis-à-vis du client
    // final, et ça évite qu'elle découvre l'email après coup.
    // Regroupement par métier : une agence pilote une flotte, pas une liste
    // à plat. Chaque groupe porte ses propres chiffres agrégés pour que la
    // carte affiche l'état de l'escadrille sans l'ouvrir.
    const groupes = [];
    for (const c of clients) {
        const metier = (c.metier || "autre").toLowerCase();
        let g = groupes.find(x => x.metier === metier);
        if (!g) {
            g = {
                metier,
                label: LABEL_METIER[metier] || (metier.charAt(0).toUpperCase() + metier.slice(1)),
                icone: ICONE_METIER[metier] || "🏢",
                estRdv: METIERS_RDV.has(metier),
                clients: [], jour: 0, semaine: 0, attente: 0, rdvAVenir: 0,
            };
            groupes.push(g);
        }

        const a = activite[c.workspaceId] || { jour: 0, semaine: 0, attente: 0, caMois: 0, rdvAVenir: 0, derniere: null };
        const jours = joursDepuis(a.derniere);

        g.jour += a.jour;
        g.semaine += a.semaine;
        g.attente += a.attente;
        g.rdvAVenir += a.rdvAVenir;

        g.clients.push({
            workspaceId: c.workspaceId,
            nom: c.nom || "Sans nom",
            owner: c.owner || "",
            devise: c.devise || "",
            agenceStatut: c.agenceStatut,
            jour: a.jour,
            semaine: a.semaine,
            rdvAVenir: a.rdvAVenir,
            caMois: a.caMois,
            caMoisFormate: Math.round(a.caMois).toLocaleString("fr-FR"),
            etat: c.agenceStatut === "abandon_demande" ? "alerte"
                : a.attente > 0 ? "alerte"
                : (jours === null || jours > 7) ? "dormant" : "actif",
            derniereActivite: c.agenceStatut === "abandon_demande" ? "Fermeture demandée"
                : jours === null ? "Aucune activité"
                : jours === 0 ? "Aujourd'hui"
                : jours === 1 ? "Hier"
                : `Il y a ${jours} j`,
        });
    }

    // Les escadrilles qui demandent une action passent devant : l'agence doit
    // voir en premier là où son intervention est nécessaire.
    groupes.sort((a, b) => (b.attente - a.attente) || (b.clients.length - a.clients.length));

    res.render("agence", {
        nomAgence: req.session.nom || "Mon agence",
        clients,
        groupes,
        totalJour,
        totalAttente,
        enAlerte,
        metiers: [...METIERS_VALIDES].map(m => ({ id: m, label: LABEL_METIER[m] || m })),
        pays: PAYS_DEVISE,
    });
});

router.post("/creer-client", requireAgence, async (req, res) => {
    try {
        const { nom, metier, email, pays } = req.body;
        if (!nom || !nom.trim()) return res.json({ success: false, error: "Le nom de la boutique est obligatoire." });
        if (!METIERS_VALIDES.has(metier)) return res.json({ success: false, error: "Métier invalide." });
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json({ success: false, error: "Email client invalide." });
        if (!PAYS_DEVISE[pays]) return res.json({ success: false, error: "Pays invalide." });

        const existant = await workspaceService.getByOwner(email.trim().toLowerCase());
        if (existant.length > 0) return res.json({ success: false, error: "Ce client a déjà une boutique sur SAMII." });

        const workspace = await workspaceService.create({
            workspaceId: generateWorkspaceId(),
            owner: email.trim().toLowerCase(),
            nom: nom.trim(),
            metier,
            pays,
            devise: PAYS_DEVISE[pays].devise || "USD",
            agenceId: req.session.userId,
        });
        if (!workspace) return res.json({ success: false, error: "Erreur lors de la création. Réessayez." });

        const emailClient = email.trim().toLowerCase();
        const nomAgence = req.session.nom || "votre agence";

        await journalService.log({
            action: "agence.client.cree",
            details: `Boutique "${nom.trim()}" créée par l'agence ${nomAgence} pour ${emailClient}`,
            workspaceId: workspace.workspaceId,
            userId: req.session.userId,
        });

        // Le client est prévenu tout de suite : il apprend qu'un espace
        // existe à son nom, par qui, et comment y accéder lui-même. C'est ce
        // qui rend la démarche propre — le propriétaire réel de l'adresse
        // n'est jamais mis devant le fait accompli. En tâche de fond : un
        // souci d'envoi ne doit pas faire échouer la création côté agence.
        gmail.send({
            to: emailClient,
            subject: `Votre espace SAMII "${nom.trim()}" a été créé`,
            html: `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#C5A059;">Votre espace SAMII est prêt 👑</h2>
        <p><strong>${escapeHtml(nomAgence)}</strong> vient de créer l'espace <strong>${escapeHtml(nom.trim())}</strong> pour vous sur SAMII OS.</p>
        <p>Pour y accéder, créez votre compte avec <strong>cette adresse email</strong> : votre espace vous sera automatiquement rattaché, et vous en serez le propriétaire.</p>
        <a href="${CONFIG.APP_URL}/register" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;background:#C5A059;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0;font-size:16px;">
            👉 Accéder à mon espace
        </a>
        <p style="color:#888;font-size:.82rem;line-height:1.6;">Votre agence garde une vue sur cet espace pour vous accompagner. Vous en restez le propriétaire et pouvez nous contacter à tout moment.</p>
        <p style="color:#888;font-size:.82rem;">Vous ne connaissez pas cette agence ? Répondez simplement à cet email, nous fermerons l'espace.</p>
    </div>`,
        }).catch(err => console.warn("⚠️ Email création espace client (agence) :", err.message));

        res.json({ success: true, workspaceId: workspace.workspaceId });
    } catch (err) {
        console.error("❌ POST /agence/creer-client :", err.message);
        res.json({ success: false, error: "Erreur interne. Réessayez." });
    }
});

router.post("/abandonner/:workspaceId", requireAgence, async (req, res) => {
    try {
        const workspace = await workspaceService.getById(req.params.workspaceId);
        if (!workspace || workspace.agenceId !== req.session.userId) {
            return res.json({ success: false, error: "Boutique introuvable ou non autorisée." });
        }

        await db.query(`UPDATE workspaces SET agence_statut = 'abandon_demande' WHERE id = $1`, [workspace.workspaceId]);
        await journalService.log({
            action: "agence.client.abandon_demande",
            details: `Fermeture demandée par l'agence pour "${workspace.nom}"`,
            workspaceId: workspace.workspaceId,
            userId: req.session.userId,
        });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /agence/abandonner :", err.message);
        res.json({ success: false, error: "Erreur interne." });
    }
});

router.get("/entrer/:workspaceId", requireAgence, async (req, res) => {
    try {
        const workspace = await workspaceService.getById(req.params.workspaceId);
        if (!workspace || workspace.agenceId !== req.session.userId) {
            return res.redirect("/agence");
        }
        req.session.workspaceId = workspace.workspaceId;
        req.session.metier      = workspace.metier;
        req.session.save((err) => {
            if (err) return res.redirect("/agence");
            res.redirect("/qg");
        });
    } catch (err) {
        console.error("❌ GET /agence/entrer :", err.message);
        res.redirect("/agence");
    }
});

module.exports = router;
