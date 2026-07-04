const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

res.send("🍽️ Restaurants SAMII - Bientôt disponible");

});

module.exports = router;
