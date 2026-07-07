/**
 * ============================================================
 * OG • Google Service
 * ============================================================
 */

class GoogleService {

    constructor() {
        this.connected = false;
    }

    async connect(config) {

        this.connected = true;

        console.log("🌍 Google connecté.");

        return true;

    }

    async profile() {

        return {};

    }

}

module.exports = new GoogleService();
