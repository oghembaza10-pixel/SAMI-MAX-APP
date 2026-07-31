// ==========================================================================
// SAMII OS — CLIENT QG — Grille de routes centralisée
// ==========================================================================
const express = require("express");
const router  = express.Router();

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// ── PAGE PRINCIPALE ────────────────────────────────────
router.get("/", requireAuth, (req, res) => {
    res.render("client-qg", {
        nom: req.session.nom || "",
        codeParrainage: req.session.userId || "",
    });
});

router.get("/quota", requireAuth, (req, res) => {
    res.json({ success: true, restant: 50, total: 50 });
});

// ── SOUS-ROUTES (chaque carte a son propre fichier) ────
router.use("/transport", require("./client-transport"));
router.use("/traducteur", require("./client-traducteur"));
// router.use("/devoirs", require("./client-devoirs"));        // à venir
// router.use("/pratique", require("./client-pratique"));      // à venir

module.exports = router;
