// brain/automations/abonnement.js
module.exports = {
    "abonnement.upgraded": [
        (e) => require("../services/journalService").log(e.shop, `⬆️ Plan : ${e.payload.plan}`),
        (e) => require("../engines/notificationEngine").send({ shop: e.shop, channel: "telegram",
            message: require("../templates/subscription/upgraded").marchand(e.payload) }),
    ],
    "abonnement.cancelled": [
        (e) => require("../services/settingsService").downgrade(e.shop),
        (e) => require("../services/journalService").log(e.shop, "⬇️ Abonnement annulé"),
    ],
};
