const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

res.send("🚌 Transport SAMII - Bientôt disponible");

});

module.exports = router;
