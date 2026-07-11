const express = require("express");
const router = express.Router();
const axios = require("axios");

const AIRTABLE_API_KEY       = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID       = process.env.AIRTABLE_BASE_ID;
const TABLE_BOUTIQUES        = process.env.TABLE_BOUTIQUES;

async function getBoutique(shopUrl) {
  try {
    const res = await axios.get(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        params : { filterByFormula: `{shop_url} = "${shopUrl}"`, maxRecords: 1 },
      }
    );
    return res.data.records?.[0]?.fields || null;
  } catch {
    return null;
  }
}

router.get("/", async (req, res) => {
  const shop = req.query.shop;

  // Sans shop → hub vitrine normale (pas encore connecté)
  if (!shop) {
    return res.render("hub", { connectedPlatforms: [] });
  }

  const boutique = await getBoutique(shop);

  // Calcule les plateformes connectées
  const connectedPlatforms = [];
  if (boutique) {
    connectedPlatforms.push("shopify");
    if (boutique.telegram_actif && boutique.telegram_chat_id) connectedPlatforms.push("telegram");
    if (boutique.whatsapp_actif && boutique.whatsapp_phone)   connectedPlatforms.push("whatsapp");
  }

  res.render("hub", { connectedPlatforms });
});

module.exports = router;

