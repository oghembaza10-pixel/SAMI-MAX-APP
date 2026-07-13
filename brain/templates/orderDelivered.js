// brain/templates/orderDelivered.js
module.exports = {
    marchand: (d) => `✅ Commande livrée !\n👤 ${d.customer}\n🆔 #${d.id}`,
    client:   (d) => `Bonjour ${d.customer} 👋\n✅ Votre colis est arrivé !\nMerci de votre confiance 🙏`,
};
