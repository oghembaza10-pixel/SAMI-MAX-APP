const commerceEngine = require("../engines/commerceEngine");
const crmEngine = require("../engines/crmEngine");
const notificationEngine = require("../engines/notificationEngine");

async function process(event) {

    console.log("📥 EVENEMENT :", event.type);

    switch(event.type){

        case "shopify.order.created":
            return await commerceEngine.newOrder(event);

        case "telegram.message":
            return await crmEngine.telegram(event);

        case "whatsapp.message":
            return await crmEngine.whatsapp(event);

        case "instagram.message":
            return await crmEngine.instagram(event);

        case "messenger.message":
            return await crmEngine.messenger(event);

        default:
            console.log("Aucun moteur :",event.type);
    }

}

module.exports={
    process
};
