// ======================================================
// SAMII OS - CONFIGURATION CENTRALE
// ======================================================

module.exports = {

    PORT: process.env.PORT || 10000,

    // ==================================================
    // AIRTABLE
    // ==================================================

    AIRTABLE: {

        API_KEY: process.env.AIRTABLE_API_KEY,

        BASE_ID: process.env.AIRTABLE_BASE_ID,

        TABLES: {

            HUB: process.env.TABLE_HUB,
            SAMII_QG: process.env.TABLE_SAMIIQG,
            QG: process.env.TABLE_QG,

            UTILISATEURS: process.env.TABLE_UTILISATEURS,
            CLIENTS: process.env.TABLE_CLIENTS,
            EMPLOYES: process.env.TABLE_EMPLOYES,
            BOUTIQUES: process.env.TABLE_BOUTIQUES,

            MODULES: process.env.TABLE_MODULES,

            COMMANDES: process.env.TABLE_COMMANDES,
            PRODUITS: process.env.TABLE_PRODUITS,
            STOCK: process.env.TABLE_STOCK,

            PAIEMENTS: process.env.TABLE_PAIEMENTS,
            FACTURES: process.env.TABLE_FACTURES,

            FOURNISSEURS: process.env.TABLE_FOURNISSEURS,

            DOCUMENTS: process.env.TABLE_DOCUMENTS,
            CONVERSATIONS: process.env.TABLE_CONVERSATIONS,

            LIVRAISONS: process.env.TABLE_LIVRAISONS,
            RESERVATIONS: process.env.TABLE_RESERVATIONS,
            MENUS: process.env.TABLE_MENUS,
            CUISINE: process.env.TABLE_CUISINE,

            PAYS: process.env.TABLE_PAYS,
            METIERS: process.env.TABLE_METIERS,

            AUTOMATISATIONS: process.env.TABLE_AUTOMATISATIONS,
            CONNEXIONS: process.env.TABLE_CONNEXIONS,
            NOTIFICATIONS: process.env.TABLE_NOTIFICATIONS,

            JOURNAL: process.env.TABLE_JOURNAL,
            LOGS: process.env.TABLE_LOGS

        }

    },

    // ==================================================
    // SHOPIFY
    // ==================================================

    SHOPIFY: {

        DOMAIN: process.env.SHOPIFY_SHOP_DOMAIN,

        TOKEN: process.env.SHOPIFY_ACCESS_TOKEN

    },

    // ==================================================
    // GEMINI
    // ==================================================

    GEMINI: {

        API_KEY: process.env.GEMINI_API_KEY

    },

    // ==================================================
    // META
    // ==================================================

    META: {

        APP_ID: process.env.META_APP_ID,

        APP_SECRET: process.env.META_APP_SECRET,

        REDIRECT_URI: process.env.META_REDIRECT_URI

    },

    // ==================================================
    // WHATSAPP
    // ==================================================

    WHATSAPP: {

        INSTANCE: process.env.Instance,

        API_KEY: process.env.GREENDAPIWATSAP,

        NUMBER: process.env.WATSAP_NUMBER

    }

};
