/**
 * ============================================================
 * OG • Scheduler
 * Gère toutes les tâches planifiées.
 * ============================================================
 */

class Scheduler {

    constructor() {
        this.jobs = [];
    }

    add(job) {
        this.jobs.push(job);
    }

    getAll() {
        return this.jobs;
    }

    async start() {

        console.log(`⏰ ${this.jobs.length} tâche(s) planifiée(s).`);

    }

}

module.exports = new Scheduler();
