// ======================================================
// SAMII OS - CONFIGURATION CENTRALE
// ======================================================

module.exports = {

    PORT: process.env.PORT || 10000,

    AIRTABLE: {

        API_KEY: process.env.AIRTABLE_API_KEY,

        BASE_ID: process.env.AIRTABLE_BASE_ID,

        TABLES: {

            QG: process.env.TABLE_QG,

            UTILISATEURS: process.env.TABLE_UTILISATEURS,

            BOUTIQUES: process.env.TABLE_BOUTIQUES,

            COMMANDES: process.env.TABLE_COMMANDES,

            CONVERSATIONS: process.env.TABLE_CONVERSATIONS,

            FACTURES: process.env.TABLE_FACTURES,

            MOTEUR: process.env.TABLE_MOTEUR,

            PAYS: process.env.TABLE_PAYS,

            LOGS: process.env.TABLE_LOGS

        }

    },

    SHOPIFY: {

        DOMAIN: process.env.SHOPIFY_SHOP_DOMAIN,

        TOKEN: process.env.SHOPIFY_ACCESS_TOKEN

    },

    GEMINI: {

        API_KEY: process.env.GEMINI_API_KEY

    }

};
