// brain/templates/orderCancelled.js
module.exports = {
    marchand: (d) => `❌ Commande annulée !\n👤 ${d.customer}\n🆔 #${d.id}`,
    client:   (d) => `Bonjour ${d.customer} 👋\n❌ Votre commande a été annulée.\nContactez-nous pour plus d'informations.`,
};
