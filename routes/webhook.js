/**
 * ============================================================
 * OG • Webhook Routes — VERSION DÉFINITIVE
 * Une seule URL pour tous les événements Shopify
 * ============================================================
 */

const express      = require("express");
const router       = express.Router();
const orchestrator = require("../brain/orchestrator");

// ── WEBHOOK UNIVERSEL ─────────────────────────────────
router.post("/", async (req, res) => {
    res.sendStatus(200);

    const topic = req.headers["x-shopify-topic"];
    const shop  = req.headers["x-shopify-shop-domain"];

    console.log(`📥 Webhook reçu : ${topic} — ${shop}`);

    if (!topic || !shop) return;

    await orchestrator.process({
        type   : `shopify.${topic.replace("/", ".")}`,
        shop,
        payload: req.body,
    });
});

module.exports = router;
