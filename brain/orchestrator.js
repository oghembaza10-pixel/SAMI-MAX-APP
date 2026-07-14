/**
 * OG • Brain Orchestrator
 * Cerveau central de SAMII
 * Rôle unique : router les événements
 */

const E = require("./events");

const commerceEngine     = require("../engines/commerceEngine");
const crmEngine          = require("../engines/crmEngine");
const automationEngine   = require("../engines/automationEngine");

// ── TABLE DE ROUTAGE ────────────────────────────────────────
const routes = {

    // SHOPIFY APP
    [E.SHOP_CONNECTED]        : automationEngine.shopConnected,
    [E.SHOP_UNINSTALLED]      : automationEngine.shopUninstalled,

    // SHOPIFY ORDERS
    [E.ORDER_CREATED]         : commerceEngine.newOrder,
    [E.ORDER_UPDATED]         : commerceEngine.orderUpdated,
    [E.ORDER_PAID]            : commerceEngine.orderPaid,
    [E.ORDER_FULFILLED]       : commerceEngine.orderFulfilled,
    [E.ORDER_DELIVERED]       : commerceEngine.orderDelivered,
    [E.ORDER_CANCELLED]       : commerceEngine.orderCancelled,

    // STOCK
    [E.STOCK_LOW]             : commerceEngine.lowStock,
    [E.STOCK_EMPTY]           : commerceEngine.stockEmpty,

    // CRM MESSAGES ENTRANTS
    "telegram.message"        : crmEngine.telegram,
    "whatsapp.message"        : crmEngine.whatsapp,
    "instagram.message"       : crmEngine.instagram,
    "messenger.message"       : crmEngine.messenger,
    "tiktok.message"          : crmEngine.tiktok,
    "snapchat.message"        : crmEngine.snapchat,

    // NOTIFICATIONS
    [E.NOTIFICATION_SEND]     : automationEngine.notificationRequested,

    // CARTES + ABONNEMENT
    [E.CARTE_ACTIVATED]       : (e) => automationEngine.run("carte.activated", e),
    [E.ABONNEMENT_UPGRADED]   : (e) => automationEngine.run("abonnement.upgraded", e),
    [E.ABONNEMENT_CANCELLED]  : (e) => automationEngine.run("abonnement.cancelled", e),
};

// ── ROUTER ──────────────────────────────────────────────────
async function process(event) {
    console.log("📥 EVENEMENT :", event.type);

    const handler = routes[event.type];

    if (!handler) {
        console.log("⚠️ Aucun moteur pour :", event.type);
        return;
    }

    return await handler(event);
}

module.exports = { process };
