// ======================================================
// SAMII OS — AIRTABLE SERVICE
// Couche unique d'accès aux données
// ======================================================

const axios  = require("axios");
const CONFIG = require("./config");

// ── CLIENT AXIOS AVEC TIMEOUT ─────────────────────────
const http = axios.create({
    timeout: 10000,
    headers: {
        Authorization: `Bearer ${CONFIG.AIRTABLE.API_KEY}`,
        "Content-Type": "application/json"
    }
});

const BASE = `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}`;

// ── NOMS DES TABLES DEPUIS CONFIG ─────────────────────
const TABLES = {
    BOUTIQUES      : CONFIG.AIRTABLE.TABLE_BOUTIQUES,
    COMMANDES      : CONFIG.AIRTABLE.TABLE_COMMANDES,
    LOGS           : CONFIG.AIRTABLE.TABLE_LOGS,
    NOTIFICATIONS  : CONFIG.AIRTABLE.TABLE_NOTIFICATIONS,
    AUTOMATISATIONS: CONFIG.AIRTABLE.TABLE_AUTOMATISATIONS,
};

// ======================================================
// CRUD DE BASE
// ======================================================

async function createRecord(table, fields) {
    const res = await http.post(
        `${BASE}/${encodeURIComponent(table)}`,
        { fields }
    );
    return res.data;
}

async function updateRecord(table, recordId, fields) {
    const res = await http.patch(
        `${BASE}/${encodeURIComponent(table)}/${recordId}`,
        { fields }
    );
    return res.data;
}

async function getRecords(table) {
    const res = await http.get(
        `${BASE}/${encodeURIComponent(table)}`
    );
    return res.data.records;
}

async function findRecords(table, filterFormula) {
    const res = await http.get(
        `${BASE}/${encodeURIComponent(table)}?filterByFormula=${encodeURIComponent(filterFormula)}`
    );
    return res.data.records;
}

async function deleteRecord(table, recordId) {
    const res = await http.delete(
        `${BASE}/${encodeURIComponent(table)}/${recordId}`
    );
    return res.data;
}

// ======================================================
// HELPERS MÉTIER
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
        console.error("❌ Airtable saveOrder :", err.response?.data || err.message);
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
        console.error("❌ Airtable log :", err.response?.data || err.message);
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
        console.error("❌ Airtable saveNotification :", err.response?.data || err.message);
    }
}

async function notification(channel, message, shop = "") {
    return await saveNotification({
        name   : `${channel} → ${shop}`,
        message: message,
        status : "envoyé",
    });
}

async function findAutomations(trigger) {
    try {
        const records = await findRecords(
            TABLES.AUTOMATISATIONS,
            `{Trigger} = "${trigger}"`
        );
        return records.map(r => r.fields);
    } catch (err) {
        console.error("❌ Airtable findAutomations :", err.response?.data || err.message);
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
        console.error("❌ Airtable findShop :", err.response?.data || err.message);
        return null;
    }
}

async function getBoutique(shop) {
    try {
        const records = await findRecords(
            TABLES.BOUTIQUES,
            `{shop_url} = "${shop}"`
        );
        return records.length ? records[0] : null;
    } catch (err) {
        console.error("❌ Airtable getBoutique :", err.response?.data || err.message);
        return null;
    }
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
    createRecord,
    updateRecord,
    getRecords,
    findRecords,
    deleteRecord,
    saveOrder,
    log,
    saveNotification,
    notification,
    findAutomations,
    findShop,
    getBoutique,
};

