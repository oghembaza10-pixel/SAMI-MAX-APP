// ==========================================================================
// OG TECHNOLOGY — WOOCOMMERCE : réception des commandes en temps réel
// ==========================================================================
const express = require("express");
const axios   = require("axios");
const router  = express.Router();
const db             = require("../services/db");
const socketService  = require("../services/socketService");

const APP_URL = "https://samii.souverain-store.com";

async function registerOrderWebhook(siteUrl, consumerKey, consumerSecret) {
    try {
        await axios.post(
            `${siteUrl}/wp-json/wc/v3/webhooks`,
            {
                name       : "SAMII — Nouvelle commande",
                topic      : "order.created",
                delivery_url: `${APP_URL}/webhook/woocommerce`,
                status     : "active",
            },
            {
                auth: { username: consumerKey, password: consumerSecret },
            }
        );
        console.log(`✅ Webhook WooCommerce enregistré pour ${siteUrl}`);
        return true;
    } catch (err) {
        console.error("❌ registerOrderWebhook :", err.response?.data || err.message);
        return false;
    }
}

router.post("/webhook/woocommerce", express.json(), async (req, res) => {
    res.sendStatus(200);

    try {
        const order = req.body;
        if (!order || !order.id) return;

        const sourceUrl = (req.headers["x-wc-webhook-source"] || "")
            .replace(/^https?:\/\//, "")
            .replace(/\/$/, "");

        console.log(`🛒 Commande WooCommerce reçue — #${order.number} depuis ${sourceUrl}`);

        const rows = await db.query(
            `SELECT workspace_id FROM connecteurs WHERE type = 'woocommerce' AND actif = true AND config LIKE $1`,
            [`%${sourceUrl}%`]
        );

        if (!rows.length) {
            console.warn(`⚠️ Aucun workspace trouvé pour la boutique WooCommerce : ${sourceUrl}`);
            return;
        }

        const workspaceId = rows[0].workspace_id;
        const orderId = `WOO-${order.number}`;

        const client = `${order.billing?.first_name || ""} ${order.billing?.last_name || ""}`.trim() || "Client";
        const phone  = order.billing?.phone || "";
        const address = order.billing
            ? `${order.billing.address_1 || ""}, ${order.billing.city || ""}`
            : "";
        const produits = (order.line_items || []).map(i => i.name).join(", ");
        const montant = parseFloat(order.total || 0) || 0;

        await db.query(
            `INSERT INTO commandes (id, workspace_id, nom_client, telephone, adresse, produit, statut, source, montant)
             VALUES ($1, $2, $3, $4, $5, $6, 'en attente', 'woocommerce', $7)
             ON CONFLICT (id) DO NOTHING`,
            [orderId, workspaceId, client, phone, address, produits, montant]
        );

        await db.query(
            `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
            ["order.created.woocommerce", `#${order.number} — ${client}`, workspaceId]
        );

        socketService.emitToShop(workspaceId, "nouvelle-commande", { id: orderId });

        console.log(`✅ Commande WooCommerce ${orderId} enregistrée sur workspace ${workspaceId}`);

    } catch (err) {
        console.error("❌ webhook/woocommerce :", err.message);
    }
});

module.exports = { router, registerOrderWebhook };
