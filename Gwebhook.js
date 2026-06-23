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
    let numero = telephone.replace(/\D/g, "");
    if (numero.startsWith("0")) {
      numero = "213" + numero.slice(1);
    }
    const chatId = numero + "@c.us";
    console.log("📱 Envoi WhatsApp vers:", chatId);

    const url = `https://7107.api.greenapi.com/waInstance${GREEN_INSTANCE}/sendMessage/${GREEN_TOKEN}`;
    await axios.post(url, {
      chatId: chatId,
      message: message
    });
    console.log("✅ WhatsApp envoyé !");
  } catch (err) {
    console.error("❌ Erreur WhatsApp:", err.response?.data || err.message);
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

  const shipping = order.shipping_address || {};
  const telephone = shipping.phone || order.phone || order.customer?.phone || null;
  const prenom = shipping.first_name || "Client";
  const nom = shipping.last_name || "";
  const adresse = shipping.address1 || "";
  const ville = shipping.city || "";

  console.log("📱 Téléphone trouvé:", telephone);

  try {
    await envoyerVersAirtable({
      "ID Commande": String(order.id || ""),
      "Client": `${prenom} ${nom}`.trim(),
      "Email": order.email || "Invité",
      "Téléphone": telephone || "",
      "Adresse": `${adresse}, ${ville}`,
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

  if (telephone) {
    const message = `Salam ${prenom} ! 🌟\n\nVotre commande #${order.id} a bien été reçue et confirmée ✅\n\nMerci pour votre confiance ! 🙏\n\n— Équipe SAMI`;
    await envoyerWhatsApp(telephone, message);
  } else {
    console.log("⚠️ Pas de téléphone — WhatsApp non envoyé");
  }

  res.status(200).send("OK");
});

router.post("/draft-orders", async (req, res) => {
  const draftOrder = req.body;
  console.log("📋 Commande provisoire:", draftOrder.id);

  const shipping = draftOrder.shipping_address || {};
  const prenom = shipping.first_name || "Client";
  const nom = shipping.last_name || "";
  const telephone = shipping.phone || draftOrder.phone || null;

  try {
    await envoyerVersAirtable({
      "ID Commande": String(draftOrder.id || ""),
      "Client": `${prenom} ${nom}`.trim(),
      "Email": draftOrder.email || "Invité",
      "Téléphone": telephone || "",
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

