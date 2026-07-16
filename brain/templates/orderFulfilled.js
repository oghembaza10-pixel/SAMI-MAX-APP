module.exports = {
    marchand: (d) =>
        `📦 *Commande expédiée !*\n` +
        `👤 *Client :* ${d.customer?.first_name || d.billing_address?.first_name || "Client"} ${d.customer?.last_name || ""}\n` +
        `🚚 *Transporteur :* ${d.fulfillments?.[0]?.tracking_company || "N/A"}\n` +
        `🔍 *Tracking :* ${d.fulfillments?.[0]?.tracking_number || "N/A"}`,

    client: (d) => {
        const prenom   = d.customer?.first_name || d.billing_address?.first_name || "cher client";
        const tracking = d.fulfillments?.[0]?.tracking_number || "disponible bientôt";
        const carrier  = d.fulfillments?.[0]?.tracking_company || "";
        return (
            `Bonjour ${prenom} 👋\n\n` +
            `🚚 Bonne nouvelle ! Votre colis est en route !\n\n` +
            `📦 *Transporteur :* ${carrier}\n` +
            `🔍 *Numéro de suivi :* ${tracking}\n\n` +
            `Vous serez livré très prochainement.\n` +
            `N'hésitez pas à nous contacter si vous avez des questions 😊`
        );
    },
};
