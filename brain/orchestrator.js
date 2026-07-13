/**
 * OG • Brain Orchestrator
 * Cerveau central de SAMII
 * Rôle unique : router les événements
 */

const commerceEngine     = require("../engines/commerceEngine");
const crmEngine          = require("../engines/crmEngine");
const automationEngine   = require("../engines/automationEngine");

// ── TABLE DE ROUTAGE ────────────────────────────────────────
const routes = {

    // SHOPIFY ORDERS
    "shopify.order.created"   : commerceEngine.newOrder,
    "shopify.order.updated"   : commerceEngine.orderUpdated,
    "shopify.order.cancelled" : commerceEngine.orderCancelled,
    "shopify.order.fulfilled" : commerceEngine.orderFulfilled,

    // SHOPIFY STOCK
    "shopify.stock.low"       : commerceEngine.lowStock,

    // SHOPIFY APP
    "shopify.connected"       : automationEngine.shopConnected,
    "shopify.uninstalled"     : automationEngine.shopUninstalled,

    // CRM MESSAGES ENTRANTS
    "telegram.message"        : crmEngine.telegram,
    "whatsapp.message"        : crmEngine.whatsapp,
    "instagram.message"       : crmEngine.instagram,
    "messenger.message"       : crmEngine.messenger,
    "tiktok.message"          : crmEngine.tiktok,
    "snapchat.message"        : crmEngine.snapchat,

    // NOTIFICATIONS SORTANTES
    "notification.send"       : automationEngine.notificationRequested,
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
