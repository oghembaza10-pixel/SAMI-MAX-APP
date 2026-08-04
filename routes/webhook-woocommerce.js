// ==========================================================================
// OG EMPIRE — WOOCOMMERCE : réception des commandes en temps réel
// ==========================================================================
const express = require("express");
const axios   = require("axios");
const crypto  = require("crypto");
const router  = express.Router();

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

        const sourceUrl = req.headers["x-wc-webhook-source"] || "";

        console.log(`🛒 Commande WooCommerce reçue — #${order.number} depuis ${sourceUrl}`);

        const connectorService = require("../services/connectorService");
        const airtable = require("../services/airtable");

        const record = await airtable.findOne("CONNECTEURS",
            `AND({type}="woocommerce",SEARCH("${sourceUrl.replace(/https?:\/\//, "")}",{config}))`
        );

        if (!record) {
            console.warn(`⚠️ Aucun workspace trouvé pour la boutique WooCommerce : ${sourceUrl}`);
            return;
        }

        const workspaceId = record.fields.workspace_id;

        const client = `${order.billing?.first_name || ""} ${order.billing?.last_name || ""}`.trim() || "Client";
        const phone  = order.billing?.phone || "";
        const address = order.billing
            ? `${order.billing.address_1 || ""}, ${order.billing.city || ""}`
            : "";
        const produits = (order.line_items || []).map(i => i.name).join(", ");

        await airtable.create("COMMANDES", {
            "ID Commande"  : `WOO-${order.number}`,
            "nom client"   : client,
            "Téléphone"    : phone,
            "Adresse"      : address,
            "Produit"      : produits,
            "Statut"       : "en attente",
            "Boutique"     : workspaceId,
            "Source"       : "woocommerce",
            "Date Commande": order.date_created || new Date().toISOString(),
            "montant"      : String(parseFloat(order.total || 0)),
        });

        await airtable.log("order.created.woocommerce", `#${order.number} — ${client}`, workspaceId);

        console.log(`✅ Commande WooCommerce WOO-${order.number} enregistrée sur workspace ${workspaceId}`);

    } catch (err) {
        console.error("❌ webhook/woocommerce :", err.message);
    }
});

module.exports = { router, registerOrderWebhook };
