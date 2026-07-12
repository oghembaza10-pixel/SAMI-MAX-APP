const express = require("express");
const router = express.Router();
const axios = require("axios");
const telegramService = require("../services/telegramService");
const orchestrator = require("../brain/orchestrator");
// ── ENV ──────────────────────────────────────────────
const AIRTABLE_API_KEY  = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID; // Table Commandes
const AIRTABLE_BOUTIQUES_TABLE = "tblFEs0ynJ1fy7xqW";    // Table Boutiques

const WHATSAPP_INSTANCE = process.env.WHATSAPP_INSTANCE;
const WHATSAPP_TOKEN    = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE    = process.env.WHATSAPP_PHONE;

// ── HELPER : Récupère la boutique depuis Airtable ────
async function getBoutiqueByShop(shopUrl) {
  try {
    const res = await axios.get(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_BOUTIQUES_TABLE}`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        params: {
          filterByFormula: `{shop_url} = "${shopUrl}"`,
          maxRecords: 1,
        },
      }
    );
    return res.data.records?.[0]?.fields || null;
  } catch (err) {
    console.error("❌ Airtable getBoutique:", err.message);
    return null;
  }
}

// ── HELPER : Enregistre commande dans Airtable ───────
async function saveToAirtable(order) {
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
      },
    },
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" } }
  );

  return { client, phone, address };
}

// ── HELPER : Envoie WhatsApp ─────────────────────────
async function sendWhatsApp(phone, message) {
  if (!phone || !WHATSAPP_INSTANCE || !WHATSAPP_TOKEN) return;
  await axios.post(
    `https://api.green-api.com/waInstance${WHATSAPP_INSTANCE}/sendMessage/${WHATSAPP_TOKEN}`,
    { chatId: `${WHATSAPP_PHONE}@c.us`, message }
  );
}

// ── WEBHOOK : orders/create ───────────────────────────
router.post("/orders-create", async (req, res) => {
  res.sendStatus(200);
  try {
    const order = req.body;
    const shop  = req.headers["x-shopify-shop-domain"];
await orchestrator.process({
    type: "shopify.order.created",
    shop,
    payload: order
});
    const boutique = await getBoutiqueByShop(shop);
    const { client, phone, address } = await saveToAirtable(order);
    console.log("✅ Commande enregistrée dans Airtable");

    const whatsappMsg =
      `🛒 *Nouvelle commande !*\n` +
      `👤 Client : ${client}\n` +
      `📞 Tél : ${phone}\n` +
      `📍 Adresse : ${address}\n` +
      `💰 Total : ${order.total_price} DZD\n` +
      `📦 Statut : ${order.financial_status}`;

    await Promise.allSettled([
      sendWhatsApp(phone, whatsappMsg).catch(e => console.error("❌ WhatsApp:", e.message)),
      boutique?.telegram_chat_id && boutique?.telegram_actif
        ? telegramService.notifyNewOrder(boutique.telegram_chat_id, order)
        : Promise.resolve(),
    ]);

    console.log("✅ Notifications envoyées (orders/create)");
  } catch (err) {
    console.error("❌ orders/create:", err.response?.data || err.message);
  }
});

// ── WEBHOOK : orders/updated ──────────────────────────
router.post("/orders-updated", async (req, res) => {
  res.sendStatus(200);
  try {
    const order = req.body;
    const shop  = req.headers["x-shopify-shop-domain"];
    const boutique = await getBoutiqueByShop(shop);
    const phone  = order.shipping_address?.phone || order.customer?.phone || "";
    const client = `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim();

    const whatsappMsg =
      `🔄 *Commande mise à jour*\n` +
      `👤 ${client} | #${order.order_number}\n` +
      `📦 Statut : ${order.fulfillment_status || order.financial_status}`;

    await Promise.allSettled([
      sendWhatsApp(phone, whatsappMsg).catch(e => console.error("❌ WhatsApp:", e.message)),
      boutique?.telegram_chat_id && boutique?.telegram_actif
        ? telegramService.send(boutique.telegram_chat_id, whatsappMsg)
        : Promise.resolve(),
    ]);

    console.log("✅ Notifications envoyées (orders/updated)");
  } catch (err) {
    console.error("❌ orders/updated:", err.response?.data || err.message);
  }
});

