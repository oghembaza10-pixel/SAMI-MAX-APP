
/**
 * ============================================================
 * OG • Scheduler — utilise node-cron pour de vraies tâches planifiées
 * ============================================================
 */
const cron = require("node-cron");

class Scheduler {
    constructor() {
        this.jobs = [];
    }

    // ── Ajoute une tâche : pattern cron + fonction à exécuter ──
    add(pattern, name, fn) {
        this.jobs.push({ pattern, name, fn });
    }

    getAll() {
        return this.jobs;
    }

    start() {
        this.jobs.forEach(job => {
            cron.schedule(job.pattern, async () => {
                console.log(`⏰ Exécution tâche planifiée : ${job.name}`);
                try {
                    await job.fn();
                } catch (err) {
                    console.error(`❌ Erreur tâche "${job.name}" :`, err.message);
                }
            });
        });
        console.log(`⏰ ${this.jobs.length} tâche(s) planifiée(s) démarrée(s).`);
    }
}

module.exports = new Scheduler();
