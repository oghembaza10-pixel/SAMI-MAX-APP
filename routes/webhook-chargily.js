// ==========================================================================
// SAMII OS — WEBHOOK CHARGILY PAY (confirmation de paiement réel)
// Monté sous /webhook, où express.raw() laisse le body en Buffer brut —
// nécessaire pour vérifier la signature HMAC-SHA256 sur le payload exact.
// ==========================================================================
const express    = require("express");
const chargily   = require("../services/chargily");
const db         = require("../services/db");
const socketService = require("../services/socketService");
const notify     = require("../services/notify");

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

        // On ne fait jamais confiance au seul contenu du webhook : on relit le
        // vrai statut directement chez Chargily avant de toucher à la commande.
        const checkout = await chargily.getCheckout(checkoutId);
        if (!checkout || checkout.status !== "paid") return res.sendStatus(200);

        const orderId = checkout.metadata?.order_id;
        if (!orderId) return res.sendStatus(200);

        const rows = await db.query(
            `UPDATE commandes SET statut = 'payée', chargily_checkout_id = $1
             WHERE id = $2 AND statut != 'payée' RETURNING workspace_id`,
            [checkoutId, orderId]
        );

        if (rows[0]) {
            const workspaceId = rows[0].workspace_id;
            await db.query(
                `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
                ["order.paid.chargily", `#${orderId} payée via Chargily (${checkoutId})`, workspaceId]
            );
            socketService.emitToShop(workspaceId, "commande-payee", { id: orderId });
            notify.notifyWorkspace(workspaceId, {
                title: "💳 Paiement reçu",
                body : `Commande #${orderId} payée en ligne`,
                url  : "/qg",
            });
            console.log(`✅ Commande ${orderId} marquée payée via Chargily`);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Webhook Chargily :", err.message);
        res.sendStatus(200);
    }
});

module.exports = router;
