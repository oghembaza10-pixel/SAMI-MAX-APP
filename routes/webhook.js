const express = require("express");
const router = express.Router();

const airtable = require("../airtable");
const config = require("../config");

// ======================================
// WEBHOOK SHOPIFY
// ======================================

router.post("/order", async (req, res) => {

    res.status(200).send("OK");

    try {

        const order = req.body;

        await airtable.createRecord(

            config.AIRTABLE.TABLES.COMMANDES,

            {

                "ID Commande": String(order.id || ""),

                "Client": `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`,

                "Téléphone": order.customer?.phone || "",

                "Total": Number(order.total_price || 0),

                "Statut": order.financial_status || "pending",

                "Date": order.created_at || new Date().toISOString()

            }

        );

        console.log("✅ Commande enregistrée.");

    }

    catch (err) {

        console.error("❌ Webhook :", err.response?.data || err.message);

    }

});

module.exports = router;
