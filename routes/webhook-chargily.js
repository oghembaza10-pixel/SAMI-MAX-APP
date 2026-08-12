// ==========================================================================
// SAMII OS — WEBHOOK CHARGILY PAY (confirmation de paiement réel)
// Monté sous /webhook, où express.raw() laisse le body en Buffer brut —
// nécessaire pour vérifier la signature HMAC-SHA256 sur le payload exact.
// ==========================================================================
const express    = require("express");
const chargily   = require("../services/chargily");
const { confirmChargilyPayment } = require("../services/orders");

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const signature = req.get("signature") || "";
        const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

        if (!chargily.verifySignature(raw, signature)) {
            console.warn("⚠️ Webhook Chargily : signature invalide");
            return res.sendStatus(403);
        }

        const event = JSON.parse(raw.toString("utf8"));
        const checkoutId = event.id || event.data?.id;
        if (!checkoutId) return res.sendStatus(200);

        await confirmChargilyPayment(checkoutId);

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Webhook Chargily :", err.message);
        res.sendStatus(200);
    }
});

module.exports = router;
