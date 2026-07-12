/**
 * ============================================================
 * OG • Scheduler
 * Tâches automatiques de SAMII OS
 * ============================================================
 */

const cron         = require("node-cron");
const orchestrator = require("../brain/orchestrator");
const airtable     = require("../services/airtable");

// ── TÂCHES ───────────────────────────────────────────────

function start() {

    // Toutes les 5 min — heartbeat SAMII
    cron.schedule("*/5 * * * *", async () => {
        console.log("💓 Scheduler → heartbeat");
        await orchestrator.process({
            type   : "scheduler.heartbeat",
            shop   : "",
            payload: { timestamp: Date.now() },
        });
    });

    // Toutes les heures — sync commandes
    cron.schedule("0 * * * *", async () => {
        console.log("🔄 Scheduler → sync.orders");
        await orchestrator.process({
            type   : "scheduler.sync.orders",
            shop   : "",
            payload: { timestamp: Date.now() },
        });
    });

    // Tous les jours à 08h00 — rapport quotidien
    cron.schedule("0 8 * * *", async () => {
        console.log("📊 Scheduler → rapport quotidien");
        await orchestrator.process({
            type   : "scheduler.report.daily",
            shop   : "",
            payload: { timestamp: Date.now() },
        });
    });

    // Tous les lundis à 09h00 — rapport hebdomadaire
    cron.schedule("0 9 * * 1", async () => {
        console.log("📈 Scheduler → rapport hebdomadaire");
        await orchestrator.process({
            type   : "scheduler.report.weekly",
            shop   : "",
            payload: { timestamp: Date.now() },
        });
    });

    // Tous les jours à 23h00 — nettoyage logs
    cron.schedule("0 23 * * *", async () => {
        console.log("🧹 Scheduler → nettoyage logs");
        await airtable.log(
            "scheduler.cleanup",
            "Nettoyage automatique des logs",
            ""
        );
    });

    console.log("✅ Scheduler démarré");
}

module.exports = { start };
