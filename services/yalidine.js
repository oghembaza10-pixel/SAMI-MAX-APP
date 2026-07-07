/**
 * ============================================================
 * OG • Yalidine Service
 * ============================================================
 */

class YalidineService {

    constructor() {

        this.connected = false;

    }

    async connect(config) {

        this.connected = true;

        return true;

    }

    async createShipment(order) {

        return {
            success: true,
            tracking: null,
            order
        };

    }

    async tracking(number) {

        return {
            success: true,
            tracking: number
        };

    }

}

module.exports = new YalidineService();
