const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

res.send("🏭 Espace Fournisseurs - Bientôt disponible");

});

module.exports = router;
