// ==========================================================================
// SAMII OS — L'ESPACE DÉVELOPPEUR
//
// Ce que les grands portails donnent, et ce qu'ils oublient.
//
// Shopify Partners donne la liste des applications, les identifiants, une
// boutique de développement à remplir soi-même, et les revenus. Meta for
// Developers donne le tableau de bord, les webhooks et un explorateur d'API.
// Amazon donne la console. Tous ont le même angle mort : ils montrent la
// configuration, pas le TRAVAIL. Quand une application se met à échouer chez
// un marchand, il faut aller chercher ailleurs — dans ses propres journaux,
// s'ils existent.
//
// Ici, quatre choses sur un seul écran, dans l'ordre où un développeur en a
// besoin :
//
//   1. UN TERRAIN D'ESSAI DÉJÀ VIVANT — un clic, des commandes et des
//      rendez-vous réels. Chez les autres, c'est une demi-journée de décor à
//      construire avant le premier appel utile.
//   2. SA CLÉ ET UN APPEL QUI RÉPOND — la commande curl est écrite avec SA
//      clé et SON espace, prête à coller. Pas un exemple générique à adapter.
//   3. SES APPLICATIONS — état, installations en cours.
//   4. CE QU'IL A GAGNÉ — installations, commission, solde, retrait.
//
// La page ne demande jamais de lire une documentation pour faire le premier
// pas. La documentation est là pour le deuxième.
// ==========================================================================
const express = require("express");
const router = express.Router();

const bacASable = require("../services/bacASable");
const apiPartenaire = require("../services/apiPartenaire");
const apps = require("../services/apps");
const academieService = require("../services/academie");
const academie = require("../config/academie");
const portees = require("../services/portees");
const CONFIG = require("../config");

// Chaque lecture est isolée : une table absente ou une requête en échec ne
// doit pas vider tout le tableau de bord. Un écran partiellement rempli reste
// utilisable, un écran en erreur ne l'est jamais.
async function sansCasser(promesse, defaut) {
    try { return await promesse; } catch (err) {
        console.warn("⚠️ espace développeur :", err.message);
        return defaut;
    }
}

router.get("/", async (req, res) => {
    const devId = req.session.userId;
    try {
        const [bacs, mesApps, cles, acces, bilan] = await Promise.all([
            sansCasser(bacASable.lister(devId), []),
            sansCasser(apps.listerDuDeveloppeur(devId), []),
            sansCasser(apiPartenaire.listerCles(req.session.workspaceId), []),
            sansCasser(apiPartenaire.listerAcces(req.session.workspaceId, 12), []),
            sansCasser(academieService.bilanVendeur(devId), { ventes: 0, brut: 0, net: 0, a_recevoir: 0 }),
        ]);

        res.render("dev-espace", {
            bacs,
            decors: bacASable.DECORS,
            mesApps,
            cles,
            acces,
            bilan,
            domaines: portees.parDomaine(),
            baseUrl: CONFIG.APP_URL || `${req.protocol}://${req.get("host")}`,
            taux: Math.round(academie.TAUX_COMMISSION * 100),
            // Remontée une seule fois après une action, jamais gardée en
            // session : un message qui colle à l'écran plus longtemps que
            // l'action qu'il décrit finit par mentir.
            cleCreee: req.query.cle || "",
            message: req.query.m || "",
        });
    } catch (err) {
        console.error("❌ /academy/espace :", err.message);
        res.status(500).send("Erreur de chargement.");
    }
});

// ── Bac à sable ──────────────────────────────────────────────────────────

router.post("/bac", async (req, res) => {
    try {
        const { workspaceId, existant } = await bacASable.creer(req.session.userId, req.body.decor);
        return res.redirect(`/academy/espace?m=${encodeURIComponent(
            existant ? `Bac à sable déjà créé : ${workspaceId}` : `Bac à sable prêt : ${workspaceId}`)}`);
    } catch (err) {
        return res.redirect(`/academy/espace?m=${encodeURIComponent(err.message)}`);
    }
});

router.post("/bac/:id/reinitialiser", async (req, res) => {
    try {
        await bacASable.reinitialiser(req.session.userId, req.params.id);
        return res.redirect("/academy/espace?m=" + encodeURIComponent("Bac à sable remis à neuf."));
    } catch (err) {
        return res.redirect("/academy/espace?m=" + encodeURIComponent(err.message));
    }
});

router.post("/bac/:id/supprimer", async (req, res) => {
    try {
        await bacASable.supprimer(req.session.userId, req.params.id);
        return res.redirect("/academy/espace?m=" + encodeURIComponent("Bac à sable supprimé."));
    } catch (err) {
        return res.redirect("/academy/espace?m=" + encodeURIComponent(err.message));
    }
});

// La clé n'existe en clair qu'ici, dans cette redirection. Elle n'est stockée
// nulle part en clair : perdue, il faut en refaire une.
router.post("/bac/:id/cle", async (req, res) => {
    try {
        const cle = await bacASable.creerCle(req.session.userId, req.params.id);
        return res.redirect(`/academy/espace?cle=${encodeURIComponent(cle)}&m=${encodeURIComponent("Clé d'essai créée — copie-la, elle ne sera plus affichée.")}`);
    } catch (err) {
        return res.redirect("/academy/espace?m=" + encodeURIComponent(err.message));
    }
});

module.exports = router;
