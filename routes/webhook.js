const express      = require("express");
const router       = express.Router();
const orchestrator = require("../brain/orchestrator");

const TOPIC_MAP = {
    "orders/create"    : "order.created",
    "orders/updated"   : "order.updated",
    "orders/paid"      : "order.paid",
    "orders/fulfilled" : "order.fulfilled",
    "orders/cancelled" : "order.cancelled",
    "app/uninstalled"  : "shop.uninstalled",
};

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

    // ── Parse raw body ────────────────────────────────
    let payload = {};
    try {
        const raw = req.body;
        payload = Buffer.isBuffer(raw) ? JSON.parse(raw.toString()) : raw;
        console.log(`✅ Payload parsé — order #${payload.order_number}`);
    } catch(e) {
        console.error("❌ Parse body :", e.message);
    }

    await orchestrator.process({ type, shop, payload });
});

module.exports = router;

