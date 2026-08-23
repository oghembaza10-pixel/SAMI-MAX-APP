/**
 * OG • Brain Orchestrator V2
 * Cerveau central de SAMII — VERSION COMPLÈTE
 */

const axios = require("axios");
const E = require("./events");

const commerceEngine   = require("../engines/commerceEngine");
const crmEngine        = require("../engines/crmEngine");
const automationEngine = require("../engines/automationEngine");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_BOUTIQUES  = process.env.TABLE_BOUTIQUES;

async function desactiverBoutique(shop) {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !TABLE_BOUTIQUES) return;
    const headers = { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" };
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}?filterByFormula={shop_url}="${shop}"`;
    const search = await axios.get(searchUrl, { headers });
    const record = search.data.records[0];
    if (!record) {
        console.warn(`⚠️ Désinstallation : boutique introuvable dans Airtable — ${shop}`);
        return;
    }
    await axios.patch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}/${record.id}`,
        { fields: { status: "inactif", webhooks_actifs: false } },
        { headers }
    );
    console.log(`✅ Boutique désactivée dans Airtable : ${shop}`);
}

// ── TABLE DE ROUTAGE ────────────────────────────────────────
const routes = {
"checkout.created" : commerceEngine.abandonedCheckout.bind(commerceEngine),
    // ── SHOPIFY APP ─────────────────────────────────────
    [E.SHOP_CONNECTED]: (e) => {
        console.log(`✅ Boutique connectée : ${e.shop}`);
    },

    [E.SHOP_UNINSTALLED]: async (e) => {
        console.log(`🗑️ Boutique désinstallée : ${e.shop}`);
        try {
            await desactiverBoutique(e.shop);
        } catch (err) {
            console.error("❌ Désactivation boutique Airtable :", err.response?.data || err.message);
        }
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
