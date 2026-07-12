/**
 * ============================================================
 * OG • Webhook Routes
 * Reçoit les événements Shopify → Orchestrator → Brain
 * ============================================================
 */

const express      = require("express");
const router       = express.Router();
const orchestrator = require("../brain/orchestrator");

// ── WEBHOOK : orders/create ───────────────────────────
router.post("/orders-create", async (req, res) => {
    res.sendStatus(200);
    await orchestrator.process({
        type   : "shopify.order.created",
        shop   : req.headers["x-shopify-shop-domain"],
        payload: req.body,
    });
});

// ── WEBHOOK : orders/updated ──────────────────────────
router.post("/orders-updated", async (req, res) => {
    res.sendStatus(200);
    await orchestrator.process({
        type   : "shopify.order.updated",
        shop   : req.headers["x-shopify-shop-domain"],
        payload: req.body,
    });
});

// ── WEBHOOK : orders/fulfilled ────────────────────────
router.post("/orders-fulfilled", async (req, res) => {
    res.sendStatus(200);
    await orchestrator.process({
        type   : "shopify.order.fulfilled",
        shop   : req.headers["x-shopify-shop-domain"],
        payload: req.body,
    });
});

// ── WEBHOOK : orders/cancelled ────────────────────────
router.post("/orders-cancelled", async (req, res) => {
    res.sendStatus(200);
    await orchestrator.process({
        type   : "shopify.order.cancelled",
        shop   : req.headers["x-shopify-shop-domain"],
        payload: req.body,
    });
});

// ── WEBHOOK : products/update (stock faible) ──────────
router.post("/products-update", async (req, res) => {
    res.sendStatus(200);
    const product = req.body;
    const shop    = req.headers["x-shopify-shop-domain"];

    const lowStock = product.variants?.filter(v => v.inventory_quantity <= 5) || [];

    for (const variant of lowStock) {
        await orchestrator.process({
            type   : "shopify.stock.low",
            shop,
            payload: {
                product: product.title,
                variant: variant.inventory_quantity,
                shop,
            },
        });
    }
});

// ── WEBHOOK : app/uninstalled ─────────────────────────
router.post("/app-uninstalled", async (req, res) => {
    res.sendStatus(200);
    await orchestrator.process({
        type   : "shopify.app.uninstalled",
        shop   : req.headers["x-shopify-shop-domain"] || "inconnu",
        payload: {},
    });
});

module.exports = router;

