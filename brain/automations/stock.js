// brain/automations/stock.js
module.exports = {
    "stock.low": [
        (e) => require("../services/journalService").log(e.shop, `⚠️ Stock bas : ${e.payload.product}`),
        (e) => require("../engines/notificationEngine").send({ shop: e.shop, channel: "telegram",
            message: require("../templates/stock/low").marchand(e.payload) }),
    ],
    "stock.empty": [
        (e) => require("../services/journalService").log(e.shop, `🚨 Stock épuisé : ${e.payload.product}`),
        (e) => require("../engines/notificationEngine").send({ shop: e.shop, channel: "telegram",
            message: require("../templates/stock/empty").marchand(e.payload) }),
    ],
};
