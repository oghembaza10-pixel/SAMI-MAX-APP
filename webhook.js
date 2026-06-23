const express = require("express");
const router = express.Router();

router.post("/draft-orders", (req, res) => {
  const draftOrder = req.body;
  console.log("📋 Commande provisoire créée:", draftOrder.id);
  res.status(200).send("OK");
});

router.post("/orders", (req, res) => {
  const order = req.body;
  console.log("✅ Nouvelle commande:", order.id);
  res.status(200).send("OK");
});

module.exports = router;
