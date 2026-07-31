// ==========================================================================
// SAMII OS — CLIENT QG — Espace personnel pour les comptes Particulier
// ==========================================================================
const express = require("express");
const router  = express.Router();

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/", requireAuth, (req, res) => {
    res.render("client-qg", {
        nom: req.session.nom || "",
        codeParrainage: req.session.userId || "",
    });
});

// ── Quota messages — pour l'instant valeur fixe, sera branché ensuite ──
router.get("/quota", requireAuth, (req, res) => {
    res.json({ success: true, restant: 50, total: 50 });
});

module.exports = router;
