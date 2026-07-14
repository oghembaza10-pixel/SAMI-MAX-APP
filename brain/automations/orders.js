// brain/automations/orders.js
const n = () => require("../engines/notificationEngine");
const j = () => require("../services/journalService");

module.exports = {
    "order.created": [
        (e) => j().log(e.shop, `🛒 Commande créée : ${e.payload.id}`),
        (e) => n().send({ shop: e.shop, channel: "telegram",
            message: require("../templates/shopify/orderCreated").marchand(e.payload) }),
        (e) => n().send({ shop: e.shop, channel: "whatsapp", to: e.payload.customer_phone,
            message: require("../templates/shopify/orderCreated").client(e.payload) }),
    ],
    "order.paid": [
        (e) => j().log(e.shop, `💰 Payée : ${e.payload.id}`),
        (e) => n().send({ shop: e.shop, channel: "telegram",
            message: require("../templates/shopify/orderPaid").marchand(e.payload) }),
        (e) => n().send({ shop: e.shop, channel: "whatsapp", to: e.payload.customer_phone,
            message: require("../templates/shopify/orderPaid").client(e.payload) }),
    ],
    "order.fulfilled": [
        (e) => j().log(e.shop, `📦 Expédiée : ${e.payload.id}`),
        (e) => n().send({ shop: e.shop, channel: "telegram",
            message: require("../templates/shopify/orderFulfilled").marchand(e.payload) }),
        (e) => n().send({ shop: e.shop, channel: "whatsapp", to: e.payload.customer_phone,
            message: require("../templates/shopify/orderFulfilled").client(e.payload) }),
    ],
    "order.delivered": [
        (e) => j().log(e.shop, `✅ Livrée : ${e.payload.id}`),
        (e) => n().send({ shop: e.shop, channel: "telegram",
            message: require("../templates/shopify/orderDelivered").marchand(e.payload) }),
        (e) => n().send({ shop: e.shop, channel: "whatsapp", to: e.payload.customer_phone,
            message: require("../templates/shopify/orderDelivered").client(e.payload) }),
    ],
    "order.cancelled": [
        (e) => j().log(e.shop, `❌ Annulée : ${e.payload.id}`),
        (e) => n().send({ shop: e.shop, channel: "telegram",
            message: require("../templates/shopify/orderCancelled").marchand(e.payload) }),
        (e) => n().send({ shop: e.shop, channel: "whatsapp", to: e.payload.customer_phone,
            message: require("../templates/shopify/orderCancelled").client(e.payload) }),
    ],
    "order.updated": [
        (e) => j().log(e.shop, `🔄 Mise à jour : ${e.payload.id}`),
    ],
};
