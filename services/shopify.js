/**
 * ============================================================
 * OG • Shopify Service
 * ============================================================
 */

class ShopifyService {

    constructor() {
        this.connected = false;
        this.shop = null;
    }

    async connect(config) {
        this.shop = config;
        this.connected = true;

        console.log("🛍️ Shopify connecté.");

        return true;
    }

    async getProducts() {
        return [];
    }

    async getOrders() {
        return [];
    }

    async createOrder(order) {
        return order;
    }

}

module.exports = new ShopifyService();
