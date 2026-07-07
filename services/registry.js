/**
 * ============================================================
 * OG • Service Registry
 * Registre central des services.
 * ============================================================
 */

class ServiceRegistry {

    constructor() {
        this.services = new Map();
    }

    register(name, service) {
        this.services.set(name, service);
    }

    get(name) {
        return this.services.get(name);
    }

    has(name) {
        return this.services.has(name);
    }

    list() {
        return [...this.services.keys()];
    }

}

module.exports = new ServiceRegistry();
