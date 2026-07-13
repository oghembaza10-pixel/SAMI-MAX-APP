// brain/templates/orderCreated.js
module.exports = {
    marchand: (d) => `🛒 Nouvelle commande !\n👤 ${d.customer}\n📦 ${d.product || "Voir détails"}\n💰 ${d.total}\n🆔 #${d.id}`,
    client:   (d) => `Bonjour ${d.customer} 👋\n✅ Votre commande a bien été reçue !\n💰 Total : ${d.total}\nNous vous contacterons très bientôt 🙏`,
};
