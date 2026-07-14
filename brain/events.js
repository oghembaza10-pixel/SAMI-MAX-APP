// brain/events.js
module.exports = {
    // SHOP
    SHOP_CONNECTED:        "shop.connected",
    SHOP_UNINSTALLED:      "shop.uninstalled",

    // ORDERS
    ORDER_CREATED:         "order.created",
    ORDER_UPDATED:         "order.updated",
    ORDER_PAID:            "order.paid",
    ORDER_FULFILLED:       "order.fulfilled",
    ORDER_DELIVERED:       "order.delivered",
    ORDER_CANCELLED:       "order.cancelled",

    // STOCK
    STOCK_LOW:             "stock.low",
    STOCK_EMPTY:           "stock.empty",

    // CARTES
    CARTE_ACTIVATED:       "carte.activated",

    // ABONNEMENT
    ABONNEMENT_UPGRADED:   "abonnement.upgraded",
    ABONNEMENT_CANCELLED:  "abonnement.cancelled",

    // NOTIFICATIONS
    NOTIFICATION_SEND:     "notification.send",
};
