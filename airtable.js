// ======================================================
// SAMII OS - AIRTABLE
// ======================================================

const axios  = require("axios");
const CONFIG = require("./config");

const HEADERS = {
    Authorization: `Bearer ${CONFIG.AIRTABLE.API_KEY}`,
    "Content-Type": "application/json"
};

// ── NOMS DES TABLES ───────────────────────────────────
const TABLES = {
    BOUTIQUES      : "TABLE_BOUTIQUES",
    COMMANDES      : "Commandes",
    LOGS           : "ID Log",
    NOTIFICATIONS  : "ID Notifications",
    AUTOMATISATIONS: "Automatisations",
};

// ======================================================
// Créer un enregistrement
// ======================================================
async function createRecord(table, fields) {
    const response = await axios.post(
        `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${encodeURIComponent(table)}`,
        { fields },
        { headers: HEADERS }
    );
    return response.data;
}

// ======================================================
// Modifier un enregistrement
// ======================================================
async function updateRecord(table, recordId, fields) {
    const response = await axios.patch(
        `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${encodeURIComponent(table)}/${recordId}`,
        { fields },
        { headers: HEADERS }
    );
    return response.data;
}

// ======================================================
// Lire tous les enregistrements
// ======================================================
async function getRecords(table) {
    const response = await axios.get(
        `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${encodeURIComponent(table)}`,
        { headers: HEADERS }
    );
    return response.data.records;
}

// ======================================================
// Rechercher avec un filtre
// ======================================================
async function findRecords(table, filterFormula) {
    const response = await axios.get(
        `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${encodeURIComponent(table)}?filterByFormula=${encodeURIComponent(filterFormula)}`,
        { headers: HEADERS }
    );
    return response.data.records;
}

// ======================================================
// Helpers métier
// ======================================================

async function saveOrder(shop, order) {
    try {
        return await createRecord(TABLES.COMMANDES, {
            "ID Commande"  : String(order.id || ""),
            "Lien Boutique": shop || "",
            "Nom Client"   : order.billing_address?.name || order.customer?.first_name || "",
            "Téléphone"    : order.billing_address?.phone || order.customer?.phone || "",
            "Ville"        : order.billing_address?.city || "",
            "Statut"       : order.financial_status || "pending",
        });
    } catch (err) {
        console.error("❌ Airtable COMMANDES :", err.response?.data || err.message);
    }
}

async function log(type, message, shop = "", niveau = "Moyen") {
    try {
        return await createRecord(TABLES.LOGS, {
            "ID Log"        : String(Date.now()),
            "Lien Boutique" : shop || "",
            "Type"          : type || "Système",
            "Message"       : message || "",
            "Statut"        : niveau,
        });
    } catch (err) {
        console.error("❌ Airtable LOGS :", err.response?.data || err.message);
    }
}

async function saveNotification(data = {}) {
    try {
        return await createRecord(TABLES.NOTIFICATIONS, {
            "Name"  : data.name    || "",
            "Notes" : data.message || "",
            "Status": data.status  || "",
        });
    } catch (err) {
        console.error("❌ Airtable NOTIFICATIONS :", err.response?.data || err.message);
    }
}

async function findAutomations(trigger) {
    try {
        const records = await findRecords(
            TABLES.AUTOMATISATIONS,
            `{Trigger} = "${trigger}"`
        );
        return records.map(r => r.fields);
    } catch (err) {
        console.error("❌ Airtable AUTOMATISATIONS :", err.response?.data || err.message);
        return [];
    }
}

async function findShop(shop) {
    try {
        const records = await findRecords(
            TABLES.BOUTIQUES,
            `{shop_url} = "${shop}"`
        );
        return records.length ? records[0].fields : null;
    } catch (err) {
        console.error("❌ Airtable BOUTIQUES :", err.response?.data || err.message);
        return null;
    }
}

// ======================================================
// Export
// ======================================================
module.exports = {
    createRecord,
    updateRecord,
    getRecords,
    findRecords,
    saveOrder,
    log,
    saveNotification,
    findAutomations,
    findShop,
};

