/**
 * ============================================================
 * OG • Meta Service
 * ============================================================
 */

class MetaService {

    constructor() {

        this.connected = false;

    }

    async connect(token) {

        this.connected = true;

        console.log("📘 Meta connecté.");

        return true;

    }

    async publish(post) {

        return {

            success: true,
            post

        };

    }

}

module.exports = new MetaService();
