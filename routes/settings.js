const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

res.send("⚙ Paramètres SAMII - Bientôt disponible");

});

module.exports = router;
