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
const automations = {

    // ── BOUTIQUE ─────────────────────────────────────────────
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

    // ── COMMANDES ─────────────────────────────────────────────
    "order.created": [
        (e) => journalService.log(e.shop, `🛒 Commande créée : ${e.payload.id}`),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "telegram",
            message: `🛒 Nouvelle commande !\n👤 ${e.payload.customer}\n💰 ${e.payload.total}`
        }),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "whatsapp",
            to: e.payload.customer_phone,
            message: `Bonjour ${e.payload.customer} 👋\n✅ Votre commande a bien été reçue !\n📦 ${e.payload.product}\nNous vous contacterons très bientôt 🙏`
        }),
    ],

    "order.updated": [
        (e) => journalService.log(e.shop, `🔄 Commande mise à jour : ${e.payload.id}`),
    ],

    "order.paid": [
        (e) => journalService.log(e.shop, `💰 Commande payée : ${e.payload.id}`),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "telegram",
            message: `💰 Paiement reçu !\n👤 ${e.payload.customer}\n💵 ${e.payload.total}`
        }),
    ],

    "order.fulfilled": [
        (e) => journalService.log(e.shop, `📦 Commande expédiée : ${e.payload.id}`),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "telegram",
            message: `📦 Commande expédiée !\n👤 ${e.payload.customer}\n🚚 En route...`
        }),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "whatsapp",
            to: e.payload.customer_phone,
            message: `Bonjour ${e.payload.customer} 👋\n🚚 Votre colis est en route !\nSuivi : ${e.payload.tracking || "disponible bientôt"}`
        }),
    ],

    "order.cancelled": [
        (e) => journalService.log(e.shop, `❌ Commande annulée : ${e.payload.id}`),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "telegram",
            message: `❌ Commande annulée : ${e.payload.id}`
        }),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "whatsapp",
            to: e.payload.customer_phone,
            message: `Bonjour ${e.payload.customer} 👋\n❌ Votre commande a été annulée.\nContactez-nous pour plus d'informations.`
        }),
    ],

    "order.delivered": [
        (e) => journalService.log(e.shop, `✅ Commande livrée : ${e.payload.id}`),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "whatsapp",
            to: e.payload.customer_phone,
            message: `Bonjour ${e.payload.customer} 👋\n✅ Votre colis est arrivé !\nMerci de votre confiance 🙏`
        }),
    ],

    // ── STOCK ─────────────────────────────────────────────────
    "stock.low": [
        (e) => journalService.log(e.shop, `⚠️ Stock bas : ${e.payload.product}`),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "telegram",
            message: `⚠️ Stock bas !\n📦 ${e.payload.product}\n🔢 Reste : ${e.payload.quantity}`
        }),
    ],

    "stock.empty": [
        (e) => journalService.log(e.shop, `🚨 Stock épuisé : ${e.payload.product}`),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "telegram",
            message: `🚨 STOCK ÉPUISÉ !\n📦 ${e.payload.product}\n→ Réapprovisionner immédiatement`
        }),
    ],

    // ── CARTES SOUVERAINES ────────────────────────────────────
    "carte.activated": [
        (e) => sovereignEngine.activate(e.payload.table, e.shop),
        (e) => journalService.log(e.shop, `🃏 Carte activée : ${e.payload.table}`),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "telegram",
            message: `🃏 Nouvelle carte activée !\n👑 ${e.payload.table}\n✅ Capacité SAMII débloquée`
        }),
    ],

    // ── ABONNEMENT ────────────────────────────────────────────
    "abonnement.upgraded": [
        (e) => journalService.log(e.shop, `⬆️ Abonnement upgradé : ${e.payload.plan}`),
        (e) => notificationEngine.send({
            shop: e.shop,
            channel: "telegram",
            message: `⬆️ Abonnement upgradé !\n👑 Plan : ${e.payload.plan}\n✅ Nouvelles capacités débloquées`
        }),
    ],

    "abonnement.cancelled": [
        (e) => settingsService.downgrade(e.shop),
        (e) => journalService.log(e.shop, `⬇️ Abonnement annulé`),
    ],

    // ── NOTIFICATION DIRECTE ──────────────────────────────────
    "notification.send": [
        (e) => notificationEngine.send(e.payload),
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

// ── HANDLERS appelés par Orchestrator ────────────────────────
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

