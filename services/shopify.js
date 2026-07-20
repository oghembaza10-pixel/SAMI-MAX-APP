const axios = require("axios");
const orchestrator = require("../brain/orchestrator");

const SHOPIFY_API_VERSION = "2026-07";

// ─────────────────────────────────────────────
// Récupérer les commandes
// ─────────────────────────────────────────────
async function getOrders(shop, accessToken) {
    try {
        const { data } = await axios.get(
            `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json`,
            {
                headers: {
                    "X-Shopify-Access-Token": accessToken,
                },
            }
        );

        return {
            success: true,
            orders: data.orders || [],
        };

    } catch (err) {
        console.error("❌ Shopify getOrders :", err.response?.data || err.message);

        return {
            success: false,
            error: err.message,
        };
    }
}

// ─────────────────────────────────────────────
// Récupérer les produits
// ─────────────────────────────────────────────
async function getProducts(shop, accessToken) {
    try {
        const { data } = await axios.get(
            `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products.json`,
            {
                headers: {
                    "X-Shopify-Access-Token": accessToken,
                },
            }
        );

        return {
            success: true,
            products: data.products || [],
        };

    } catch (err) {
        console.error("❌ Shopify getProducts :", err.response?.data || err.message);

        return {
            success: false,
            error: err.message,
        };
    }
}

// ─────────────────────────────────────────────
// Réception d'un événement Shopify
// ─────────────────────────────────────────────
async function receive(event) {
    try {
        await orchestrator.process({
            type: `shopify.${event.type}`,
            shop: event.shop || "",
            payload: event.payload || {},
        });

        return true;

    } catch (err) {
        console.error("❌ Shopify receive :", err.message);
        return false;
    }
}

module.exports = {
    getOrders,
    getProducts,
    receive,
};
