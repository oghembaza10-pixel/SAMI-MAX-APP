const express = require("express");
const router  = express.Router();
const axios   = require("axios");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_BOUTIQUES  = process.env.TABLE_BOUTIQUES;

async function getBoutiqueRecord(shopUrl) {
  const res = await axios.get(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}`,
    {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      params : { filterByFormula: `{shop_url} = "${shopUrl}"`, maxRecords: 1 },
    }
  );
  return res.data.records?.[0] || null;
}

async function patchBoutique(recordId, fields) {
  await axios.patch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}/${recordId}`,
    { fields },
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" } }
  );
}

// ── GET /connect/shopify ──────────────────────────────
router.get("/shopify", async (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.redirect("/auth/shopify");

  const record = await getBoutiqueRecord(shop);
  const fields = record?.fields || {};

  res.render("connect/shopify", {
    shop,
    nomBoutique  : fields.nom_boutique || shop,
    dateConnexion: fields.date_connexion || "—",
    webhooksActifs: fields.webhooks_actifs || false,
  });
});

// ── GET /connect/telegram ─────────────────────────────
router.get("/telegram", async (req, res) => {
  const shop = req.query.shop;
  const record = shop ? await getBoutiqueRecord(shop) : null;
  const fields = record?.fields || {};

  res.render("connect/telegram", {
    shop          : shop || "",
    telegramChatId: fields.telegram_chat_id || "",
    telegramActif : fields.telegram_actif   || false,
  });
});

// ── POST /connect/telegram ────────────────────────────
router.post("/telegram", async (req, res) => {
  const { shop, telegram_chat_id, telegram_actif } = req.body;
  try {
    const record = await getBoutiqueRecord(shop);
    if (!record) return res.status(404).json({ error: "Boutique introuvable" });

    await patchBoutique(record.id, {
      telegram_chat_id: String(telegram_chat_id),
      telegram_actif  : telegram_actif === "true" || telegram_actif === true,
    });

    res.redirect(`/hub?shop=${shop}`);
  } catch (err) {
    console.error("❌ connect/telegram POST:", err.message);
    res.status(500).send("Erreur serveur");
  }
});

// ── GET /connect/whatsapp ─────────────────────────────
router.get("/whatsapp", async (req, res) => {
  const shop = req.query.shop;
  const record = shop ? await getBoutiqueRecord(shop) : null;
  const fields = record?.fields || {};

  res.render("connect/whatsapp", {
    shop         : shop || "",
    whatsappPhone: fields.whatsapp_phone || "",
    whatsappActif: fields.whatsapp_actif || false,
  });
});

// ── POST /connect/whatsapp ────────────────────────────
router.post("/whatsapp", async (req, res) => {
  const { shop, whatsapp_phone, whatsapp_actif } = req.body;
  try {
    const record = await getBoutiqueRecord(shop);
    if (!record) return res.status(404).json({ error: "Boutique introuvable" });

    await patchBoutique(record.id, {
      whatsapp_phone: String(whatsapp_phone),
      whatsapp_actif: whatsapp_actif === "true" || whatsapp_actif === true,
    });

    res.redirect(`/hub?shop=${shop}`);
  } catch (err) {
    console.error("❌ connect/whatsapp POST:", err.message);
    res.status(500).send("Erreur serveur");
  }
});

module.exports = router;
