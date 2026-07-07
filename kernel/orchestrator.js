/**
 * ============================================================
 * OG • Orchestrator
 * Coordonne les moteurs de l'application.
 * ============================================================
 */

class Orchestrator {

    constructor() {

        this.engines = new Map();

    }

    register(name, engine) {

        this.engines.set(name, engine);

    }

    get(name) {

        return this.engines.get(name);

    }

    list() {

        return [...this.engines.keys()];

    }

}

module.exports = new Orchestrator();
