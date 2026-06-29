const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

res.send("👤 Profil SAMII - Bientôt disponible");

});

module.exports = router;
