// services/journalService.js

async function log(shop, message) {
    console.log(`📓 [${shop}] ${message}`);
    // V2 → écrire dans Airtable TABLE JOURNAL
}

module.exports = { log };
