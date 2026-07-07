/**
 * ============================================================
 * OG • Router
 * Oriente chaque demande vers le bon moteur.
 * ============================================================
 */

class Router {

    constructor() {
        this.routes = new Map();
    }

    register(name, handler) {
        this.routes.set(name, handler);
    }

    get(name) {
        return this.routes.get(name);
    }

    has(name) {
        return this.routes.has(name);
    }

}

module.exports = new Router();
