// ======================================================
// SAMII OS - CONFIGURATION CENTRALE
// ======================================================

// Extrait en constante (pas juste une propriété de l'objet exporté) pour
// pouvoir dériver d'autres valeurs (ex: META.REDIRECT_URI) à partir d'elle
// sans jamais risquer qu'elles se désynchronisent — une seule source de
// vérité pour le domaine réel de l'app.
const APP_URL = process.env.APP_URL || "https://samii.souverain-store.com";

module.exports = {

    PORT: process.env.PORT || 10000,

    APP_URL,

    // Compte système "SAMII IA" dans utilisateurs (type_compte='ia', jamais
    // capable de se connecter) — auteur des messages postés par SAMII dans
    // le tchat général de la plateforme (routes/discussions.js,
    // engines/communityEngine.js). Toujours identifié comme IA côté rendu,
    // jamais présenté comme un membre humain.
    SAMII_IA_USER_ID: process.env.SAMII_IA_USER_ID || "5d67f6d5-b3c1-4784-a29f-eee856f29f43",

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
        ZONE_ID    : process.env.CLOUDFLARE_ZONE_ID,
        API_TOKEN  : process.env.CLOUDFLARE_API_TOKEN,
        // Origine réelle de l'app (host Render), utilisée comme cible des sous-domaines
        // clients. Ne JAMAIS mettre une valeur qui est elle-même un enregistrement
        // Cloudflare proxied (ex: samii.souverain-store.com) → Erreur 1000.
        ORIGIN_HOST: process.env.CLOUDFLARE_ORIGIN_HOST || "sami-max-app-1.onrender.com",
    },
    RUNWARE: {
    API_KEY: process.env.RUNWARE_API_KEY || "",
},
    // Banque de photos libres de droit (usage commercial autorisé). Sert de
    // moteur GRATUIT à Griot, à côté des moteurs IA payants : un marchand
    // sans budget peut publier avec une vraie photo professionnelle plutôt
    // que de rester bloqué sur "crédits insuffisants".
    // Contrainte imposée par leurs conditions d'API : afficher le nom du
    // photographe (lien vers la photo) ET un lien visible vers Pexels
    // partout où ces photos apparaissent — voir routes/griot.js.
    PEXELS: {
        API_KEY: process.env.PEXELS_API_KEY || "",
    },
    OPENROUTER: {
        // Nom réel de la variable sur Render : OPENROUTE_API_TOKEN (vérifié
        // sur le dashboard) — fallback sur l'ancien nom au cas où il serait
        // corrigé plus tard côté Render.
        API_KEY: process.env.OPENROUTE_API_TOKEN || process.env.OPENROUTER_API_KEY || "",
    },
    GROQ: {
        // Relais de secours gratuit (2ᵉ position, avant OpenRouter) — clé
        // créée gratuitement sur console.groq.com, sans carte bancaire.
        API_KEY: process.env.GROQ_API_KEY || "",
    },
    DEEPSEEK: {
        // Dernier relais (4ᵉ position) : payant mais très économique
        // (~20-30x moins cher que les modèles occidentaux équivalents) —
        // absorbe le trafic qui dépasse les quotas gratuits de Gemini/Groq/
        // OpenRouter sans faire exploser les coûts. Clé sur platform.deepseek.com.
        API_KEY: process.env.DEEPSEEK_API_KEY || "",
    },
    // ==================================================
    // TELEGRAM
    // ==================================================

    TELEGRAM: {
        BOT_TOKEN : process.env.TELEGRAM_BOT_TOKEN,
        CHAT_ID   : process.env.TELEGRAM_CHAT_ID,
        // Canal public de pub/acquisition SAMII (le bot partagé doit être
        // admin de ce canal avec le droit de publier). Réglable sans
        // redéploiement de code si le canal change de nom.
        CHANNEL_USERNAME: process.env.TELEGRAM_CHANNEL_USERNAME || "@SAMII213",
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
        // Toujours dérivée du vrai domaine de l'app (APP_URL) — jamais de
        // variable d'env séparée qui pourrait rester bloquée sur l'ancienne
        // adresse Render brute pendant que APP_URL a changé (c'est
        // exactement ce qui vient de bloquer toute reconnexion Meta).
        REDIRECT_URI : `${APP_URL}/auth/meta/callback`,
        // Workspace où la Page Facebook / le compte Instagram officiels
        // d'OG Technology sont connectés (via /connect/meta comme n'importe
        // quel marchand) — utilisé par engines/pageEngine.js pour la
        // publication automatique. Réglable sans redéploiement de code.
        OG_WORKSPACE_ID: process.env.META_OG_WORKSPACE_ID || "test-workspace-1",
        // Email de contact public affiché sur les posts Facebook/Instagram
        // officiels (celui déjà déclaré comme "Adresse e-mail de contact"
        // sur le tableau de bord développeur Meta) — à remplacer par une
        // adresse pro dédiée dès qu'elle existe.
        CONTACT_EMAIL: process.env.OG_CONTACT_EMAIL || "oghembaza10@gmail.com",

        // ── WhatsApp Cloud API officielle (numéro OG Technology) ──────────
        // Distincte de CONFIG.WHATSAPP (Green API, utilisée par tous les
        // marchands) : celle-ci ne sert que le canal officiel SAMII, avec un
        // token d'utilisateur système permanent (Business Settings →
        // Utilisateur(ice)s système → Générer un token).
        WHATSAPP_CLOUD: {
            TOKEN          : process.env.META_WHATSAPP_TOKEN,
            PHONE_NUMBER_ID: process.env.META_WHATSAPP_PHONE_NUMBER_ID || "1304094159450033",
        },
    },

    // ==================================================
    // GOOGLE (Custom Search — TikTok/Meta/LinkedIn ciblés, + YouTube)
    // ==================================================

    GOOGLE: {
        API_KEY: process.env.GOOGLE_API_KEY,
        // Identifiant du moteur de recherche personnalisé (cx) — pas secret,
        // mais réglable sans redéploiement si le fondateur en recrée un.
        SEARCH_CX: process.env.GOOGLE_SEARCH_CX || "f70583c741f994ca5",

        // ── OAuth (Gmail, Calendar, Drive, YouTube — outils marchand) ─────
        // Distinct de API_KEY ci-dessus (clé serveur pour Custom Search) :
        // ceci ouvre l'accès aux données PERSONNELLES d'un marchand
        // (sa boîte mail, son agenda, son Drive, sa chaîne YouTube), donc
        // passe par un vrai écran de consentement Google, un par marchand.
        OAUTH: {
            CLIENT_ID    : process.env.GOOGLE_OAUTH_CLIENT_ID,
            CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
            REDIRECT_URI : `${APP_URL}/auth/google/callback`,
        },
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
        //
        // LE NOM NE DOIT PLUS ÊTRE UN PIÈGE.
        //
        // Une clé posée sur Render sous un nom que ce fichier ne lisait pas
        // n'existait pas — sans erreur, sans ligne de journal, sans rien. On
        // croyait avoir doublé le quota, et SAMII tombait quand même. C'est
        // le genre de panne qui coûte des heures parce qu'il n'y a rien à
        // regarder : tout va bien, sauf que la clé n'est nulle part.
        //
        // On arrête donc de deviner le nom : on RAMASSE toute variable dont
        // le nom parle d'une clé Gemini. GEMINI_API_KEY_7, SAMII-API-Key,
        // SAMII_API_KEY, GOOGLE_GEMINI_KEY — toutes entrent. Le tiret est
        // accepté au passage : les noms de variables d'environnement n'en
        // portent normalement pas, mais Render en accepte, et une clé
        // valide refusée pour un tiret serait une panne pour rien.
        // ── GRATUIT D'ABORD, PAYANT EN DERNIER ──────────────────────────
        //
        // « SAMII-API-Key, voici le nom de la clé PAYANTE. » « Après que le
        // gratuit tombe en panne, on passe dessus. »
        //
        // Une clé payante n'a pas de plafond : elle répondra TOUJOURS oui.
        // C'est précisément ce qui la rend dangereuse à mal placer — mise
        // devant, ou même simplement retenue comme point de départ après un
        // basculement, elle absorbe tout le trafic et la facture court sans
        // que rien ne le signale. Le gratuit, lui, dit non bruyamment.
        //
        // Elle est donc marquée, rangée en dernier, et le service a
        // l'interdiction de s'y installer (voir `depart` dans geminiService).
        ...(() => {
            const nomme = (n) => /^(GEMINI|SAMII|GOOGLE)[-_]?.*(API)?[-_]?KEY/i.test(n)
                && !/SECRET|WEBHOOK|CLIENT|OAUTH/i.test(n);
            // Une vraie clé Google fait ~39 caractères et commence par AIza.
            // Ce contrôle évite de tirer sur une variable qui porte un nom
            // approchant mais contient un identifiant, une URL ou un « true ».
            const ressemble = (v) => typeof v === "string" && v.trim().length >= 20;

            // Les noms attendus d'abord, DANS L'ORDRE : la principale reste
            // la première essayée, donc le gratuit s'épuise avant qu'on passe
            // sur la suivante — c'est la règle voulue.
            const attendus = [
                "GEMINI_API_KEY",
                ...Array.from({ length: 19 }, (_, i) => `GEMINI_API_KEY_${i + 2}`),
            ];
            const vues = new Set();
            const gratuites = [];
            const payantes = [];
            const ajouter = (v, liste) => {
                const c = String(v || "").trim();
                if (!c || vues.has(c)) return;   // deux noms, une seule clé : on ne l'essaie pas deux fois
                vues.add(c);
                liste.push(c);
            };

            for (const nom of attendus) if (ressemble(process.env[nom])) ajouter(process.env[nom], gratuites);
            // Puis tout le reste, en fin de liste : une clé rangée sous un nom
            // inattendu est un dernier recours, elle ne passe jamais devant.
            for (const nom of Object.keys(process.env)) {
                if (attendus.includes(nom)) continue;
                if (nomme(nom) && ressemble(process.env[nom])) ajouter(process.env[nom], payantes);
            }
            return {
                API_KEYS: [...gratuites, ...payantes],
                // Ce que le service ne doit PAS retenir comme point de départ.
                PAYANTES: payantes,
            };
        })(),
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
    // TAUX DE CHANGE (affichage multi-devises — abonnements + marketplace)
    // ==================================================
    // Vérifiés le 12/08/2026. Pour le dinar algérien : taux du MARCHÉ
    // PARALLÈLE (marché noir), pas le taux officiel — voir CHARGILY ci-dessus.
    // Pour le dirham marocain et le dinar tunisien : aucun écart marché noir
    // significatif n'est documenté (change bien plus libéralisé qu'en
    // Algérie — le Maroc poursuit d'ailleurs la libéralisation du dirham en
    // 2026), donc taux de marché réel. À réévaluer périodiquement via les
    // variables d'env — ces taux bougent en continu.
    DEVISES: {
        EUR_TO_USD: Number(process.env.TAUX_EUR_USD || 1.1524),
        USD_TO_DZD: Number(process.env.TAUX_USD_DZD || 239),   // marché parallèle
        USD_TO_MAD: Number(process.env.TAUX_USD_MAD || 9.30),  // marché réel
        USD_TO_TND: Number(process.env.TAUX_USD_TND || 2.93),  // marché réel
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
