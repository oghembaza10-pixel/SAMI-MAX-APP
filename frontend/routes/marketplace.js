const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

res.send("🏪 Marketplace SAMII - Bientôt disponible");

});

module.exports = router;