// ── WEBHOOK : orders/fulfilled ────────────────────────
router.post("/orders-fulfilled", async (req, res) => {
  res.sendStatus(200);
  try {
    const order = req.body;
    const shop  = req.headers["x-shopify-shop-domain"];
    const boutique = await getBoutiqueByShop(shop);
    const phone  = order.shipping_address?.phone || order.customer?.phone || "";

    const tracking = order.fulfillments?.[0]?.tracking_number || "N/A";
    const carrier  = order.fulfillments?.[0]?.tracking_company || "N/A";
    const client   = `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim();

    const whatsappMsg =
      `🚚 *Commande expédiée !*\n` +
      `👤 ${client} | #${order.order_number}\n` +
      `📦 Transporteur : ${carrier}\n` +
      `🔍 Tracking : ${tracking}`;

    await Promise.allSettled([
      sendWhatsApp(phone, whatsappMsg).catch(e => console.error("❌ WhatsApp:", e.message)),
      boutique?.telegram_chat_id && boutique?.telegram_actif
        ? telegramService.notifyOrderFulfilled(boutique.telegram_chat_id, order)
        : Promise.resolve(),
    ]);

    console.log("✅ Notifications envoyées (orders/fulfilled)");
  } catch (err) {
    console.error("❌ orders/fulfilled:", err.response?.data || err.message);
  }
});

// ── WEBHOOK : orders/cancelled ────────────────────────
router.post("/orders-cancelled", async (req, res) => {
  res.sendStatus(200);
  try {
    const order = req.body;
    const shop  = req.headers["x-shopify-shop-domain"];
    const boutique = await getBoutiqueByShop(shop);
    const phone  = order.shipping_address?.phone || order.customer?.phone || "";
    const client = `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim();

    const whatsappMsg =
      `❌ *Commande annulée*\n` +
      `👤 ${client} | #${order.order_number}\n` +
      `💬 Raison : ${order.cancel_reason || "Non précisée"}`;

    await Promise.allSettled([
      sendWhatsApp(phone, whatsappMsg).catch(e => console.error("❌ WhatsApp:", e.message)),
      boutique?.telegram_chat_id && boutique?.telegram_actif
        ? telegramService.notifyOrderCancelled(boutique.telegram_chat_id, order)
        : Promise.resolve(),
    ]);

    console.log("✅ Notifications envoyées (orders/cancelled)");
  } catch (err) {
    console.error("❌ orders/cancelled:", err.response?.data || err.message);
  }
});

// ── WEBHOOK : products/update (stock faible) ──────────
router.post("/products-update", async (req, res) => {
  res.sendStatus(200);
  try {
    const product = req.body;
    const shop    = req.headers["x-shopify-shop-domain"];
    const boutique = await getBoutiqueByShop(shop);

    const lowStock = product.variants?.filter(v => v.inventory_quantity <= 5) || [];

    for (const variant of lowStock) {
      const whatsappMsg =
        `⚠️ *Stock faible — ${product.title}*\n` +
        `• ${variant.title} → ${variant.inventory_quantity} restants`;

      await Promise.allSettled([
        sendWhatsApp(null, whatsappMsg).catch(e => console.error("❌ WhatsApp:", e.message)),
        boutique?.telegram_chat_id && boutique?.telegram_actif
          ? telegramService.notifyLowStock(boutique.telegram_chat_id, product.title, variant.inventory_quantity)
          : Promise.resolve(),
      ]);
    }

    console.log("✅ Alertes stock envoyées");
  } catch (err) {
    console.error("❌ products/update:", err.response?.data || err.message);
  }
});

// ── WEBHOOK : app/uninstalled ─────────────────────────
router.post("/app-uninstalled", async (req, res) => {
  res.sendStatus(200);
  try {
    const shop = req.headers["x-shopify-shop-domain"] || "inconnu";
    console.warn(`⚠️ App désinstallée : ${shop}`);

    const boutique = await getBoutiqueByShop(shop);

    await Promise.allSettled([
      boutique?.telegram_chat_id
        ? telegramService.send(boutique.telegram_chat_id, `🔴 *App désinstallée*\nBoutique : ${shop}`)
        : Promise.resolve(),
      // 🔜 Marquer inactif dans Airtable ici
    ]);

  } catch (err) {
    console.error("❌ app/uninstalled:", err.message);
  }
});

module.exports = router;


