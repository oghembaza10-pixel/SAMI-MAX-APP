 // ==========================================================================
// SAMII OS — Webhook Shopify (universel)
// ==========================================================================

const express       = require("express");
const router        = express.Router();
const orchestrator  = require("../brain/orchestrator");
const socketService = require("../services/socketService");

const TOPIC_MAP = {
    "orders/create"    : "order.created",
    "orders/updated"   : "order.updated",
    "orders/paid"      : "order.paid",
    "orders/fulfilled" : "order.fulfilled",
    "orders/cancelled" : "order.cancelled",
    "app/uninstalled"  : "shop.uninstalled",
};

router.post("/", async (req, res) => {
    // Répondre immédiatement à Shopify
    res.sendStatus(200);

    const topic = req.headers["x-shopify-topic"];
    const shop  = req.headers["x-shopify-shop-domain"];

    if (!topic || !shop) return;

    const type = TOPIC_MAP[topic];
    if (!type) {
        console.log(`⚠️ Topic ignoré : ${topic}`);
        return;
    }

    // ── Parse body ────────────────────────────────────
    let payload = {};
    try {
        const raw = req.body;
        payload   = Buffer.isBuffer(raw) ? JSON.parse(raw.toString()) : raw;
        console.log(`📥 Webhook : ${topic} — ${shop} — #${payload.order_number || payload.id || ""}`);
    } catch (e) {
        console.error("❌ Parse body :", e.message);
        return;
    }

    // ── Orchestrateur SAMII ───────────────────────────
    try {
        await orchestrator.process({ type, shop, payload });
    } catch (e) {
        console.error("❌ Orchestrator :", e.message);
    }

    // ── Socket.IO → QG temps réel ─────────────────────
    try {
        socketService.emitToShop(shop, type, {
            order_number: payload.order_number || payload.id || "",
            total_price : payload.total_price  || "",
            customer    : payload.customer?.first_name || payload.billing_address?.first_name || "",
            statut      : payload.financial_status     || "",
        });
    } catch (e) {
        console.error("❌ Socket emit :", e.message);
    }
});

module.exports = router;


