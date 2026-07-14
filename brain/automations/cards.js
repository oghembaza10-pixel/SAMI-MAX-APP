// brain/automations/cards.js
module.exports = {
    "carte.activated": [
        (e) => require("../engines/sovereignEngine").activate(e.payload.table, e.shop),
        (e) => require("../services/journalService").log(e.shop, `🃏 Carte : ${e.payload.table}`),
        (e) => require("../engines/notificationEngine").send({ shop: e.shop, channel: "telegram",
            message: require("../templates/cards/activated").marchand(e.payload) }),
    ],
};
