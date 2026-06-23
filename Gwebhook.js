const express = require("express");
const router = express.Router();
const axios = require("axios");

const AIRTABLE_API_KEY = process.env.APIAIRTABLE;
const AIRTABLE_BASE_ID = "app1nYEr6fReIt7SW";
const AIRTABLE_TABLE_ID = "tbl4qlJBAhve1UdPx";

const GREEN_INSTANCE = process.env.GREEN_API_INSTANCE;
const GREEN_TOKEN = process.env.GREEN_API_TOKEN;

async function envoyerWhatsApp(telephone, message) {
  try {
    // Formater le numéro algérien
    let numero = telephone.replace(/\D/g, "");
    if (numero.startsWith("0")) {
      numero = "213" + numero.slice(1);
    }
    const chatId = numero + "@c.us";

    await axios.post(
      `https://7107.api.greenapi.com/waInstance${GREEN_INSTANCE}/sendMessage/${GREEN_TOKEN}`,
      {
        chatId: chatId,
        message: message
      }
    );
    console.log("✅ WhatsApp envoyé à", telephone);
  } catch (err) {
    console.error("❌ Erreur WhatsApp:", err.message);
  }
}

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

  // Récupérer le téléphone
  const telephone = order.shipping_address?.phone || order.phone || null;
  const prenom = order.shipping_address?.first_name || "Client";

  try {
    await envoyerVersAirtable({
      "ID Commande": String(order.id || ""),
      "Client": order.email || "Invité",
      "Total": parseFloat(order.total_price) || 0,
      "Statut": order.financial_status || "",
      "Date": order.created_at
        ? new Date(order.created_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      "Téléphone": telephone || ""
    });
    console.log("📦 Envoyé vers Airtable !");
  } catch (err) {
    console.error("❌ Erreur Airtable:", JSON.stringify(err.response?.data) || err.message);
  }

  // Envoyer WhatsApp si téléphone disponible
  if (telephone) {
    const message = `Salam ${prenom} ! 🌟\n\nVotre commande #${order.id} a bien été reçue et confirmée ✅\n\nMerci pour votre confiance ! 🙏\n\n— Équipe SAMI`;
    await envoyerWhatsApp(telephone, message);
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
      "Date": draftOrder.created_at
        ? new Date(draftOrder.created_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    });
    console.log("📦 Envoyé vers Airtable !");
  } catch (err) {
    console.error("❌ Erreur Airtable:", JSON.stringify(err.response?.data) || err.message);
  }

  res.status(200).send("OK");
});router.post("/orders", async (req, res) => {
  const order = req.body;
  console.log("✅ Nouvelle commande:", order.id);
  
  // DEBUG - voir le téléphone
  console.log("📱 Téléphone shipping:", order.shipping_address?.phone);
  console.log("📱 Téléphone order:", order.phone);
  console.log("📱 Billing phone:", order.billing_address?.phone);


module.exports = router;
