const commerce = require("./commerceEngine");
const crm = require("./crmEngine");
const delivery = require("./deliveryEngine");
const marketing = require("./marketingEngine");
const analytics = require("./analyticsEngine");
const automation = require("./automationEngine");
const notification = require("./notificationEngine");
const search = require("./searchEngine");
const vision = require("./visionEngine");
const wallet = require("./walletEngine");

module.exports = {
    commerce,
    crm,
    delivery,
    marketing,
    analytics,
    automation,
    notification,
    search,
    vision,
    wallet
};
