/**
 * ============================================================
 * OG • Webhook Routes — VERSION DÉFINITIVE
 * ============================================================
 */

const express      = require("express");
const router       = express.Router();
const orchestrator = require("../brain/orchestrator");

// ── MAP SHOPIFY TOPICS → EVENTS SAMII ─────────────────
const TOPIC_MAP = {
    "orders/create"    : "order.created",
    "orders/updated"   : "order.updated",
    "orders/paid"      : "order.paid",
    "orders/fulfilled" : "order.fulfilled",
    "orders/cancelled" : "order.cancelled",
    "app/uninstalled"  : "shop.uninstalled",
};

// ── WEBHOOK UNIVERSEL ─────────────────────────────────
router.post("/", async (req, res) => {
    res.sendStatus(200);

    const topic = req.headers["x-shopify-topic"];
    const shop  = req.headers["x-shopify-shop-domain"];

    console.log(`📥 Webhook reçu : ${topic} — ${shop}`);

    if (!topic || !shop) return;

    const type = TOPIC_MAP[topic];
    if (!type) {
        console.log(`⚠️ Topic ignoré : ${topic}`);
        return;
    }

    await orchestrator.process({
        type,
        shop,
        payload: req.body,
    });
});

module.exports = router;
