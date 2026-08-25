// ==========================================================================
// SAMII OS — LA PORTE DE L'ACADÉMIE
//
// Tout ce qui se construit ou se vend dans l'Académie passe par ici d'abord.
// On ne demande ni carte, ni abonnement, ni dossier : on demande de lire une
// page et de cocher une case. En échange, la règle est connue de tous avant
// la première ligne de code, et la commission de 10 % n'est une surprise pour
// personne le jour de la première vente.
//
// LE VERROU EST UN MIDDLEWARE, PAS UNE PAGE. `exigerMembre` s'applique à
// toutes les routes de l'Académie qui touchent au travail ou à l'argent. Une
// vérification posée page par page finit toujours par en oublier une — et
// celle qu'on oublie est celle où quelqu'un publie sans avoir rien accepté.
// ==========================================================================
const express = require("express");
const router = express.Router();
const academie = require("../config/academie");
const service = require("../services/academie");
const journalService = require("../services/journalService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// À poser devant toute route de l'Académie qui construit, publie ou encaisse.
// Renvoie vers la porte en gardant la destination : après acceptation, on
// revient exactement là où on allait, sinon on perd les gens sur le seuil.
async function exigerMembre(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    if (await service.estMembre(req.session.userId)) return next();
    const retour = encodeURIComponent(req.originalUrl || "/academy");
    return res.redirect(`/academy/rejoindre?retour=${retour}`);
}

// ── Le hall ──────────────────────────────────────────────────────────────
// Volontairement ouvert à tous, sans compte : c'est une page d'invitation.
// Un développeur qui la découvre doit pouvoir tout lire — ce qu'on apporte,
// ce qu'on prend, ce qu'il garde — avant qu'on lui demande quoi que ce soit.
router.get("/", async (req, res) => {
    const membre = req.session?.loggedIn ? await service.estMembre(req.session.userId) : false;
    res.render("academie-hall", {
        taux: Math.round(academie.TAUX_COMMISSION * 100),
        membre,
    });
});

// ── L'atelier : où l'on construit ────────────────────────────────────────
// Derrière la porte. Rien à inventer côté outils : les clés, les webhooks et
// le journal d'accès vivent déjà dans /developpeurs, la déclaration d'une
// application dans /apps. L'Académie les rassemble et pose la règle.
router.get("/construire", exigerMembre, (req, res) => {
    res.render("academie-construire", {
        taux: Math.round(academie.TAUX_COMMISSION * 100),
    });
});

// ── La place : où l'on se rencontre ──────────────────────────────────────
// Pas encore ouverte. On l'annonce comme telle plutôt que de la cacher : un
// lieu à moitié construit qu'on présente comme fini se paie au premier client.
router.get("/trouver", (req, res) => {
    res.render("academie-trouver", {
        taux: Math.round(academie.TAUX_COMMISSION * 100),
        membre: !!req.session?.loggedIn,
    });
});

// ── La page du contrat ───────────────────────────────────────────────────
router.get("/rejoindre", requireAuth, async (req, res) => {
    const dejaMembre = await service.estMembre(req.session.userId);
    const retour = typeof req.query.retour === "string" ? req.query.retour : "/academy";

    res.render("academie-rejoindre", {
        contrat: academie.CONTRAT,
        taux: Math.round(academie.TAUX_COMMISSION * 100),
        roles: academie.ROLES,
        dejaMembre,
        // Une destination fournie par l'URL ne doit jamais pouvoir envoyer
        // ailleurs que chez nous : sans ce filtre, un lien préparé renverrait
        // le membre sur un site tiers juste après avoir coché une case de
        // confiance. On n'accepte qu'un chemin interne.
        retour: /^\/[^/\\]/.test(retour) ? retour : "/academy",
        erreur: null,
    });
});

// ── L'acceptation ────────────────────────────────────────────────────────
router.post("/rejoindre", requireAuth, async (req, res) => {
    const retour = typeof req.body.retour === "string" && /^\/[^/\\]/.test(req.body.retour)
        ? req.body.retour : "/academy";

    const echec = (erreur) => res.render("academie-rejoindre", {
        contrat: academie.CONTRAT,
        taux: Math.round(academie.TAUX_COMMISSION * 100),
        roles: academie.ROLES,
        dejaMembre: false,
        retour,
        erreur,
    });

    try {
        const role = String(req.body.role || "").trim();
        if (!academie.ROLES.includes(role)) {
            return echec("Dis-nous si tu viens construire ou si tu viens chercher quelqu'un.");
        }
        // La case doit être cochée à la main. Un consentement pré-coché n'en
        // est pas un, et ne vaudrait rien le jour où il faudrait s'en servir.
        if (req.body.accepte !== "oui") {
            return echec("Coche la case pour accepter le contrat de l'Académie.");
        }

        await service.accepter(req.session.userId, role, {
            // Trace minimale et proportionnée : de quoi prouver l'acceptation,
            // rien de plus. Pas de profilage, pas de conservation ailleurs.
            ip: req.headers["x-forwarded-for"] || req.ip || "",
            agent: req.headers["user-agent"] || "",
        });

        await journalService.log({
            action: "academie.contrat.accepte",
            details: `${role} — contrat v${academie.CONTRAT_VERSION}`,
            userId: req.session.userId,
            workspaceId: req.session.workspaceId,
        }).catch(() => {});

        return res.redirect(retour);
    } catch (err) {
        console.error("❌ POST /academy/rejoindre :", err.message);
        return echec("Impossible d'enregistrer ton acceptation. Réessaie.");
    }
});

// ── Ce que j'ai accepté, et ce que j'ai gagné ────────────────────────────
// Un membre doit pouvoir relire à tout moment le contrat qui le lie et voir
// ce que la commission lui a coûté. Le cacher serait le meilleur moyen de le
// rendre suspect.
router.get("/mon-contrat", exigerMembre, async (req, res) => {
    const [historique, bilan] = await Promise.all([
        service.historique(req.session.userId),
        service.bilanVendeur(req.session.userId),
    ]);
    res.render("academie-mon-contrat", {
        contrat: academie.CONTRAT,
        taux: Math.round(academie.TAUX_COMMISSION * 100),
        historique,
        bilan,
    });
});

module.exports = { router, exigerMembre };
