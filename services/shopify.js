const axios        = require("axios");
const orchestrator = require("../brain/orchestrator");

async function getOrders(shop, token) {
    try {
        const res = await axios.get(
            `https://${shop}/admin/api/2024-01/orders.json`,
            { headers: { "X-Shopify-Access-Token": token } }
        );
        return { success: true, orders: res.data.orders };
    } catch (err) {
        console.error("❌ Shopify getOrders :", err.message);
        return { success: false, error: err.message };
    }
}

async function getProducts(shop, token) {
    try {
        const res = await axios.get(
            `https://${shop}/admin/api/2024-01/products.json`,
            { headers: { "X-Shopify-Access-Token": token } }
        );
        return { success: true, products: res.data.products };
    } catch (err) {
        console.error("❌ Shopify getProducts :", err.message);
        return { success: false, error: err.message };
    }
}

async function receive(event) {
    await orchestrator.process({
        type   : `shopify.${event.type}`,
        shop   : event.shop || "",
        payload: event.payload,
    });
}

module.exports = { getOrders, getProducts, receive };
