// ======================================================
// SAMII OS - AIRTABLE
// ======================================================

const axios = require("axios");
const CONFIG = require("./config");

const HEADERS = {
    Authorization: `Bearer ${CONFIG.AIRTABLE.API_KEY}`,
    "Content-Type": "application/json"
};

// ======================================================
// Créer un enregistrement
// ======================================================

async function createRecord(table, fields) {

    const response = await axios.post(

        `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${table}`,

        {
            fields
        },

        {
            headers: HEADERS
        }

    );

    return response.data;

}

// ======================================================
// Modifier un enregistrement
// ======================================================

async function updateRecord(table, recordId, fields) {

    const response = await axios.patch(

        `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${table}/${recordId}`,

        {
            fields
        },

        {
            headers: HEADERS
        }

    );

    return response.data;

}

// ======================================================
// Lire tous les enregistrements
// ======================================================

async function getRecords(table) {

    const response = await axios.get(

        `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${table}`,

        {
            headers: HEADERS
        }

    );

    return response.data.records;

}

// ======================================================
// Rechercher avec un filtre
// ======================================================

async function findRecords(table, filterFormula) {

    const response = await axios.get(

        `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${table}?filterByFormula=${encodeURIComponent(filterFormula)}`,

        {
            headers: HEADERS
        }

    );

    return response.data.records;

}

// ======================================================
// Export
// ======================================================

module.exports = {

    createRecord,

    updateRecord,

    getRecords,

    findRecords

};
