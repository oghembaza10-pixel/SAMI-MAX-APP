// brain/templates/orderCreated.js

function getLangue(order) {
    const pays = order.billing_address?.country_code || "DZ";
    const langues = {
        "DZ": "ar",
        "MA": "ar",
        "TN": "ar",
        "FR": "fr",
        "BE": "fr",
    };
    return langues[pays] || "fr";
}

module.exports = {
    marchand: (d) =>
        `🛒 *Nouvelle commande !*\n` +
        `👤 *Client :* ${d.customer?.first_name || d.billing_address?.first_name || "Client"} ${d.customer?.last_name || d.billing_address?.last_name || ""}\n` +
        `📦 *Produits :* ${d.line_items?.map(i => i.title).join(", ") || "Voir détails"}\n` +
        `💰 *Total :* ${d.total_price || "0"} DZD\n` +
        `🆔 *#${d.order_number || d.id}*`,

    client: (d) => {
        const prenom = d.customer?.first_name || d.billing_address?.first_name || "cher client";
        const total  = d.total_price || "0";
        const produits = d.line_items?.map(i => i.title).join(", ") || "";
        const langue = getLangue(d);

        if (langue === "ar") return (
            `السلام عليكم ${prenom} 👋\n\n` +
            `شكراً على طلبك ! 🙏\n\n` +
            `📦 *${produits}*\n` +
            `💰 *المبلغ :* ${total} دج\n\n` +
            `هل تؤكد طلبك ؟\n\n` +
            `اكتب *نعم* للتأكيد ✅\n` +
            `اكتب *لا* للإلغاء ❌`
        );

        return (
            `Bonjour ${prenom} 👋\n\n` +
            `Merci pour votre commande ! 🙏\n\n` +
            `📦 *${produits}*\n` +
            `💰 *Total :* ${total} DZD\n\n` +
            `Répondez *OUI* pour confirmer ✅\n` +
            `Répondez *NON* pour annuler ❌`
        );
    },
};
