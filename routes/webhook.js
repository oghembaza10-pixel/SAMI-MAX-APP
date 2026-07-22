 // ==========================================================================
// SAMII OS — Webhook Shopify (universel)
// ==========================================================================

const express = require("express");
const router = express.Router();

const E = require("../brain/events");
const orchestrator = require("../brain/orchestrator");
const socketService = require("../services/socketService");
const { verifyWebhookHmac } = require("../utils/shopifyHmac");

// ── Correspondance des topics Shopify → événements SAMII ──
const TOPIC_MAP = {
    // Shopify Orders
    "orders/create": E.ORDER_CREATED,
    "orders/updated": E.ORDER_UPDATED,
    "orders/paid": E.ORDER_PAID,
    "orders/fulfilled": E.ORDER_FULFILLED,
    "orders/cancelled": E.ORDER_CANCELLED,

    // Shopify Customers
    "customers/create": "customers.create",
    "customers/update": "customers.update",

    // Shopify Products
    "products/update": "products.update",

    // Shopify Inventory
    "inventory_levels/update": "inventory.updated",

    // Shopify Fulfillments
    "fulfillments/create": "fulfillments.create",

    // Désinstallation
    "app/uninstalled": E.SHOP_UNINSTALLED,
};

router.post("/", async (req, res) => {

    // ── Vérification de la signature Shopify ──
    if (!verifyWebhookHmac(req)) {
        return res.status(401).send("Signature invalide.");
    }

    const topic = req.headers["x-shopify-topic"];
    const shop = req.headers["x-shopify-shop-domain"];

    console.log("🔥 WEBHOOK :", topic);

    // Répondre immédiatement à Shopify
    res.sendStatus(200);

    if (!topic || !shop) return;

    const type = TOPIC_MAP[topic];

    if (!type) {
        console.log(`⚠️ Topic ignoré : ${topic}`);
        return;
    }

    // ── Parse body ─────────────────────────────────────
    let payload = {};

    try {
        payload = Buffer.isBuffer(req.body)
            ? JSON.parse(req.body.toString("utf8"))
            : req.body;

        console.log(
            `📥 Webhook : ${topic} — ${shop} — #${payload.order_number || payload.id || ""}`
        );

    } catch (err) {
        console.error("❌ Parse body :", err.message);
        return;
    }

    // ── Orchestrateur SAMII ────────────────────────────
    try {
        await orchestrator.process({
            type,
            shop,
            payload,
        });
    } catch (err) {
        console.error("❌ Orchestrator :", err.message);
    }

    // ── Socket.IO → QG temps réel ──────────────────────
    try {
        socketService.emitToShop(shop, type, {
            order_number: payload.order_number || payload.id || "",
            total_price: payload.total_price || "",
            customer:
                payload.customer?.first_name ||
                payload.billing_address?.first_name ||
                "",
            statut: payload.financial_status || "",
        });
    } catch (err) {
        console.error("❌ Socket emit :", err.message);
    }
});

module.exports = router;
