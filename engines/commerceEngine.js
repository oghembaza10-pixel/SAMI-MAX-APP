/**
 * ============================================================
 * OG • Commerce Engine
 * ------------------------------------------------------------
 * Gère toute la logique commerciale.
 * Les API externes seront connectées via les Services.
 * ============================================================
 */

class CommerceEngine {

    constructor() {

        this.name = "Commerce Engine";
        this.version = "1.0.0";

        this.orders = [];
        this.products = [];
        this.customers = [];

    }

    addProduct(product) {

        this.products.push(product);

    }

    addCustomer(customer) {

        this.customers.push(customer);

    }

    createOrder(order) {

        this.orders.push(order);

        return order;

    }

    getOrders() {

        return this.orders;

    }

    getProducts() {

        return this.products;

    }

    getCustomers() {

        return this.customers;

    }

    stats() {

        return {

            products: this.products.length,
            customers: this.customers.length,
            orders: this.orders.length

        };

    }

}

module.exports = new CommerceEngine();
