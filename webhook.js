const express = require("express");
const router = express.Router();
const axios = require("axios");

const AIRTABLE_API_KEY = process.env.APIAIRTABLE;
const AIRTABLE_BASE_ID = "app1nYEr6fReIt7SW";
const AIRTABLE_TABLE_ID = "tbl4qlJBAhve1UdPx";

async function envoyerVersAirtable(data) {
  const response = await axios.post(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
    { fields: data },
    {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );
  return response.data;
}

router.post("/orders", async (req, res) => {
  const order = req.body;
  console.log("✅ Nouvelle commande:", order.id);
  try {
    await envoyerVersAirtable({
      "ID Commande": String(order.id || ""),
      "Client": order.email || "Invité",
      "Total": parseFloat(order.total_price) || 0,
      "Statut": order.financial_status || "",
      "Date": order.created_at || ""
    });
    console.log("📦 Envoyé vers Airtable !");
  } catch (err) {
    console.error("❌ Erreur Airtable:", JSON.stringify(err.response?.data) || err.message);
  }
  res.status(200).send("OK");
});

router.post("/draft-orders", async (req, res) => {
  const draftOrder = req.body;
  console.log("📋 Commande provisoire:", draftOrder.id);
  try {
    await envoyerVersAirtable({
      "ID Commande": String(draftOrder.id || ""),
      "Client": draftOrder.email || "Invité",
      "Total": parseFloat(draftOrder.total_price) || 0,
      "Statut": "PROVISOIRE",
      "Date": draftOrder.created_at || ""
    });
    console.log("📦 Envoyé vers Airtable !");
  } catch (err) {
    console.error("❌ Erreur Airtable:", JSON.stringify(err.response?.data) || err.message);
  }
  res.status(200).send("OK");
});

module.exports = router;



