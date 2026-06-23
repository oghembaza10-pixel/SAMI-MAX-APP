const express = require("express");
const router = express.Router();

const parlerAvecSamy = require("./samy");

router.post("/order", async (req, res) => {

  const commande = req.body;

  console.log("Commande reçue");

  const resultat = await parlerAvecSamy(commande);

  console.log(resultat);

  res.status(200).json(resultat);

});

module.exports = router;
// Webhook - Commande provisoire créée
app.post('/webhook/draft-orders', express.json(), (req, res) => {
  const draftOrder = req.body;
  console.log('📋 Commande provisoire créée:', draftOrder.id);
  // Votre logique ici
  res.status(200).send('OK');
});

// Webhook - Commande créée
app.post('/webhook/orders', express.json(), (req, res) => {
  const order = req.body;
  console.log('✅ Nouvelle commande:', order.id, '- Client:', order.email);
  // Votre logique ici
  res.status(200).send('OK');
});
