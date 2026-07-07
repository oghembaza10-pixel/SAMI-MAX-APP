/**
 * ============================================================
 * OG • CRM Engine
 * ============================================================
 */

class CRMEngine {

    constructor() {

        this.clients = [];

    }

    add(client) {

        this.clients.push(client);

    }

    all() {

        return this.clients;

    }

    total() {

        return this.clients.length;

    }

}

module.exports = new CRMEngine();
