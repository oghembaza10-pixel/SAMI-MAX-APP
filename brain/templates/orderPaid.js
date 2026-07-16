module.exports = {
    marchand: (d) =>
        `💰 *Paiement reçu !*\n` +
        `👤 *Client :* ${d.customer?.first_name || d.billing_address?.first_name || "Client"} ${d.customer?.last_name || ""}\n` +
        `💵 *Total :* ${d.total_price || "0"} DZD\n` +
        `🆔 *#${d.order_number || d.id}*`,

    client: (d) => {
        const prenom = d.customer?.first_name || d.billing_address?.first_name || "cher client";
        return (
            `Bonjour ${prenom} 👋\n\n` +
            `✅ Votre paiement a bien été reçu !\n\n` +
            `Nous préparons votre commande avec soin 📦\n` +
            `Vous recevrez une notification dès l'expédition.\n\n` +
            `Merci de votre confiance 🙏`
        );
    },
};

