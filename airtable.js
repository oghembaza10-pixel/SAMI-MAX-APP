// ======================================================
// SAMII OS - AIRTABLE
// ======================================================

const axios = require("axios");
const CONFIG = require("./config");

async function createRecord(table, fields) {

    return axios.post(

        `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${table}`,

        {
            fields
        },

        {
            headers: {

                Authorization: `Bearer ${CONFIG.AIRTABLE.API_KEY}`,
                "Content-Type": "application/json"

            }

        }

    );

}

async function updateRecord(table, recordId, fields) {

    return axios.patch(

        `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}/${table}/${recordId}`,

        {
            fields
        },

        {
            headers: {

                Authorization: `Bearer ${CONFIG.AIRTABLE.API_KEY}`,
                "Content-Type": "application/json"

            }

        }

    );

}

module.exports = {

    createRecord,

    updateRecord

};
