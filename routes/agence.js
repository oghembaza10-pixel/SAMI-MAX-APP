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
const courriel = require("../services/emailTemplate");
const CONFIG = require("../config");
const workspaceService = require("../services/workspaceService");
const journalService = require("../services/journalService");
const metiers = require("../services/metiers");
const apiPartenaire = require("../services/apiPartenaire");
const portees = require("../services/portees");

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

// Une agence gère souvent des mondes différents en même temps — un resto,
// une clinique, un hôtel, une boutique en ligne — et chaque fiche doit
// montrer le chiffre qui compte pour CE métier : commandes du jour pour un
// commerce, rendez-vous à venir pour un cabinet. Le parcours de chaque
// métier est défini une seule fois dans services/metiers.js.

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
                label: metiers.label(metier),
                icone: metiers.icone(metier),
                estRdv: metiers.estRdv(metier),
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
        metiers: metiers.parGroupe(),
        pays: PAYS_DEVISE,
    });
});

// ══════════════════════════════════════════════════════════════════════════
// API & WEBHOOKS DE L'AGENCE
//
// Une agence ne veut pas reconstruire un flux d'automatisation par client :
// une seule clé couvre tout son portefeuille, et une seule URL de webhook
// reçoit les événements de tous ses clients (le bloc `espace` du corps envoyé
// dit lequel). L'appartenance d'un espace à l'agence est revérifiée à chaque
// appel — un client qui quitte le portefeuille sort du périmètre de la clé
// sans qu'il y ait quoi que ce soit à révoquer.
// ══════════════════════════════════════════════════════════════════════════
router.get("/api", requireAgence, async (req, res) => {
    try {
        const [cles, webhooks, espaces, acces] = await Promise.all([
            apiPartenaire.listerClesAgence(req.session.userId),
            apiPartenaire.listerWebhooksAgence(req.session.userId),
            apiPartenaire.listerEspacesAgence(req.session.userId),
            apiPartenaire.listerAccesAgence(req.session.userId, 15).catch(() => []),
        ]);
        res.render("agence-api", {
            nomAgence: req.session.nom || "Mon agence",
            cles, webhooks, acces,
            domaines: portees.parDomaine(),
            espaces: espaces.map(e => ({
                ...e,
                metierLabel: metiers.label(e.metier) || e.metier || "—",
                parcours: metiers.estRdv(e.metier) ? "rendez-vous" : "commandes",
            })),
            evenements: apiPartenaire.EVENEMENTS,
            baseUrl: `${req.protocol}://${req.get("host")}`,
        });
    } catch (err) {
        console.error("❌ /agence/api :", err.message);
        res.status(500).send("Erreur de chargement.");
    }
});

// La clé en clair n'existe que dans cette réponse : elle n'est stockée nulle
// part en clair, donc une clé perdue se remplace, elle ne se retrouve pas.
router.post("/api/cles", requireAgence, async (req, res) => {
    try {
        const droits = portees.nettoyer(req.body?.portees);
        if (!droits.length) {
            return res.json({ success: false, error: "Choisis au moins une permission pour cette clé." });
        }
        const cle = await apiPartenaire.creerCleAgence(req.session.userId, req.body?.nom || "Clé agence", droits);
        await journalService.log({
            action: "agence.api.cle.creee",
            details: `${req.session.nom || "Agence"} — ${req.body?.nom || "Clé agence"}`,
        });
        res.json({ success: true, cle });
    } catch (err) {
        console.error("❌ /agence/api/cles :", err.message);
        res.json({ success: false, error: "Impossible de créer la clé." });
    }
});

router.post("/api/cles/:id/revoquer", requireAgence, async (req, res) => {
    const ok = await apiPartenaire.revoquerCleAgence(req.session.userId, req.params.id);
    res.json({ success: ok });
});

router.post("/api/webhooks", requireAgence, async (req, res) => {
    try {
        const url = String(req.body?.url || "").trim();
        if (!/^https:\/\/.+/i.test(url)) {
            return res.json({ success: false, error: "L'URL doit commencer par https://" });
        }
        const evenements = Array.isArray(req.body?.evenements)
            ? req.body.evenements
            : String(req.body?.evenements || "").split(",").map(e => e.trim()).filter(Boolean);

        const cree = await apiPartenaire.creerWebhookAgence(req.session.userId, { url, evenements });
        res.json({ success: true, webhook: cree });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

router.post("/api/webhooks/:id/supprimer", requireAgence, async (req, res) => {
    const ok = await apiPartenaire.supprimerWebhookAgence(req.session.userId, req.params.id);
    res.json({ success: ok });
});

router.post("/creer-client", requireAgence, async (req, res) => {
    try {
        const { nom, metier, metierCustom, email, pays } = req.body;
        if (!nom || !nom.trim()) return res.json({ success: false, error: "Le nom de la boutique est obligatoire." });

        // "Autre" ouvre la saisie libre : aucune liste ne couvrira jamais
        // tous les métiers d'Afrique et du Maghreb, et une agence ne doit
        // pas être bloquée parce que son client fait un métier auquel on
        // n'avait pas pensé. Le métier libre est enregistré tel quel, comme
        // le fait déjà l'onboarding conversationnel (routes/workspace.js).
        let metierFinal = String(metier || "").trim().toLowerCase();
        if (metierFinal === "autre") {
            const libre = String(metierCustom || "").trim();
            if (!libre) return res.json({ success: false, error: "Précise le métier de ton client." });
            if (libre.length > 40) return res.json({ success: false, error: "Métier trop long (40 caractères maximum)." });
            metierFinal = libre.toLowerCase();
        } else if (!metiers.estValide(metierFinal)) {
            return res.json({ success: false, error: "Métier invalide." });
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json({ success: false, error: "Email client invalide." });
        if (!PAYS_DEVISE[pays]) return res.json({ success: false, error: "Pays invalide." });

        const existant = await workspaceService.getByOwner(email.trim().toLowerCase());
        if (existant.length > 0) return res.json({ success: false, error: "Ce client a déjà une boutique sur SAMII." });

        const workspace = await workspaceService.create({
            workspaceId: generateWorkspaceId(),
            owner: email.trim().toLowerCase(),
            nom: nom.trim(),
            metier: metierFinal,
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
            subject: `Votre espace SAMII « ${nom.trim()} » est prêt`,
            html: courriel.construire({
                titre: "Votre espace est prêt",
                preheader: `${nomAgence} vient de créer votre espace SAMII.`,
                corps: courriel.p(`<strong style="color:#f3f1e9;">${courriel.echapper(nomAgence)}</strong> vient de créer l'espace <strong style="color:#f3f1e9;">${courriel.echapper(nom.trim())}</strong> pour vous.`)
                     + courriel.p("Créez votre compte avec <strong style=\"color:#f3f1e9;\">cette adresse email</strong> : l'espace vous sera rattaché automatiquement, et vous en serez le propriétaire."),
                cta: { url: `${CONFIG.APP_URL}/register`, libelle: "Accéder à mon espace" },
                note: "Votre agence garde une vue sur cet espace pour vous accompagner — vous en restez le propriétaire.<br />Vous ne connaissez pas cette agence ? Répondez à cet email, nous fermerons l'espace.",
            }),
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
