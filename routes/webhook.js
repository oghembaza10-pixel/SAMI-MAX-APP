const express = require("express");
const router = express.Router();
const axios = require("axios");
const telegramService = require("../services/telegramService");

// ── ENV ──────────────────────────────────────────────
const AIRTABLE_API_KEY   = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID   = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID  = process.env.AIRTABLE_TABLE_ID;

const WHATSAPP_INSTANCE  = process.env.WHATSAPP_INSTANCE;
const WHATSAPP_TOKEN     = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE     = process.env.WHATSAPP_PHONE;

// ── HELPERS ──────────────────────────────────────────

/** Enregistre la commande dans Airtable */
async function saveToAirtable(order, extraFields = {}) {
  const client  = `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim();
  const phone   = order.shipping_address?.phone || order.customer?.phone || "";
  const address = order.shipping_address
    ? `${order.shipping_address.address1}, ${order.shipping_address.city}`
    : "";

  await axios.post(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
    {
      fields: {
        "ID Commande": String(order.id || ""),
        "Client"     : client,
        "Adresse"    : address,
        "Téléphone"  : phone,
        "Total"      : Number(order.total_price || 0),
        "Statut"     : order.financial_status || "pending",
        "Date"       : order.created_at || new Date().toISOString(),
        ...extraFields,
      },
    },
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" } }
  );
  return { client, phone, address };
}

/** Envoie une notif WhatsApp (Green-API) */
async function sendWhatsApp(phone, message) {
  if (!phone || !WHATSAPP_INSTANCE || !WHATSAPP_TOKEN) return;
  await axios.post(
    `https://api.green-api.com/waInstance${WHATSAPP_INSTANCE}/sendMessage/${WHATSAPP_TOKEN}`,
    { chatId: `${WHATSAPP_PHONE}@c.us`, message }
  );
}

/** Envoie une notif Telegram */
async function sendTelegram(message) {
  try {
    await telegramService.sendMessage(message);
  } catch (err) {
    console.error("❌ Telegram:", err.message);
  }
}

/** Notifie tous les canaux actifs */
async function notifyAll(message, phone = null) {
  const tasks = [];
  if (phone)                          tasks.push(sendWhatsApp(phone, message).catch(e => console.error("❌ WhatsApp:", e.message)));
  if (process.env.TELEGRAM_BOT_TOKEN) tasks.push(sendTelegram(message));
  // 🔜 Google Chat / Meta / autres → ajouter ici
  await Promise.allSettled(tasks);
}

// ── WEBHOOK : orders/create ───────────────────────────
router.post("/orders-create", async (req, res) => {
  res.sendStatus(200);
  try {
    const order = req.body;
    const { client, phone, address } = await saveToAirtable(order);
    console.log("✅ Commande enregistrée dans Airtable");

    const msg =
      `🛒 *Nouvelle commande !*\n` +
      `👤 Client : ${client}\n` +
      `📞 Tél : ${phone}\n` +
      `📍 Adresse : ${address}\n` +
      `💰 Total : ${order.total_price} $\n` +
      `📦 Statut : ${order.financial_status}`;

    await notifyAll(msg, phone);
    console.log("✅ Notifications envoyées");

  } catch (err) {
    console.error("❌ orders/create:", err.response?.data || err.message);
  }
});

// ── WEBHOOK : orders/updated ──────────────────────────
router.post("/orders-updated", async (req, res) => {
  res.sendStatus(200);
  try {
    const order = req.body;
    const phone  = order.shipping_address?.phone || order.customer?.phone || "";
    const client = `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim();

    const msg =
      `🔄 *Commande mise à jour*\n` +
      `👤 ${client} | #${order.order_number}\n` +
      `📦 Statut : ${order.fulfillment_status || order.financial_status}`;

    await notifyAll(msg, phone);

  } catch (err) {
    console.error("❌ orders/updated:", err.response?.data || err.message);
  }
});

// ── WEBHOOK : orders/fulfilled ────────────────────────
router.post("/orders-fulfilled", async (req, res) => {
  res.sendStatus(200);
  try {
    const order = req.body;
    const phone  = order.shipping_address?.phone || order.customer?.phone || "";
    const client = `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim();
    const tracking = order.fulfillments?.[0]?.tracking_number || "N/A";
    const carrier  = order.fulfillments?.[0]?.tracking_company || "N/A";

    const msg =
      `🚚 *Commande expédiée !*\n` +
      `👤 ${client} | #${order.order_number}\n` +
      `📦 Transporteur : ${carrier}\n` +
      `🔍 Tracking : ${tracking}`;

    await notifyAll(msg, phone);

  } catch (err) {
    console.error("❌ orders/fulfilled:", err.response?.data || err.message);
  }
});

// ── WEBHOOK : orders/cancelled ────────────────────────
router.post("/orders-cancelled", async (req, res) => {
  res.sendStatus(200);
  try {
    const order = req.body;
    const phone  = order.shipping_address?.phone || order.customer?.phone || "";
    const client = `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim();

    const msg =
      `❌ *Commande annulée*\n` +
      `👤 ${client} | #${order.order_number}\n` +
      `💬 Raison : ${order.cancel_reason || "Non précisée"}`;

    await notifyAll(msg, phone);

  } catch (err) {
    console.error("❌ orders/cancelled:", err.response?.data || err.message);
  }
});

// ── WEBHOOK : products/update (stock) ────────────────
router.post("/products-update", async (req, res) => {
  res.sendStatus(200);
  try {
    const product = req.body;
    const lowStock = product.variants?.filter(v => v.inventory_quantity <= 5) || [];

    if (lowStock.length > 0) {
      const lines = lowStock.map(v => `  • ${v.title} → ${v.inventory_quantity} restants`).join("\n");
      const msg =
        `⚠️ *Stock faible — ${product.title}*\n${lines}`;
      await notifyAll(msg);
    }

  } catch (err) {
    console.error("❌ products/update:", err.response?.data || err.message);
  }
});

// ── WEBHOOK : app/uninstalled ─────────────────────────
router.post("/app-uninstalled", async (req, res) => {
  res.sendStatus(200);
  try {
    const shop = req.headers["x-shopify-shop-domain"] || "inconnu";
    console.warn(`⚠️ App désinstallée par : ${shop}`);
    await notifyAll(`🔴 *App désinstallée*\nBoutique : ${shop}`);
    // 🔜 Marquer comme inactif dans Airtable ici
  } catch (err) {
    console.error("❌ app/uninstalled:", err.message);
  }
});

module.exports = router;


