// brain/automations/shop.js
module.exports = {
    "shop.connected": [
        (e) => require("../services/settingsService").createDefault(e.shop),
        (e) => require("../engines/sovereignEngine").initialize(e.shop),
        (e) => require("../services/journalService").log(e.shop, "✅ Boutique connectée"),
        (e) => require("../engines/notificationEngine").send({
            shop: e.shop, channel: "telegram",
            message: require("./templates/shop/connected").marchand({ shop: e.shop })
        }),
    ],
    "shop.uninstalled": [
        (e) => require("../services/settingsService").deactivate(e.shop),
        (e) => require("../services/journalService").log(e.shop, "❌ Boutique déconnectée"),
        (e) => require("../engines/notificationEngine").send({
            shop: e.shop, channel: "telegram",
            message: require("./templates/shop/disconnected").marchand({ shop: e.shop })
        }),
    ],
};
