const express = require("express");
const router = express.Router();
const axios = require("axios");

const AIRTABLE_API_KEY = process.env.APIAIRTABLE;
const AIRTABLE_BASE_ID = "app1nYEr6fReIt7SW";
const AIRTABLE_TABLE_ID = "tbl4qlJBAhve1UdPx";

async function envoyerVersAirtable(data) {
  await axios.post(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
    { fields: data },
    {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );
}

// Webhook - Commande créée
router.post("/orders", async (req, res) => {
  const order = req.body;
  console.log("✅ Nouvelle commande:", order.id);
  try {
    await envoyerVersAirtable({
      "ID Commande": String(order.id || ""),
      "Client": order.email || "Invité",
      "Total": String(order.total_price || ""),
      "Statut": order.financial_status || "",
      "Date": order.created_at || ""
    });
    console.log("📦 Envoyé vers Airtable !");
  } catch (err) {
    console.error("❌ Erreur Airtable:", err.message);
  }
  res.status(200).send("OK");
});

// Webhook - Commande provisoire créée
router.post("/draft-orders", async (req, res) => {
  const draftOrder = req.body;
  console.log("📋 Commande provisoire:", draftOrder.id);
  try {
    await envoyerVersAirtable({
      "ID Commande": String(draftOrder.id || ""),
      "Client": draftOrder.email || "Invité",
      "Total": String(draftOrder.total_price || ""),
      "Statut": "PROVISOIRE",
      "Date": draftOrder.created_at || ""
    });
    console.log("📦 Envoyé vers Airtable !");
  } catch (err) {
    console.error("❌ Erreur Airtable:", err.message);
  }
  res.status(200).send("OK");
});} catch (err) {
  console.error("❌ Erreur Airtable:", err.response?.data || err.message);
}


module.exports = router;

