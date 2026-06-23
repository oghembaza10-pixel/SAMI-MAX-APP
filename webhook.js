
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

  // ✅ Récupération nom, adresse, téléphone
  const nom = order.shipping_address?.name
    || order.billing_address?.name
    || (order.customer ? `${order.customer.first_name} ${order.customer.last_name}`.trim() : "")
    || order.email
    || "Invité";

  const adresse = [
    order.shipping_address?.address1,
    order.shipping_address?.city,
    order.shipping_address?.country
  ].filter(Boolean).join(", ") || "";

  const telephone = order.shipping_address?.phone
    || order.billing_address?.phone
    || order.customer?.phone
    || "";

  try {
    await envoyerVersAirtable({
      "ID Commande": String(order.id || ""),
      "Client": nom,
      "Adresse": adresse,
      "Téléphone": telephone,
      "Total": parseFloat(order.total_price) || 0,
      "Statut": order.financial_status || "",
      "Date": order.created_at
        ? new Date(order.created_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
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

  const nom = draftOrder.shipping_address?.name
    || draftOrder.billing_address?.name
    || (draftOrder.customer ? `${draftOrder.customer.first_name} ${draftOrder.customer.last_name}`.trim() : "")
    || draftOrder.email
    || "Invité";

  const adresse = [
    draftOrder.shipping_address?.address1,
    draftOrder.shipping_address?.city,
    draftOrder.shipping_address?.country
  ].filter(Boolean).join(", ") || "";

  const telephone = draftOrder.shipping_address?.phone
    || draftOrder.billing_address?.phone
    || draftOrder.customer?.phone
    || "";

  try {
    await envoyerVersAirtable({
      "ID Commande": String(draftOrder.id || ""),
      "Client": nom,
      "Adresse": adresse,
      "Téléphone": telephone,
      "Total": parseFloat(draftOrder.total_price) || 0,
      "Statut": "PROVISOIRE",
      "Date": draftOrder.created_at
        ? new Date(draftOrder.created_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    });
    console.log("📦 Envoyé vers Airtable !");
  } catch (err) {
    console.error("❌ Erreur Airtable:", JSON.stringify(err.response?.data) || err.message);
  }
  res.status(200).send("OK");
});

module.exports = router;



