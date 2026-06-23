// ============================================
// WEBHOOK.JS — Commandes Shopify + SAMI
// ============================================

const express = require("express");
const router = express.Router();
const axios = require("axios");
const sami = require("./sami");

const AIRTABLE_API_KEY = process.env.APIAIRTABLE;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "app1nYEr6fReIt7SW";
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || "tbl4qlJBAhve1UdPx";

const GREEN_INSTANCE = process.env.GREEN_API_INSTANCE || "7107661372";
const GREEN_TOKEN = process.env.GREEN_API_TOKEN || "0b6a7a3b8b04450480db47b8017e528a03b32366096c4598bd";
const WHATSAPP_MARCHAND = process.env.WHATSAPP_MARCHAND || "213558426208@c.us";

// ─── ENVOYER WHATSAPP ───────────────────────
async function envoyerWhatsApp(chatId, message) {
  try {
    const url = `https://api.green-api.com/waInstance${GREEN_INSTANCE}/sendMessage/${GREEN_TOKEN}`;
    await axios.post(url, { chatId, message }, {
      headers: { "Content-Type": "application/json" }
    });
    console.log("📱 WhatsApp envoyé à:", chatId);
  } catch (err) {
    console.error("❌ Erreur WhatsApp:", err.response?.data || err.message);
  }
}

// ─── ENVOYER VERS AIRTABLE ──────────────────
async function envoyerVersAirtable(data) {
  try {
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
    console.log("📦 Airtable mis à jour !");
  } catch (err) {
    console.error("❌ Erreur Airtable:", JSON.stringify(err.response?.data) || err.message);
  }
}

// ─── NOUVELLE COMMANDE ──────────────────────
router.post("/orders", async (req, res) => {
  res.status(200).send("OK"); // Répondre vite à Shopify
  const order = req.body;
  console.log("✅ Nouvelle commande:", order.id);

  try {
    // SAMI analyse la commande
    const analyse = await sami.analyserCommande(order);

    // Si BLACKLIST → alerte marchand uniquement, on arrête
    if (analyse.estBlacklist) {
      console.log("🚫 Commande BLACKLIST bloquée:", order.id);
      await envoyerWhatsApp(WHATSAPP_MARCHAND,
        `🚫 *ALERTE BLACKLIST !*\n\n` +
        `Commande #${order.id} d'un client blacklisté !\n` +
        `📞 ${analyse.telephone}\n` +
        `💰 ${order.total_price} ${order.currency}\n\n` +
        `⚠️ Action requise : vérifier et annuler si nécessaire.`
      );
      return;
    }

    // Sauvegarder dans Airtable
    await envoyerVersAirtable({
      "ID Commande": String(order.id || ""),
      "Client": `${order.shipping_address?.first_name || ""} ${order.shipping_address?.last_name || ""}`.trim() || analyse.prenom,
      "Email": order.email || "",
      "Téléphone": analyse.telephone,
      "Adresse": [order.shipping_address?.address1, order.shipping_address?.city].filter(Boolean).join(", "),
      "Total": analyse.total,
      "Statut": order.financial_status || "",
      "Catégorie": analyse.categorie,
      "Nb Commandes": analyse.nbCommandes,
      "Date": order.created_at
        ? new Date(order.created_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    });

    // WhatsApp au MARCHAND
    await envoyerWhatsApp(WHATSAPP_MARCHAND, sami.messageMarchand(analyse, order));

    // WhatsApp au CLIENT (si téléphone disponible)
    if (analyse.telephoneFormate) {
      const msgClient = sami.messageClient(analyse, order);
      if (msgClient) await envoyerWhatsApp(analyse.telephoneFormate, msgClient);
    }

  } catch (err) {
    console.error("❌ Erreur traitement commande:", err.message);
  }
});

// ─── COMMANDE PROVISOIRE ────────────────────
router.post("/draft-orders", async (req, res) => {
  res.status(200).send("OK");
  const draft = req.body;
  console.log("📋 Commande provisoire:", draft.id);

  try {
    const analyse = await sami.analyserCommande(draft);

    await envoyerVersAirtable({
      "ID Commande": String(draft.id || ""),
      "Client": `${draft.shipping_address?.first_name || ""} ${draft.shipping_address?.last_name || ""}`.trim() || analyse.prenom,
      "Email": draft.email || "",
      "Téléphone": analyse.telephone,
      "Total": analyse.total,
      "Statut": "PROVISOIRE",
      "Catégorie": analyse.categorie,
      "Nb Commandes": analyse.nbCommandes,
      "Date": new Date().toISOString().split("T")[0]
    });

    await envoyerWhatsApp(WHATSAPP_MARCHAND,
      `📋 *Commande Provisoire #${draft.id}*\n\n` +
      `👤 ${analyse.prenom}\n` +
      `📞 ${analyse.telephone || "Non renseigné"}\n` +
      `💰 ${draft.total_price} ${draft.currency || "DZD"}\n` +
      `🏷️ Client: ${analyse.categorie}`
    );

  } catch (err) {
    console.error("❌ Erreur draft order:", err.message);
  }
});

// ─── COLIS EXPÉDIÉ ──────────────────────────
router.post("/fulfillments", async (req, res) => {
  res.status(200).send("OK");
  const fulfillment = req.body;
  console.log("📦 Fulfillment:", fulfillment.id);

  try {
    const order = fulfillment.order || {};
    const telephone = order.shipping_address?.phone || order.customer?.phone || "";
    const prenom = order.shipping_address?.first_name || "Client";
    const tracking = fulfillment.tracking_number || "En cours";

    if (telephone) {
      const chatId = sami.formaterTelephone(telephone);
      await envoyerWhatsApp(chatId,
        `📦 Salam ${prenom} !\n\nVotre commande est en route ! 🚀\n\nNuméro de suivi: ${tracking}\n\nVous serez livré très bientôt 🙏\n\n— Équipe SAMI`
      );
    }
  } catch (err) {
    console.error("❌ Erreur fulfillment:", err.message);
  }
});const { demarrerRapportAutomatique } = require("./rapport");

// Après app.listen(...)
demarrerRapportAutomatique();


module.exports = router;

