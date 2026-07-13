/**
 * OG • Automation Engine
 * Décideur central — exécute les automatisations
 */

const settingsService    = require("../services/settingsService");
const journalService     = require("../services/journalService");
const notificationEngine = require("./notificationEngine");
const sovereignEngine    = require("./sovereignEngine");
const airtable           = require("../services/airtableService");

// ── TABLE DES AUTOMATISATIONS ────────────────────────────────
// Chaque trigger → liste d'actions dans l'ordre
const automations = {

    "shop.connected": [
        (e) => settingsService.createDefault(e.shop),
        (e) => sovereignEngine.initialize(e.shop),
        (e) => journalService.log(e.shop, "✅ Boutique connectée"),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "telegram",
            message: `👑 Boutique connectée !\n🏪 ${e.shop}\n✅ SAMII est opérationnel.`
        }),
    ],

    "shop.uninstalled": [
        (e) => settingsService.deactivate(e.shop),
        (e) => journalService.log(e.shop, "❌ Boutique déconnectée"),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "telegram",
            message: `⚠️ Boutique déconnectée : ${e.shop}`
        }),
    ],

    "order.created": [
        (e) => journalService.log(e.shop, `🛒 Commande créée : ${e.payload.id}`),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "telegram",
            message: `🛒 Nouvelle commande !\n👤 ${e.payload.customer}\n💰 ${e.payload.total}`
        }),
    ],

    "order.cancelled": [
        (e) => journalService.log(e.shop, `❌ Commande annulée : ${e.payload.id}`),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "telegram",
            message: `❌ Commande annulée : ${e.payload.id}`
        }),
    ],
};

// ── RUNNER ───────────────────────────────────────────────────
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
            // Continue — une action échouée ne bloque pas les suivantes
        }
    }
}

// ── HANDLERS appelés par Orchestrator ───────────────────────
async function shopConnected(event)         { return run("shop.connected", event); }
async function shopUninstalled(event)       { return run("shop.uninstalled", event); }
async function notificationRequested(event) { return notificationEngine.send(event.payload); }

module.exports = { shopConnected, shopUninstalled, notificationRequested, run };
