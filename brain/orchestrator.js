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
"checkout.created" : commerceEngine.abandonedCheckout.bind(commerceEngine),
    // ── SHOPIFY APP ─────────────────────────────────────
    [E.SHOP_CONNECTED]: (e) => {
        console.log(`✅ Boutique connectée : ${e.shop}`);
    },

    [E.SHOP_UNINSTALLED]: (e) => {
        console.log(`🗑️ Boutique désinstallée : ${e.shop}`);
        // TODO : désactiver la boutique dans Airtable
    },

    // ── SHOPIFY ORDERS ──────────────────────────────────
    [E.ORDER_CREATED]   : commerceEngine.newOrder.bind(commerceEngine),
    [E.ORDER_UPDATED]   : commerceEngine.orderUpdated.bind(commerceEngine),
    [E.ORDER_PAID]      : commerceEngine.orderPaid.bind(commerceEngine),
    [E.ORDER_FULFILLED] : commerceEngine.orderFulfilled.bind(commerceEngine),
    [E.ORDER_DELIVERED] : commerceEngine.orderDelivered.bind(commerceEngine),
    [E.ORDER_CANCELLED] : commerceEngine.orderCancelled.bind(commerceEngine),
    "order.confirmed" : commerceEngine.confirmTelegramOrder.bind(commerceEngine),
    "order.cancelled.telegram" : commerceEngine.cancelTelegramOrder.bind(commerceEngine),

    // ── STOCK ───────────────────────────────────────────
    [E.STOCK_LOW]       : commerceEngine.lowStock.bind(commerceEngine),
    [E.STOCK_EMPTY]     : commerceEngine.stockEmpty.bind(commerceEngine),

    // ── YALIDINE ────────────────────────────────────────
    "yalidine.status"    : commerceEngine.yalidineStatus.bind(commerceEngine),
    "yalidine.delivered" : commerceEngine.yalidineDelivered.bind(commerceEngine),
    "yalidine.returned"  : commerceEngine.yalidineReturned.bind(commerceEngine),

    // ── TELEGRAM ────────────────────────────────────────
    "telegram.message"   : crmEngine.telegram.bind(crmEngine),
    "telegram.callback"  : crmEngine.telegramCallback.bind(crmEngine),

    // ── WHATSAPP ────────────────────────────────────────
    "whatsapp.message"   : crmEngine.whatsapp.bind(crmEngine),
    "whatsapp.callback"  : crmEngine.whatsappCallback.bind(crmEngine),

    // ── INSTAGRAM ───────────────────────────────────────
    "instagram.message"  : crmEngine.instagram.bind(crmEngine),
    "instagram.callback" : crmEngine.instagramCallback.bind(crmEngine),

    // ── MESSENGER ───────────────────────────────────────
    "messenger.message"  : crmEngine.messenger.bind(crmEngine),
    "messenger.callback" : crmEngine.messengerCallback.bind(crmEngine),

    // ── TIKTOK ──────────────────────────────────────────
    "tiktok.message"     : crmEngine.tiktok.bind(crmEngine),

    // ── SNAPCHAT ────────────────────────────────────────
    "snapchat.message"   : crmEngine.snapchat.bind(crmEngine),

    // ── META ────────────────────────────────────────────
    "meta.webhook"       : crmEngine.metaWebhook.bind(crmEngine),

    // ── GOOGLE ──────────────────────────────────────────
    "google.lead"            : crmEngine.googleLead.bind(crmEngine),
    "google.ads.conversion"  : crmEngine.googleConversion.bind(crmEngine),

    // ── NOTIFICATIONS ───────────────────────────────────
    [E.NOTIFICATION_SEND] : automationEngine.notificationRequested.bind(automationEngine),

    // ── CARTES / ABONNEMENTS ────────────────────────────
    [E.CARTE_ACTIVATED]      : (e) => automationEngine.run("carte.activated", e),
    [E.ABONNEMENT_UPGRADED]  : (e) => automationEngine.run("abonnement.upgraded", e),
    [E.ABONNEMENT_CANCELLED] : (e) => automationEngine.run("abonnement.cancelled", e),
};

// ── ROUTER ─────────────────────────────────────────────
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
