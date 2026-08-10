// ======================================================
// SAMII OS - CONFIGURATION CENTRALE
// ======================================================

module.exports = {

    PORT: process.env.PORT || 10000,

    APP_URL: process.env.APP_URL || "https://samii.souverain-store.com",

    // ==================================================
    // AIRTABLE
    // ==================================================

    AIRTABLE: {

        API_KEY: process.env.AIRTABLE_API_KEY,
        BASE_ID: process.env.AIRTABLE_BASE_ID,

        TABLES: {

            // ── HUB ───────────────────────────────────
            HUB          : process.env.TABLE_HUB,
            SAMII_QG     : process.env.TABLE_SAMIIQG,
            QG           : process.env.TABLE_QG,

            // ── UTILISATEURS ──────────────────────────
            UTILISATEURS : process.env.TABLE_UTILISATEURS,
            CLIENTS      : process.env.TABLE_CLIENTS,
            EMPLOYES     : process.env.TABLE_EMPLOYES,
            BOUTIQUES    : process.env.TABLE_BOUTIQUES,

            // ── MODULES ───────────────────────────────
            MODULES      : process.env.TABLE_MODULES,

            // ── COMMERCE ──────────────────────────────
            COMMANDES    : process.env.TABLE_COMMANDES,
            PRODUITS     : process.env.TABLE_PRODUITS,
            STOCK        : process.env.TABLE_STOCK,

            // ── FINANCE ───────────────────────────────
            PAIEMENTS    : process.env.TABLE_PAIEMENTS,
            FACTURES     : process.env.TABLE_FACTURES,

            // ── FOURNISSEURS ──────────────────────────
            FOURNISSEURS : process.env.TABLE_FOURNISSEURS,

            // ── COMMUNICATION ─────────────────────────
            DOCUMENTS     : process.env.TABLE_DOCUMENTS,
            CONVERSATIONS : process.env.TABLE_CONVERSATIONS,

            // ── LIVRAISON ─────────────────────────────
            LIVRAISONS   : process.env.TABLE_LIVRAISONS,
            RESERVATIONS : process.env.TABLE_RESERVATIONS,
            MENUS        : process.env.TABLE_MENUS,
            CUISINE      : process.env.TABLE_CUISINE,

            // ── RÉFÉRENTIEL ───────────────────────────
            PAYS         : process.env.TABLE_PAYS,
            METIERS      : process.env.TABLE_METIERS,

            // ── SYSTÈME ───────────────────────────────
            AUTOMATISATIONS : process.env.TABLE_AUTOMATISATIONS,
            CONNEXIONS      : process.env.TABLE_CONNEXIONS,
            NOTIFICATIONS   : process.env.TABLE_NOTIFICATIONS,
            JOURNAL         : process.env.TABLE_JOURNAL,
            LOGS            : process.env.TABLE_LOGS,
        }
    },

    // ==================================================
    // SHOPIFY
    // ==================================================

    SHOPIFY: {
        API_KEY    : process.env.SHOPIFY_API_KEY,
        API_SECRET : process.env.SHOPIFY_API_SECRET,
        DOMAIN     : process.env.SHOPIFY_SHOP_DOMAIN,
        TOKEN      : process.env.SHOPIFY_ACCESS_TOKEN,
    },
// ==================================================
    // CLOUDFLARE (Gestion des sous-domaines clients)
    // ==================================================

    CLOUDFLARE: {
        ZONE_ID   : process.env.CLOUDFLARE_ZONE_ID,
        API_TOKEN : process.env.CLOUDFLARE_API_TOKEN,
    },
    RUNWARE: {
    API_KEY: process.env.RUNWARE_API_KEY || "",
},
    // ==================================================
    // TELEGRAM
    // ==================================================

    TELEGRAM: {
        BOT_TOKEN : process.env.TELEGRAM_BOT_TOKEN,
        CHAT_ID   : process.env.TELEGRAM_CHAT_ID,
    },

    // ==================================================
    // WHATSAPP
    // ==================================================

    WHATSAPP: {
        INSTANCE : process.env.Instance,
        API_KEY  : process.env.GREENDAPIWATSAP,
        NUMBER   : process.env.WATSAP_NUMBER,
    },

    // ==================================================
    // META (Facebook / Instagram / Ads)
    // ==================================================

    META: {
        APP_ID       : process.env.META_APP_ID,
        APP_SECRET   : process.env.META_APP_SECRET,
        REDIRECT_URI : process.env.META_REDIRECT_URI,
    },

    // ==================================================
    // YALIDINE
    // ==================================================

    YALIDINE: {
        API_KEY  : process.env.YALIDINE_API_KEY,
        API_ID   : process.env.YALIDINE_API_ID,
    },

    // ==================================================
    // GEMINI (IA — SAMII)
    // ==================================================

    GEMINI: {
        API_KEY: process.env.GEMINI_API_KEY,
    },

    // ==================================================
    // RESEND (Email transactionnel)
    // ==================================================

    RESEND: {
        API_KEY: process.env.RESEND_API_KEY || "",
    },

    // ==================================================
    // ELEVENLABS (Voix IA — désactivé tant que pas de clé)
    // ==================================================

    ELEVENLABS: {
        API_KEY  : process.env.ELEVENLABS_API_KEY  || "",
        VOICE_ID : process.env.ELEVENLABS_VOICE_ID || "",
    },

    // ==================================================
    // VAPID (Notifications push PWA — désactivé tant que pas de clés)
    // ==================================================

    VAPID: {
        PUBLIC_KEY  : process.env.VAPID_PUBLIC_KEY  || "",
        PRIVATE_KEY : process.env.VAPID_PRIVATE_KEY || "",
        SUBJECT     : process.env.VAPID_SUBJECT     || "https://samii.souverain-store.com",
    },

};
