// ==========================================================================
// SAMII OS — APPLICATIONS TIERCES : déclaration, installation, révocation
//
// Deux publics sur les mêmes tables :
//   • le développeur, qui déclare son application et ce qu'elle demande ;
//   • le marchand, qui l'installe en approuvant — ou refuse.
//
// L'écran d'approbation est le point sensible de tout l'édifice : c'est le
// seul endroit où quelqu'un donne accès à ses données. Il doit nommer qui
// demande, ce qui est demandé, et rappeler que ça se reprend en un clic.
// ==========================================================================
const express = require("express");
const router = express.Router();
const apps = require("../services/apps");
const portees = require("../services/portees");
const journalService = require("../services/journalService");
const abonnementService = require("../services/abonnementService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function requireEspace(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    if (!req.session?.workspaceId) return res.redirect("/hub");
    next();
}

// ── CATALOGUE ────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
    try {
        const [publiees, miennes, installees] = await Promise.all([
            apps.listerPubliees(),
            apps.listerDuDeveloppeur(req.session.userId),
            req.session.workspaceId ? apps.listerInstallations(req.session.workspaceId) : [],
        ]);
        res.render("apps", {
            publiees, miennes, installees,
            domaines: portees.parDomaine(),
            aEspace: !!req.session.workspaceId,
        });
    } catch (err) {
        console.error("❌ /apps :", err.message);
        res.status(500).send("Erreur de chargement.");
    }
});

// ── DÉVELOPPEUR : déclarer une application ───────────────────────────────
router.post("/creer", requireAuth, async (req, res) => {
    try {
        const app = await apps.creer(req.session.userId, {
            nom: req.body?.nom,
            description: req.body?.description,
            urlSite: req.body?.urlSite,
            webhookUrl: req.body?.webhookUrl,
            porteesDemandees: req.body?.portees,
        });
        await journalService.log({
            action: "app.creee",
            details: `${app.nom} (${app.slug})`,
            userId: req.session.userId,
        });
        res.json({ success: true, app: { slug: app.slug, nom: app.nom } });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ── MARCHAND : écran d'approbation ───────────────────────────────────────
// Volontairement une page à part, atteignable par un lien que le développeur
// peut envoyer à ses prospects : /apps/<slug>/installer
router.get("/:slug/installer", requireEspace, async (req, res) => {
    try {
        const app = await apps.parSlug(req.params.slug);
        if (!apps.installable(app, req.session.userId)) {
            return res.status(404).send("Application introuvable ou indisponible.");
        }
        const demandees = portees.nettoyer(app.portees_demandees)
            .map(id => ({ id, label: portees.label(id) }));
        res.render("app-installer", {
            app, demandees,
            espaceNom: req.session.nom || "ton espace",
            brouillon: app.statut !== "publiee",
        });
    } catch (err) {
        console.error("❌ /apps/installer :", err.message);
        res.status(500).send("Erreur de chargement.");
    }
});

router.post("/:slug/installer", requireEspace, async (req, res) => {
    try {
        const app = await apps.parSlug(req.params.slug);
        if (!apps.installable(app, req.session.userId)) {
            return res.json({ success: false, error: "Application indisponible." });
        }
        // Installer une application, c'est fabriquer une clé API : même porte,
        // même palier que /developpeurs, sinon l'API s'ouvrirait par ici au
        // palier gratuit alors que la page d'accueil l'annonce à partir d'Actif.
        if (!await abonnementService.auMoins(req.session.workspaceId, "pro")) {
            return res.json({ success: false, error: "Les applications tierces sont incluses à partir du palier Souverain." });
        }
        const { cle, accordees } = await apps.installer(
            app, req.session.workspaceId, req.body?.portees,
        );
        await journalService.log({
            action: "app.installee",
            details: `${app.nom} — ${accordees.join(", ")}`,
            workspaceId: req.session.workspaceId,
            userId: req.session.userId,
        });
        // La clé est remise UNE fois, ici : c'est au marchand de la
        // transmettre à l'application, jamais à nous de l'envoyer nous-mêmes
        // à une URL déclarée par un tiers.
        res.json({ success: true, cle, accordees });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ── MARCHAND : reprendre l'accès ─────────────────────────────────────────
router.post("/installations/:id/revoquer", requireEspace, async (req, res) => {
    const ok = await apps.revoquer(req.session.workspaceId, req.params.id);
    if (ok) {
        await journalService.log({
            action: "app.revoquee",
            details: `installation #${req.params.id}`,
            workspaceId: req.session.workspaceId,
            userId: req.session.userId,
        });
    }
    res.json({ success: ok });
});

module.exports = router;
