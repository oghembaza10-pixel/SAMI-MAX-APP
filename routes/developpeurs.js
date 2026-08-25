// ==========================================================================
// SAMII OS — Espace développeur du marchand
//
// C'est ici que le marchand (ou l'agence qui l'accompagne) fabrique ses clés
// API et déclare les URL à prévenir quand quelque chose se passe dans son
// espace. Tout est borné à SON espace de travail : la session décide du
// workspace, jamais un paramètre envoyé par le navigateur.
// ==========================================================================
const express = require("express");
const router = express.Router();
const apiPartenaire = require("../services/apiPartenaire");
const portees = require("../services/portees");
const abonnementService = require("../services/abonnementService");

// L'API publique et les webhooks sont annoncés au palier Souverain sur la
// page d'accueil : ils doivent donc être fermés en dessous, sinon la vitrine
// ment. La page reste visible aux paliers inférieurs — c'est elle qui donne
// envie — mais fabriquer une clé ou un webhook demande le palier.
const PALIER_MINIMUM_API = "pro";
const REFUS_PALIER = "L'API et les webhooks sont inclus à partir du palier Souverain.";

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    if (!req.session?.workspaceId) return res.redirect("/hub");
    next();
}

router.get("/", requireAuth, async (req, res) => {
    try {
        const [cles, webhooks, acces] = await Promise.all([
            apiPartenaire.listerCles(req.session.workspaceId),
            apiPartenaire.listerWebhooks(req.session.workspaceId),
            apiPartenaire.listerAcces(req.session.workspaceId, 15).catch(() => []),
        ]);
        res.render("developpeurs", {
            cles,
            webhooks,
            acces,
            palierOk: await abonnementService.auMoins(req.session.workspaceId, PALIER_MINIMUM_API),
            domaines: portees.parDomaine(),
            evenements: apiPartenaire.EVENEMENTS,
            workspaceId: req.session.workspaceId,
            baseUrl: `${req.protocol}://${req.get("host")}`,
        });
    } catch (err) {
        console.error("❌ /developpeurs :", err.message);
        res.status(500).send("Erreur de chargement.");
    }
});

// La clé en clair n'existe qu'ici, dans cette réponse. Elle n'est stockée
// nulle part en clair, donc si le marchand la perd il doit en créer une autre.
router.post("/cles", requireAuth, async (req, res) => {
    try {
        // Une clé sans aucune permission serait enregistrée avec portees NULL,
        // ce qui vaut « accès complet » côté base : on refuse ici plutôt que
        // de livrer au marchand l'inverse exact de ce qu'il croit créer.
        if (!await abonnementService.auMoins(req.session.workspaceId, PALIER_MINIMUM_API)) {
            return res.json({ success: false, error: REFUS_PALIER });
        }
        const droits = portees.nettoyer(req.body?.portees);
        if (!droits.length) {
            return res.json({ success: false, error: "Choisis au moins une permission pour cette clé." });
        }
        const cle = await apiPartenaire.creerCle(req.session.workspaceId, req.body?.nom || "Clé API", droits);
        res.json({ success: true, cle });
    } catch (err) {
        console.error("❌ /developpeurs/cles :", err.message);
        res.json({ success: false, error: "Impossible de créer la clé." });
    }
});

router.post("/cles/:id/revoquer", requireAuth, async (req, res) => {
    const ok = await apiPartenaire.revoquerCle(req.session.workspaceId, req.params.id);
    res.json({ success: ok });
});

router.post("/webhooks", requireAuth, async (req, res) => {
    try {
        if (!await abonnementService.auMoins(req.session.workspaceId, PALIER_MINIMUM_API)) {
            return res.json({ success: false, error: REFUS_PALIER });
        }
        const url = String(req.body?.url || "").trim();
        if (!/^https:\/\/.+/i.test(url)) {
            return res.json({ success: false, error: "L'URL doit commencer par https://" });
        }
        const evenements = Array.isArray(req.body?.evenements)
            ? req.body.evenements
            : String(req.body?.evenements || "").split(",").map(e => e.trim()).filter(Boolean);

        const cree = await apiPartenaire.creerWebhook(req.session.workspaceId, { url, evenements });
        res.json({ success: true, webhook: cree });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

router.post("/webhooks/:id/supprimer", requireAuth, async (req, res) => {
    const ok = await apiPartenaire.supprimerWebhook(req.session.workspaceId, req.params.id);
    res.json({ success: ok });
});

module.exports = router;
