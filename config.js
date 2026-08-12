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
        // Rotation de clés : le plan gratuit Gemini plafonne à 20 req/min par clé.
        // GEMINI_API_KEY_2, _3, _4... (jusqu'à 20) sont des clés de secours facultatives —
        // dès qu'une clé tombe en quota (429), SAMII bascule automatiquement sur la suivante.
        API_KEYS: [
            process.env.GEMINI_API_KEY,
            ...Array.from({ length: 19 }, (_, i) => process.env[`GEMINI_API_KEY_${i + 2}`]),
        ].filter(Boolean),
    },

    // ==================================================
    // RESEND (Email transactionnel)
    // ==================================================

    RESEND: {
        API_KEY: process.env.RESEND_API_KEY || "",
    },

    // ==================================================
    // CHARGILY PAY (paiement en ligne — Edahabia / CIB)
    // ==================================================

    CHARGILY: {
        API_KEY: process.env.CHARGILY_API_KEY || "",
        // Non utilisée par le code aujourd'hui (tout passe par la clé secrète
        // ci-dessus, côté serveur) — gardée pour un futur widget côté client.
        PUBLIC_KEY: process.env.CHARGILY_PUBLIC_KEY || "",
        MODE: process.env.CHARGILY_MODE || "test",
        // Chargily n'accepte que le DZD. Les produits marketplace (import CJ)
        // et les cartes SAMII sont affichés en EUR — on convertit au moment
        // du paiement avec ce taux.
        // IMPORTANT : c'est le taux du MARCHÉ PARALLÈLE (marché noir), pas le
        // taux officiel de la Banque d'Algérie (~153 DZD/€) — l'écart entre
        // les deux dépasse 120 DZD/€. Le taux officiel ne reflète pas le
        // pouvoir d'achat réel du dinar ; utiliser ce taux sous-évaluerait
        // massivement (environ de moitié) tout ce qui est vendu en DZD.
        // Le marché parallèle bouge en continu (~273-277 DZD/€ mi-août 2026,
        // cf. forexalgerie.com / devisesalgerie.com) — cette valeur par
        // défaut doit être mise à jour régulièrement via la variable d'env.
        EUR_TO_DZD_RATE: Number(process.env.CHARGILY_EUR_TO_DZD_RATE || 275),
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
