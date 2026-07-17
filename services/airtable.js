/**
 * ============================================================
 * OG • Airtable Service V2
 * Couche unique pour toutes les tables Airtable
 * ============================================================
 */

const axios = require("axios");

const BASE  = process.env.AIRTABLE_BASE_ID;
const TOKEN = process.env.AIRTABLE_API_KEY;

const TABLES = {
    BOUTIQUES      : process.env.TABLE_BOUTIQUES,
    COMMANDES      : process.env.TABLE_COMMANDES,
    CLIENTS        : process.env.TABLE_CLIENTS,
    CONVERSATIONS  : process.env.TABLE_CONVERSATIONS,
    PAIEMENTS      : process.env.TABLE_PAIEMENTS,
    NOTIFICATIONS  : process.env.TABLE_NOTIFICATIONS,
    JOURNAL        : process.env.TABLE_JOURNAL,
    LOGS           : process.env.TABLE_LOGS,
    STOCK          : process.env.TABLE_STOCK,
    LIVRAISONS     : process.env.TABLE_LIVRAISONS,
    CONNEXIONS     : process.env.TABLE_CONNEXIONS,
    AUTOMATISATIONS: process.env.TABLE_AUTOMATISATIONS,
    FACTURES       : process.env.TABLE_FACTURES,
    EMPLOYES       : process.env.TABLE_EMPLOYES,
    FOURNISSEURS   : process.env.TABLE_FOURNISSEURS,
    DOCUMENTS      : process.env.TABLE_DOCUMENTS,
    MODULES        : process.env.TABLE_MODULES,
    MOTEURS        : process.env.TABLE_MOTEURS,
    UTILISATEURS   : process.env.TABLE_UTILISATEURS,
};

const headers = () => ({
    Authorization : `Bearer ${TOKEN}`,
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
                params : { filterByFormula: formula, maxRecords: max },
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

// ── GET BOUTIQUE ─────────────────────────────────────
async function getBoutique(shop) {
    return await findOne("BOUTIQUES", `{shop_url}="${shop}"`);
}

// ── GET COMMANDES ────────────────────────────────────
async function getCommandes(shop, max = 100) {
    return await find("COMMANDES", `{Boutique}="${shop}"`, max);
}

// ── GET CLIENTS ──────────────────────────────────────
async function getClients(shop, max = 50) {
    return await find("CLIENTS", `{Boutique}="${shop}"`, max);
}

// ── GET CLIENT ───────────────────────────────────────
async function getClient(phone, shop) {
    return await findOne("CLIENTS", `AND({Téléphone}="${phone}",{Boutique}="${shop}")`);
}

// ── SAVE COMMANDE ────────────────────────────────────
async function saveCommande(fields) {
    return await create("COMMANDES", fields);
}

// ── SAVE CLIENT ──────────────────────────────────────
async function saveClient(fields) {
    return await create("CLIENTS", fields);
}

// ── LOG ──────────────────────────────────────────────
async function log(action, details, shop = "") {
    return await create("LOGS", {
        "statut" : action,
        "Type"   : "Système",
        "Message": typeof details === "object" ? JSON.stringify(details) : details,
        "Niveau" : "Moyen",
        "Source" : shop || "",
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
        "Nom"   : `[${type}] ${message}`,
        "Statut": "non lu",
    });
}

module.exports = {
    TABLES,
    create,
    find,
    findOne,
    update,
    remove,
    getBoutique,
    getCommandes,
    getClients,
    getClient,
    saveCommande,
    saveClient,
    log,
    journal,
    notification,
};
