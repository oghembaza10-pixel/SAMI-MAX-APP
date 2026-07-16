// brain/templates/orderDelivered.js
module.exports = {
    marchand: (d) =>
        `✅ *Commande livrée !*\n` +
        `👤 *Client :* ${d.customer?.first_name || d.billing_address?.first_name || "Client"} ${d.customer?.last_name || ""}\n` +
        `🆔 *#${d.order_number || d.id}*`,

    client: (d) => {
        const prenom = d.customer?.first_name || d.billing_address?.first_name || "cher client";
        return (
            `Bonjour ${prenom} 👋\n\n` +
            `✅ Votre colis a bien été livré !\n\n` +
            `Nous espérons que vous êtes satisfait de votre commande 😊\n\n` +
            `Si vous avez la moindre question ou remarque,\n` +
            `n'hésitez pas à nous répondre directement ici.\n\n` +
            `Merci de votre confiance 🙏\n` +
            `À très bientôt !`
        );
    },
};
