// brain/templates/orderPaid.js
module.exports = {
    marchand: (d) => `💰 Paiement reçu !\n👤 ${d.customer}\n💵 ${d.total}\n🆔 #${d.id}`,
    client:   (d) => `Bonjour ${d.customer} 👋\n✅ Paiement confirmé !\nMerci pour votre confiance 🙏`,
};
