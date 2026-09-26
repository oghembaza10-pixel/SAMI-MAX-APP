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
        (e) => journalService.log({ action: "shop.connected", details: "Boutique connectée", workspaceId: e.workspaceId }),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tShopConnected.marchand({ shop: e.shop }),
        }),
    ],

    "shop.uninstalled": [
        (e) => settingsService.deactivate(e.shop),
        (e) => journalService.log({ action: "shop.uninstalled", details: "Boutique déconnectée", workspaceId: e.workspaceId }),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: `⚠️ Boutique déconnectée : ${e.shop}`,
        }),
    ],

    // ── COMMANDES ─────────────────────────────────────────────
    "order.created": [
        
        (e) => journalService.log({ action: "order.created", details: `Commande créée : ${e.payload.id}`, workspaceId: e.workspaceId, refId: String(e.payload.id || "") }),
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
        (e) => journalService.log({ action: "order.updated", details: `Commande mise à jour : ${e.payload.id}`, workspaceId: e.workspaceId, refId: String(e.payload.id || "") }),
    ],

    "order.paid": [
        (e) => journalService.log({ action: "order.paid", details: `Commande payée : ${e.payload.id}`, workspaceId: e.workspaceId, refId: String(e.payload.id || ""), montant: Number(e.payload.total_price) || null }),
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
        (e) => journalService.log({ action: "order.fulfilled", details: `Commande expédiée : ${e.payload.id}`, workspaceId: e.workspaceId, refId: String(e.payload.id || "") }),
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
        (e) => journalService.log({ action: "order.delivered", details: `Commande livrée : ${e.payload.id}`, workspaceId: e.workspaceId, refId: String(e.payload.id || "") }),
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
        (e) => journalService.log({ action: "order.confirmed", details: `Commande confirmée par le client : ${e.payload.orderId}`, workspaceId: e.workspaceId, refId: String(e.payload.orderId || "") }),
        (e) => notificationEngine.send({
            shop   : e.shop || "",
            channel: "telegram",
            message: `✅ *Commande #${e.payload.orderId} confirmée par le client !*\n\nPréparez l'expédition 📦`,
        }),
    ],

    // ── ANNULATION CLIENT NON ❌ ──────────────────────────────
    "order.cancelled": [
        (e) => updateStatutCommande(e.payload.orderId || e.payload.id, "annulée"),
        (e) => journalService.log({ action: "order.cancelled", details: `Commande annulée : ${e.payload.orderId || e.payload.id}`, workspaceId: e.workspaceId, refId: String(e.payload.orderId || e.payload.id || "") }),
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
        (e) => journalService.log({ action: "stock.low", details: `Stock bas : ${e.payload.product}`, workspaceId: e.workspaceId }),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tStockLow.marchand(e.payload),
        }),
    ],

    "stock.empty": [
        (e) => journalService.log({ action: "stock.empty", details: `Stock épuisé : ${e.payload.product}`, workspaceId: e.workspaceId }),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tStockEmpty.marchand(e.payload),
        }),
    ],

    // ── CARTES SOUVERAINES ────────────────────────────────────
    "carte.activated": [
        (e) => sovereignEngine.activate(e.payload.table, e.shop),
        (e) => journalService.log({ action: "carte.activated", details: `Carte activée : ${e.payload.table}`, workspaceId: e.workspaceId }),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tCarteActivated.marchand(e.payload),
        }),
    ],

    // ── ABONNEMENT ────────────────────────────────────────────
    "abonnement.upgraded": [
        (e) => journalService.log({ action: "abonnement.upgraded", details: `Abonnement passé à : ${e.payload.plan}`, workspaceId: e.workspaceId }),
        (e) => notificationEngine.send({
            shop   : e.shop,
            channel: "telegram",
            message: tAbonnementUpgraded.marchand(e.payload),
        }),
    ],

    "abonnement.cancelled": [
        (e) => settingsService.downgrade(e.shop),
        (e) => journalService.log({ action: "abonnement.cancelled", details: "Abonnement annulé", workspaceId: e.workspaceId }),
    ],

    // ── NOTIFICATION DIRECTE ──────────────────────────────────
    "notification.send": [
        (e) => notificationEngine.send(e.payload),
    ],
};

// ══════════════════════════════════════════════════════════════════════════
// À QUEL QG APPARTIENT CET ÉVÉNEMENT — RÉSOLU UNE FOIS, ICI
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ `event.shop` N'EST PAS UN IDENTIFIANT DE QG.
//
// C'est le domaine Shopify (« xyz.myshopify.com »). Dans
// `engines/commerceEngine.js`, `shop` et `workspaceId` sont deux variables
// DIFFÉRENTES de la même fonction, reliées par `getWorkspaceIdForShop()`.
//
// Les quatorze écritures de journal de ce fichier passaient `e.shop` là où
// le journal attend un `workspaceId`. Corriger seulement la FORME de l'appel
// (chantier F) aurait écrit le domaine Shopify dans `workspace_id` : les
// lignes auraient existé, et aucune page filtrant par QG ne les aurait
// jamais trouvées. Un demi-correctif est ici indiscernable d'un correctif.
//
// ── POURQUOI DANS `run()` ET PAS DANS CHAQUE APPELANT ────────────────────
//
// `run()` est le seul passage obligé : les neuf déclencheurs vivants y
// passent tous, y compris les trois appelés directement depuis
// `brain/orchestrator.js` (carte activée, abonnement modifié), qui n'ont
// aucun `workspaceId` sous la main. Résoudre chez chaque appelant aurait
// laissé ceux-là écrire des domaines Shopify, et il aurait fallu y penser à
// chaque nouvel appelant. Un axe, une expression, un endroit où se tromper.
//
// Un appelant qui connaît DÉJÀ son QG le passe (`commerceEngine.newOrder` le
// calcule pour insérer la commande) : on ne relit pas la base pour rien.
//
// ── ET SI ON NE TROUVE PAS ───────────────────────────────────────────────
//
// `null`, jamais le domaine en repli. Une ligne sans QG est honnêtement
// orpheline et se voit ; une ligne rattachée à un faux QG se lit comme vraie.
// C'est la même règle que pour la forme de l'appel (voir journalService).
async function qgDeLEvenement(event) {
    if (event?.workspaceId) return event.workspaceId;
    if (!event?.shop) return null;
    try {
        const boutiques = require("../services/shopifyBoutiqueService");
        const workspace = await boutiques.findByShopUrl(event.shop);
        return workspace?.id || null;
    } catch (err) {
        console.warn("⚠️ automation : QG introuvable pour", event.shop, "—", err.message);
        return null;
    }
}

// ── RUNNER ────────────────────────────────────────────────────
async function run(trigger, event) {
    console.log("⚙️ AUTOMATION :", trigger);
    const actions = automations[trigger];
    if (!actions) {
        console.log("⚠️ Aucune automation pour :", trigger);
        return;
    }

    // Résolu AVANT la boucle, et posé sur l'événement : les actions le
    // lisent toutes (`e.workspaceId`) sans qu'aucune ne relise la base.
    event = { ...(event || {}), workspaceId: await qgDeLEvenement(event) };
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
    // Exporté pour que `tests/journal.test.js` éprouve la résolution du QG
    // sans avoir à faire tourner tout le bus.
    qgDeLEvenement,
};
