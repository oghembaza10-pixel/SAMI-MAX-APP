/**
 * ============================================================
 * OG • Delivery Engine
 * ============================================================
 */

class DeliveryEngine {

    constructor() {

        this.providers = [];
        this.shipments = [];

    }

    registerProvider(provider) {

        this.providers.push(provider);

    }

    createShipment(shipment) {

        this.shipments.push(shipment);

    }

    getProviders() {

        return this.providers;

    }

    getShipments() {

        return this.shipments;

    }

}

module.exports = new DeliveryEngine();
