// brain/templates/orderFulfilled.js
module.exports = {
    marchand: (d) => `📦 Commande expédiée !\n👤 ${d.customer}\n🚚 En route...`,
    client:   (d) => `Bonjour ${d.customer} 👋\n🚚 Votre colis est en route !\nSuivi : ${d.tracking || "disponible bientôt"}`,
};
