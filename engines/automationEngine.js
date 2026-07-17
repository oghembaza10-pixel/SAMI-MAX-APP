/**
 * OG • Automation Engine V2
 * Décideur central — exécute les automatisations
 */

const axios              = require("axios");
const airtable           = require("../services/airtable");
const settingsService    = require("../services/settingsService");
const journalService     = require("../services/journalService");
const notificationEngine = require("./notificationEngine");
const sovereignEngine    = require("./sovereignEngine");

// ── AIRTABLE ──────────────────────────────────────────────────
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_COMMANDES  = process.env.TABLE_COMMANDES || "Commandes";

async function updateStatutCommande(orderId, statut) {
    try {
        const headers = {
            Authorization : `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        };
        const search = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_COMMANDES}`,
            {
                headers,
                params: { filterByFormula: `{ID Commande}="${orderId}"` }
            }
        );
        const record = search.data.records[0];
        if (!record) return console.warn(`⚠️ Commande ${orderId} introuvable`);

        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_COMMANDES}/${record.id}`,
            { fields: { Statut: statut } },
            { headers }
        );
        console.log(`✅ Airtable → Commande ${orderId} : ${statut}`);
    } catch (err) {
        console.error("❌ updateStatutCommande :", err.message);
    }
}

// ── SAVE COMMANDE ─────────────────────────────────────────────
async function saveCommande(e) {
    const p = e.payload;
    try {
        await airtable.create("COMMANDES", {
            "ID Commande"  : String(p.order_number || p.id || ""),
            "Boutique"     : e.shop || "",
            "Nom Client"   : `${p.customer?.first_name || ""} ${p.customer?.last_name || ""}`.trim() || "Inconnu",
            "Téléphone"    : p.customer?.phone || p.billing_address?.phone || "",
            "Adresse"      : p.shipping_address
                                ? `${p.shipping_address.address1 || ""}, ${p.shipping_address.city || ""}`
                                : "",
            "Produit"      : (p.line_items || []).map(i => i.title).join(", ") || "—",
            "Total"        : parseFloat(p.total_price || 0),
            "Devise"       : p.currency || "DZD",
            "Statut"       : "en attente",
            "Date Commande": new Date().toISOString(),
        });
        console.log(`✅ Commande #${p.order_number} sauvegardée dans Airtable`);
    } catch (err) {
        console.error("❌ saveCommande :", err.message);
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
        (e) => saveCommande(e),
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
