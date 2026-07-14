/**
 * OG • Automation Engine
 * Décideur central — exécute les automatisations
 */

const notificationEngine = require("./notificationEngine");
const automations        = require("../brain/automations");

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
            console.error(`❌ [${trigger}] :`, err.message);
        }
    }
}

async function shopConnected(event)         { return run("shop.connected", event); }
async function shopUninstalled(event)       { return run("shop.uninstalled", event); }
async function notificationRequested(event) { return notificationEngine.send(event.payload); }

module.exports = { shopConnected, shopUninstalled, notificationRequested, run };
