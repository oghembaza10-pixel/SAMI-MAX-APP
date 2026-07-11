const express = require("express");
const router = express.Router();
const axios = require("axios");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;
const WHATSAPP_INSTANCE = process.env.WHATSAPP_INSTANCE;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;

// ======================================
// WEBHOOK SHOPIFY — orders/create
// ======================================
router.post("/orders-create", async (req, res) => {
    res.sendStatus(200);
    try {
        const order = req.body;
        const client = `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim();
        const phone = order.shipping_address?.phone || order.customer?.phone || "";
        const address = order.shipping_address
            ? `${order.shipping_address.address1}, ${order.shipping_address.city}`
            : "";

        // → Airtable
        await axios.post(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
            {
                fields: {
                    "ID Commande": String(order.id || ""),
                    "Client": client,
                    "Adresse": address,
                    "Téléphone": phone,
                    "Total": Number(order.total_price || 0),
                    "Statut": order.financial_status || "pending",
                    "Date": order.created_at || new Date().toISOString(),
                }
            },
            { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" } }
        );
        console.log("✅ Commande enregistrée dans Airtable");

        // → WhatsApp
        if (phone) {
            await axios.post(
                `https://api.green-api.com/waInstance${WHATSAPP_INSTANCE}/sendMessage/${WHATSAPP_TOKEN}`,
                {
                    chatId: `${WHATSAPP_PHONE}@c.us`,
                    message: `🛒 Nouvelle commande !\nClient: ${client}\nTél: ${phone}\nAdresse: ${address}\nTotal: ${order.total_price} $\nStatut: ${order.financial_status}`
                }
            );
            console.log("✅ WhatsApp envoyé");
        }

    } catch (err) {
        console.error("❌ Webhook:", err.response?.data || err.message);
    }
});

module.exports = router;

