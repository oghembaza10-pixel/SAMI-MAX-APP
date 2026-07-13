// services/settingsService.js

const axios = require("axios");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_BOUTIQUES  = process.env.TABLE_BOUTIQUES;

const headers = {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
};

async function getBoutique(shop) {
    const res = await axios.get(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}?filterByFormula={shop_url}="${shop}"`,
        { headers }
    );
    return res.data.records[0] || null;
}

async function updateBoutique(shop, fields) {
    const record = await getBoutique(shop);
    if (!record) return;
    await axios.patch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}/${record.id}`,
        { fields },
        { headers }
    );
}

async function createDefault(shop) {
    console.log(`⚙️ Settings créés : ${shop}`);
    await updateBoutique(shop, {
        status:      "actif",
        plan:        "gratuit",
        samii_actif: true,
    });
}

async function deactivate(shop) {
    console.log(`⚙️ Settings désactivés : ${shop}`);
    await updateBoutique(shop, {
        status:      "inactif",
        samii_actif: false,
        date_desinstall: new Date().toISOString().split("T")[0],
    });
}

async function downgrade(shop) {
    console.log(`⚙️ Downgrade : ${shop}`);
    await updateBoutique(shop, { plan: "gratuit" });
}

module.exports = { createDefault, deactivate, downgrade };
