// brain/templates/orderCancelled.js
module.exports = {
    marchand: (d) =>
        `❌ *Commande annulée*\n` +
        `👤 *Client :* ${d.customer?.first_name || d.billing_address?.first_name || "Client"} ${d.customer?.last_name || ""}\n` +
        `💬 *Raison :* ${d.cancel_reason || "Non précisée"}\n` +
        `🆔 *#${d.order_number || d.id}*`,

    client: (d) => {
        const prenom = d.customer?.first_name || d.billing_address?.first_name || "cher client";
        return (
            `Bonjour ${prenom} 👋\n\n` +
            `Votre commande a bien été annulée.\n\n` +
            `Si c'est une erreur ou si vous souhaitez recommander,\n` +
            `répondez-nous ici et nous vous aiderons immédiatement 😊\n\n` +
            `À bientôt !`
        );
    },
};
