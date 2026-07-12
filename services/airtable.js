/**
 * ============================================================
 * OG • Airtable Service
 * Couche unique pour toutes les tables Airtable
 * ============================================================
 */

const axios = require("axios");

const BASE    = process.env.AIRTABLE_BASE_ID;
const TOKEN   = process.env.AIRTABLE_API_KEY;

const TABLES = {
    BOUTIQUES      : "tblFEs0ynJ1fy7xqW",
    COMMANDES      : process.env.AIRTABLE_TABLE_ID,
    CLIENTS        : "CLIENTS",
    CONVERSATIONS  : "CONVERSATIONS",
    PAIEMENTS      : "PAIEMENTS",
    NOTIFICATIONS  : "NOTIFICATIONS",
    JOURNAL        : "JOURNAL",
    LOGS           : "LOGS",
    STOCK          : "STOCK",
    LIVRAISONS     : "LIVRAISONS",
    CONNEXIONS     : "CONNEXIONS",
    AUTOMATISATIONS: "AUTOMATISATIONS",
    FACTURES       : "FACTURES",
    EMPLOYES       : "EMPLOYES",
    FOURNISSEURS   : "FOURNISSEURS",
    DOCUMENTS      : "DOCUMENTS",
    MODULES        : "MODULES",
    MOTEURS        : "MOTEURS",
};

const headers = () => ({
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
});

// ── CREATE ───────────────────────────────────────────
async function create(table, fields) {
    try {
        const res = await axios.post(
            `https://api.airtable.com/v0/${BASE}/${TABLES[table] || table}`,
            { fields },
            { headers: headers() }
        );
        return res.data;
    } catch (err) {
        console.error(`❌ Airtable create [${table}]:`, err.response?.data || err.message);
        return null;
    }
}

// ── FIND ─────────────────────────────────────────────
async function find(table, formula, max = 10) {
    try {
        const res = await axios.get(
            `https://api.airtable.com/v0/${BASE}/${TABLES[table] || table}`,
            {
                headers: headers(),
                params: { filterByFormula: formula, maxRecords: max },
            }
        );
        return res.data.records || [];
    } catch (err) {
        console.error(`❌ Airtable find [${table}]:`, err.response?.data || err.message);
        return [];
    }
}

// ── FIND ONE ─────────────────────────────────────────
async function findOne(table, formula) {
    const records = await find(table, formula, 1);
    return records[0] || null;
}

// ── UPDATE ───────────────────────────────────────────
async function update(table, recordId, fields) {
    try {
        const res = await axios.patch(
            `https://api.airtable.com/v0/${BASE}/${TABLES[table] || table}/${recordId}`,
            { fields },
            { headers: headers() }
        );
        return res.data;
    } catch (err) {
        console.error(`❌ Airtable update [${table}]:`, err.response?.data || err.message);
        return null;
    }
}

// ── DELETE ───────────────────────────────────────────
async function remove(table, recordId) {
    try {
        await axios.delete(
            `https://api.airtable.com/v0/${BASE}/${TABLES[table] || table}/${recordId}`,
            { headers: headers() }
        );
        return true;
    } catch (err) {
        console.error(`❌ Airtable delete [${table}]:`, err.response?.data || err.message);
        return false;
    }
}

// ── LOG ──────────────────────────────────────────────
async function log(action, details, shop = "") {
    return await create("LOGS", {
        "Action"  : action,
        "Détails" : typeof details === "object" ? JSON.stringify(details) : details,
        "Boutique": shop,
        "Date"    : new Date().toISOString(),
    });
}

// ── JOURNAL ──────────────────────────────────────────
async function journal(action, details, shop = "") {
    return await create("JOURNAL", {
        "Action"  : action,
        "Détails" : typeof details === "object" ? JSON.stringify(details) : details,
        "Boutique": shop,
        "Date"    : new Date().toISOString(),
    });
}

// ── NOTIFICATION ─────────────────────────────────────
async function notification(type, message, shop = "") {
    return await create("NOTIFICATIONS", {
        "Type"    : type,
        "Message" : message,
        "Boutique": shop,
        "Date"    : new Date().toISOString(),
        "Lu"      : false,
    });
}

module.exports = {
    TABLES,
    create,
    find,
    findOne,
    update,
    remove,
    log,
    journal,
    notification,
};
