/**
 * OG • Automation Engine V2
 * Décideur central — exécute les automatisations
 */

const db                 = require("../services/db");
const settingsService    = require("../services/settingsService");
const journalService     = require("../services/journalService");
const notificationEngine = require("./notificationEngine");
const sovereignEngine    = require("./sovereignEngine");

// Écrivait auparavant dans une table Airtable "Commandes" qui n'est plus la
// source réelle — les commandes vivent dans Postgres (voir engines/
// commerceEngine.js pour le chemin de création/confirmation principal).
async function updateStatutCommande(orderId, statut) {
    try {
        const rows = await db.query(`UPDATE commandes SET statut = $1 WHERE id = $2 RETURNING id`, [statut, orderId]);
        if (!rows[0]) return console.warn(`⚠️ Commande ${orderId} introuvable`);
        console.log(`✅ Commande ${orderId} : ${statut}`);
    } catch (err) {
        console.error("❌ updateStatutCommande :", err.message);
    }
}


// ── TEMPLATES ─────────────────────────────────────────────────
const tShopConnected      = require("../brain/templates/shopConnected");
const tOrderCreated       = require("../brain/templates/orderCreated");
const tOrderPaid          = require("../brain/templates/orderPaid");
const tOrderFulfilled     = require("../brain/templates/orderFulfilled");
const tOrderDelivered     = require("../brain/templates/orderDelivered");
const tOrderCancelled     = require("../brain/templates/orderCancelled");
const tStockLow           = require("../brain/templates/stockLow");
const tStockEmpty         = require("../brain/templates/stockEmpty");
const tCarteActivated     = require("../brain/templates/carteActivated");
const tAbonnementUpgraded = require("../brain/templates/abonnementUpgraded");

// ── TABLE DES AUTOMATISATIONS ─────────────────────────────────
const automations = {

    // ── BOUTIQUE ──────────────────────────────────────────────
    "shop.connected": [
        (e) => settingsService.createDefault(e.shop),
        (e) => sovereignEngine.initialize(e.shop),
        (e) => journalService.log(e.shop, "✅ Boutique connectée"),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tShopConnected.marchand({ shop: e.shop }),
        }),
    ],

    "shop.uninstalled": [
        (e) => settingsService.deactivate(e.shop),
        (e) => journalService.log(e.shop, "❌ Boutique déconnectée"),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: `⚠️ Boutique déconnectée : ${e.shop}`,
        }),
    ],

    // ── COMMANDES ─────────────────────────────────────────────
    "order.created": [
        
        (e) => journalService.log(e.shop, `🛒 Commande créée : ${e.payload.id}`),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tOrderCreated.marchand(e.payload),
        }),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "whatsapp",
            to     : e.payload.customer_phone,
            message: tOrderCreated.client(e.payload),
        }),
    ],

    "order.updated": [
        (e) => journalService.log(e.shop, `🔄 Commande mise à jour : ${e.payload.id}`),
    ],

    "order.paid": [
        (e) => journalService.log(e.shop, `💰 Commande payée : ${e.payload.id}`),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tOrderPaid.marchand(e.payload),
        }),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "whatsapp",
            to     : e.payload.customer_phone,
            message: tOrderPaid.client(e.payload),
        }),
    ],

    "order.fulfilled": [
        (e) => journalService.log(e.shop, `📦 Commande expédiée : ${e.payload.id}`),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tOrderFulfilled.marchand(e.payload),
        }),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "whatsapp",
            to     : e.payload.customer_phone,
            message: tOrderFulfilled.client(e.payload),
        }),
    ],

    "order.delivered": [
        (e) => journalService.log(e.shop, `✅ Commande livrée : ${e.payload.id}`),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tOrderDelivered.marchand(e.payload),
        }),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "whatsapp",
            to     : e.payload.customer_phone,
            message: tOrderDelivered.client(e.payload),
        }),
    ],

    // ── CONFIRMATION CLIENT OUI ✅ ─────────────────────────────
    "order.confirmed": [
        (e) => updateStatutCommande(e.payload.orderId, "confirmée"),
        (e) => journalService.log(e.shop || "", `✅ Commande confirmée par client : ${e.payload.orderId}`),
        (e) => notificationEngine.send({
            shop   : e.shop || "",
            channel: "telegram",
            message: `✅ *Commande #${e.payload.orderId} confirmée par le client !*\n\nPréparez l'expédition 📦`,
        }),
    ],

    // ── ANNULATION CLIENT NON ❌ ──────────────────────────────
    "order.cancelled": [
        (e) => updateStatutCommande(e.payload.orderId || e.payload.id, "annulée"),
        (e) => journalService.log(e.shop || "", `❌ Commande annulée : ${e.payload.orderId || e.payload.id}`),
        (e) => notificationEngine.send({
            shop   : e.shop || "",
            channel: "telegram",
            message: tOrderCancelled.marchand(e.payload),
        }),
        (e) => notificationEngine.send({
            shop   : e.shop || "",
            channel: "whatsapp",
            to     : e.payload.customer_phone,
            message: tOrderCancelled.client(e.payload),
        }),
    ],

    // ── STOCK ─────────────────────────────────────────────────
    "stock.low": [
        (e) => journalService.log(e.shop, `⚠️ Stock bas : ${e.payload.product}`),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tStockLow.marchand(e.payload),
        }),
    ],

    "stock.empty": [
        (e) => journalService.log(e.shop, `🚨 Stock épuisé : ${e.payload.product}`),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tStockEmpty.marchand(e.payload),
        }),
    ],

    // ── CARTES SOUVERAINES ────────────────────────────────────
    "carte.activated": [
        (e) => sovereignEngine.activate(e.payload.table, e.shop),
        (e) => journalService.log(e.shop, `🃏 Carte activée : ${e.payload.table}`),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tCarteActivated.marchand(e.payload),
        }),
    ],

    // ── ABONNEMENT ────────────────────────────────────────────
    "abonnement.upgraded": [
        (e) => journalService.log(e.shop, `⬆️ Abonnement upgradé : ${e.payload.plan}`),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tAbonnementUpgraded.marchand(e.payload),
        }),
    ],

    "abonnement.cancelled": [
        (e) => settingsService.downgrade(e.shop),
        (e) => journalService.log(e.shop, "⬇️ Abonnement annulé"),
    ],

    // ── NOTIFICATION DIRECTE ──────────────────────────────────
    "notification.send": [
        (e) => notificationEngine.send(e.payload),
    ],
};

// ── RUNNER ────────────────────────────────────────────────────
async function run(trigger, event) {
    console.log("⚙️ AUTOMATION :", trigger);
    const actions = automations[trigger];
    if (!actions) {
        console.log("⚠️ Aucune automation pour :", trigger);
        return;
    }
    for (const action of actions) {
        try {
            await action(event);
        } catch (err) {
            console.error(`❌ Action échouée [${trigger}] :`, err.message);
        }
    }
}

// ── HANDLERS ─────────────────────────────────────────────────
async function shopConnected(event)         { return run("shop.connected", event); }
async function shopUninstalled(event)       { return run("shop.uninstalled", event); }
async function notificationRequested(event) { return notificationEngine.send(event.payload); }

module.exports = {
    shopConnected,
    shopUninstalled,
    notificationRequested,
    run,
    automations,
};
