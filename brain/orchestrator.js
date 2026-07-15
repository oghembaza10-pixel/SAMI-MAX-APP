 /**
 * OG • Brain Orchestrator V2
 * Cerveau central de SAMII — VERSION COMPLÈTE
 */

const E = require("./events");

const commerceEngine   = require("../engines/commerceEngine");
const crmEngine        = require("../engines/crmEngine");
const automationEngine = require("../engines/automationEngine");

// ── TABLE DE ROUTAGE ────────────────────────────────────────
const routes = {

    // ── SHOPIFY APP ───────────────────────────────────────
    [E.SHOP_CONNECTED]        : automationEngine.shopConnected,
    [E.SHOP_UNINSTALLED]      : automationEngine.shopUninstalled,

    // ── SHOPIFY ORDERS ────────────────────────────────────
    [E.ORDER_CREATED]         : commerceEngine.newOrder,
    [E.ORDER_UPDATED]         : commerceEngine.orderUpdated,
    [E.ORDER_PAID]            : commerceEngine.orderPaid,
    [E.ORDER_FULFILLED]       : commerceEngine.orderFulfilled,
    [E.ORDER_DELIVERED]       : commerceEngine.orderDelivered,
    [E.ORDER_CANCELLED]       : commerceEngine.orderCancelled,

    // ── STOCK ─────────────────────────────────────────────
    [E.STOCK_LOW]             : commerceEngine.lowStock,
    [E.STOCK_EMPTY]           : commerceEngine.stockEmpty,

    // ── TELEGRAM ──────────────────────────────────────────
    "telegram.message"        : crmEngine.telegram,
    "telegram.callback"       : crmEngine.telegramCallback,

    // ── WHATSAPP ──────────────────────────────────────────
    "whatsapp.message"        : crmEngine.whatsapp,
    "whatsapp.callback"       : crmEngine.whatsappCallback,

    // ── INSTAGRAM ─────────────────────────────────────────
    "instagram.message"       : crmEngine.instagram,
    "instagram.callback"      : crmEngine.instagramCallback,

    // ── MESSENGER ─────────────────────────────────────────
    "messenger.message"       : crmEngine.messenger,
    "messenger.callback"      : crmEngine.messengerCallback,

    // ── TIKTOK ────────────────────────────────────────────
    "tiktok.message"          : crmEngine.tiktok,

    // ── SNAPCHAT ──────────────────────────────────────────
    "snapchat.message"        : crmEngine.snapchat,

    // ── META WEBHOOK ──────────────────────────────────────
    "meta.webhook"            : crmEngine.metaWebhook,

    // ── GOOGLE ────────────────────────────────────────────
    "google.lead"             : crmEngine.googleLead,
    "google.ads.conversion"   : crmEngine.googleConversion,

    // ── YALIDINE ──────────────────────────────────────────
    "yalidine.status"         : commerceEngine.yalidineStatus,
    "yalidine.delivered"      : commerceEngine.yalidineDelivered,
    "yalidine.returned"       : commerceEngine.yalidineReturned,

    // ── NOTIFICATIONS ─────────────────────────────────────
    [E.NOTIFICATION_SEND]     : automationEngine.notificationRequested,

    // ── CARTES + ABONNEMENTS ──────────────────────────────
    [E.CARTE_ACTIVATED]       : (e) => automationEngine.run("carte.activated", e),
    [E.ABONNEMENT_UPGRADED]   : (e) => automationEngine.run("abonnement.upgraded", e),
    [E.ABONNEMENT_CANCELLED]  : (e) => automationEngine.run("abonnement.cancelled", e),
};

// ── ROUTER ──────────────────────────────────────────────────
async function process(event) {
    console.log(`📥 [${event.shop || "global"}] EVENT : ${event.type}`);

    const handler = routes[event.type];

    if (!handler) {
        console.log(`⚠️ Aucun handler pour : ${event.type}`);
        return;
    }

    try {
        return await handler(event);
    } catch (err) {
        console.error(`❌ Erreur handler [${event.type}] :`, err.message);
    }
}

module.exports = { process };

