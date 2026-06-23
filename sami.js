async function parlerAvecSamy(commande) {

  console.log("Samy analyse :", commande.id);

  return {
    statut: "CONFIRMEE",
    message: `Commande ${commande.id} reçue`
  };

}

module.exports = parlerAvecSamy;
