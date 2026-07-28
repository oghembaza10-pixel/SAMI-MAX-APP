const express = require("express");
const router   = express.Router();

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/connecter", requireAuth, (req, res) => {
    res.redirect("/connect/tools");
});

router.get("/outils", requireAuth, (req, res) => {
    res.redirect("/connect/tools");
});

module.exports = router;
