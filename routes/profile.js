const express = require("express");

const router = express.Router();

// /profile est un ancien lien mort — la vraie page profil (public + édition)
// vit dans routes/vitrine.js. On redirige vers sa propre vitrine publique,
// qui affiche déjà un bouton "Modifier ma vitrine" quand c'est soi-même.
router.get("/", (req, res) => {
    if (!req.session?.userId) return res.redirect("/login");
    res.redirect(`/vitrine/${req.session.userId}`);
});

module.exports = router;
