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
