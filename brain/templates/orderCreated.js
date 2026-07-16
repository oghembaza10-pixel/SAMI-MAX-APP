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
        return (
            `Bonjour ${prenom} 👋\n\n` +
            `Merci pour votre commande ! 🙏\n\n` +
            `📦 *${produits}*\n` +
            `💰 *Total :* ${total} DZD\n\n` +
            `Pouvez-vous confirmer votre commande ?\n\n` +
            `Répondez *OUI* pour confirmer ✅\n` +
            `Répondez *NON* pour annuler ❌`
        );
    },
};
