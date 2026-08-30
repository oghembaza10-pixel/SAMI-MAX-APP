// ======================================================
// SAMII OS V1 — Point d'entrée
// ======================================================
// Doit être la toute première ligne exécutée, avant tout require() : le
// serveur (Render) tourne en UTC par défaut, alors que la clientèle et les
// horaires d'ouverture (RDV, missions du jour...) sont en heure d'Algérie.
// Fixer le fuseau ici rend correct tout new Date()/getHours()/getDay() du
// reste du code sans avoir à convertir manuellement partout.
process.env.TZ = "Africa/Algiers";

const path             = require("path");
const express          = require("express");
const session          = require("express-session");
const pgSession         = require("connect-pg-simple")(session);
const { Pool }          = require("pg");
const http             = require("http");
const { Server }       = require("socket.io");
const helmet           = require("helmet");
const compression      = require("compression");
const rateLimit        = require("express-rate-limit");
const CONFIG           = require("./config");
const workspaceService = require("./services/workspaceService");
const db                = require("./services/db");
const paliers           = require("./config/paliers");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
const socketService = require("./services/socketService");
socketService.init(io);

// ── MIDDLEWARES ───────────────────────────────────────
app.set("trust proxy", 1);

// CSP désactivée : l'app s'appuie massivement sur du <script> inline dans
// les vues EJS (griot, marketplace, academy, community...). L'activer sans
// audit préalable casserait ces pages. Les autres protections Helmet
// (X-Frame-Options, HSTS, nosniff, referrer-policy...) restent actives.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

app.use("/billing/webhook", express.raw({ type: "application/json" }));
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
// Un gabarit EJS n'a pas de `require` : ce dont les vues ont besoin doit
// leur être posé ici. La colonne de gauche du QG se construit à partir de
// cette liste, filtrée par la communauté du membre.
app.locals.modulesQg = require("./config/modules-qg");
app.set("views", path.join(__dirname, "views"));

// ── RATE LIMITING ──────────────────────────────────────
// Anti brute-force sur les routes d'authentification.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de tentatives. Réessaie dans quelques minutes." },
});

// Anti-abus sur l'API publique (le front n'y fait pas de polling, tout
// passe par Socket.io — cette marge reste large pour un usage normal).
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
});

// Anti-flood sur les webhooks entrants — la signature (Stripe, Chargily)
// est déjà vérifiée en aval, ceci protège juste contre un flood volumétrique.
const webhookLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
});

// Appliqué tôt : certains routeurs webhook (ex. woocommerce) sont montés
// à la racine avant la section "Webhooks entrants" plus bas.
app.use(["/webhook", "/billing/webhook"], webhookLimiter);

// ── HEALTHCHECK ─────────────────────────────────────────
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// ── SESSION (Supabase/Postgres — persiste aux redéploiements) ──
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

app.use(session({
    store: new pgSession({
        pool                : pgPool,
        tableName           : "session",
        createTableIfMissing: true,
    }),
    secret           : process.env.SESSION_SECRET || "samii-secret-v1",
    resave           : false,
    saveUninitialized: false,
    cookie           : {
        httpOnly : true,
        sameSite : "lax",
        secure   : process.env.NODE_ENV === "production",
        maxAge   : 7 * 24 * 60 * 60 * 1000,
    },
}));

// ── LANGUE (fr/en sur les pages de l'Académie) ────────
// Posé APRÈS la session : le choix de langue s'y mémorise, pour qu'un
// partenaire qui met ?lang=en une fois ne le remette pas à chaque clic.
// Toutes les vues reçoivent L() — celles qui ne sont pas traduites
// continuent de fonctionner sans changement.
app.use(require("./services/langue").middleware);
// GET /langue/:code — la barre de langue y dépose le choix du visiteur pour
// que les pages rendues par le serveur (Académie, pages légales) reviennent
// dans la même langue que celles traduites par le navigateur.
app.use(require("./services/langue").routeur());

// ── RETOUR (« ← Retour au QG », « ← Retour à la Tour de contrôle ») ──
// Posé APRÈS la langue : le libellé du bouton passe par L(). Chaque vue
// reçoit retourUrl / retourLibelle, qui pointent vers la base du compte
// connecté — l'agence rentre à l'agence, le marchand à son QG.
app.use(require("./services/navigation").middleware);

// ── LA COMMUNAUTÉ D'ORIGINE ──────────────────────────────────────────
// Un visiteur arrive de /c/coindudigital, clique « Créer mon compte » et
// se retrouve sur nos pages. Sans cette mémoire, il finirait dans NOTRE
// QG après inscription — une marque qu'il n'a jamais demandée, et plus
// aucun chemin de retour vers chez elle. On retient d'où il vient.
app.use((req, res, next) => {
    const demandee = req.query?.c;
    if (demandee && require("./config/communautes").existe(demandee) && req.session) {
        req.session.communaute = String(demandee).toLowerCase().replace(/[^a-z0-9-]/g, "");
    }
    next();
});

// ── LA RACINE D'UN SERVICE PARTENAIRE ────────────────────────────────────
//
// « coindudigital.souverain-store.com amène sur SAMII OG. »
//
// C'était exact, et ce n'était pas le DNS. Sa communauté vit à
// /c/coindudigital ; la racine, elle, cherchait un marchand ayant ce
// sous-domaine, n'en trouvait aucun, et retombait sur NOTRE page d'accueil.
// Son domaine à elle ouvrait donc sur notre site — le pire endroit possible
// pour perdre quelqu'un, puisque c'est le premier écran.
//
// Un service Render = une communauté. Il le déclare dans son environnement,
// et sa racine mène chez elle. La maison n'a pas la variable, donc rien ne
// change pour elle.
//
// On redirige plutôt que d'afficher sur place : tous les liens de la page
// sont construits en /c/<slug>/…, et une page servie à la racine avec des
// liens qui pointent ailleurs finit par se contredire.
const COMMUNAUTE_HOTE = (() => {
    const communautes = require("./config/communautes");
    const demandee = process.env.COMMUNAUTE_PAR_DEFAUT;
    if (!demandee || !communautes.existe(demandee)) return null;
    const slug = communautes.nettoyer(demandee);
    return slug === communautes.DEFAUT ? null : slug;
})();
if (COMMUNAUTE_HOTE) {
    console.log(`🏠 Ce service ouvre sur la communauté « ${COMMUNAUTE_HOTE} ».`);
}

// ── LOCALS (disponibles dans toutes les vues EJS) ─────
app.use((req, res, next) => {
    res.locals.workspaceId = req.session?.workspaceId || null;
    res.locals.shop        = req.session?.shop || null;
    res.locals.loggedIn    = !!req.session?.loggedIn;
    res.locals.userId      = req.session?.userId || null;

    // ── LA MARQUE DU SERVICE, POUR TOUTES LES VUES ───────────────────
    //
    // « C'est un mélange de ouf. » Exact : la communauté, la vitrine, le QG
    // marchand et les pages d'inscription portaient sa marque, pendant que
    // l'espace client, le hub et la page d'accueil affichaient encore
    // « OG · TECHNOLOGY » — sur son domaine.
    //
    // La cause n'était pas une vue oubliée, c'était l'absence d'endroit où
    // poser la réponse. Chaque gabarit écrivait la marque en dur, donc
    // chacun devait être corrigé séparément, donc il en restait toujours un.
    //
    // Ici, la marque est décidée UNE fois, par le service, et disponible
    // partout. Une vue qui ne l'utilise pas encore reste à convertir — mais
    // elle n'a plus à aller chercher l'information.
    //
    // Aucune requête en base : la communauté d'un service est fixe, elle est
    // dans son environnement. Le faire par compte coûterait une lecture à
    // chaque page, pour une réponse qui ne change jamais.
    res.locals.COM = COMMUNAUTE_HOTE
        ? require("./config/communautes").get(COMMUNAUTE_HOTE)
        : require("./config/communautes").get(require("./config/communautes").DEFAUT);
    next();
});
// ── AUTH MIDDLEWARE ────────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function clearWorkspaceSession(req, callback) {
    delete req.session.workspaceId;
    delete req.session.lastWorkspace;
    req.session.save(callback);
}

// ══════════════════════════════════════════════════════
// BOOTSTRAP MOTEURS
// ══════════════════════════════════════════════════════
// Le schéma se met en place tout seul, à chaque démarrage. Une fonctionnalité
// livrée ne doit plus jamais rester morte parce qu'un script de création de
// tables n'a pas été lancé à la main sur le serveur (voir services/schema.js).
// Volontairement non bloquant : une base momentanément injoignable ne doit pas
// empêcher le site de répondre.
require("./services/schema").preparer()
    .catch(err => console.error("❌ Préparation du schéma :", err.message));

const { registerChannels, registerScheduledJobs, registerTrackingProviders } = require("./kernel/bootstrap");
registerChannels();
registerTrackingProviders();
registerScheduledJobs();

// ══════════════════════════════════════════════════════
// ROUTES — OAuth externes (Meta, Shopify)
// ══════════════════════════════════════════════════════
app.use(require("./routes/auth-meta"));
app.use(require("./routes/auth-google"));
app.use(require("./routes/auth-shopify"));
app.use(require("./routes/auth-woocommerce"));
app.use(require("./routes/webhook-woocommerce").router);

// ══════════════════════════════════════════════════════
// ROUTES — Webhooks entrants
// ══════════════════════════════════════════════════════
app.use("/webhook", require("./routes/webhook-compliance"));
app.use("/webhook", require("./routes/webhook"));
app.use("/webhook/whatsapp", require("./routes/webhook-whatsapp"));
app.use("/", require("./routes/legal"));
app.use("/", require("./routes/developers-en"));
app.use("/webhook/meta", require("./routes/webhook-meta-deletion"));
app.use("/webhook/chargily", require("./routes/webhook-chargily"));
// Paiement mobile africain (SebPay — 17 pays, Orange Money et MTN).
// En mode OBSERVATION : la route note tout ce qu'on lui envoie et ne valide
// aucun paiement. Elle sert à découvrir le format réel du prestataire avant
// d'écrire le traitement — voir l'en-tête de routes/webhook-paiement.js.
app.use("/webhook/paiement-afrique", require("./routes/webhook-paiement"));
// Stripe confirme un paiement du grand livre. Sans cette route, une
// vente était encaissée chez Stripe et restait « en attente » chez nous
// pour toujours : rien livré, aucune commission enregistrée, et la
// partenaire ne voyait aucune vente.
app.use("/webhook/stripe-paiement", require("./routes/webhook-stripe-paiement"));
app.use("/telegram", require("./routes/telegram"));

// ══════════════════════════════════════════════════════
// ROUTES — Authentification / compte
// ══════════════════════════════════════════════════════
app.use("/billing", require("./routes/billing"));
app.use("/cartes", require("./routes/cartes"));
app.use(["/login", "/register", "/password-reset"], authLimiter);
app.use("/login",    require("./routes/login"));
app.use("/register", require("./routes/register"));
app.use("/password-reset", require("./routes/password-reset"));

// ══════════════════════════════════════════════════════
// ROUTES — Plateforme (protégées par requireAuth)
// ══════════════════════════════════════════════════════
app.use("/hub",       require("./routes/hub"));
app.use("/workspace", require("./routes/workspace"));
app.use("/client-qg", require("./routes/client-qg"));
app.use("/dashboard", requireAuth, require("./routes/dashboard"));
app.use("/tools",     requireAuth, require("./routes/tools"));
app.use("/profile",   requireAuth, require("./routes/profile"));
app.use("/settings",  requireAuth, require("./routes/settings"));
app.use("/parrainage", requireAuth, require("./routes/parrainage"));
app.use("/agence", require("./routes/agence"));
app.use("/partenariat", require("./routes/partenariat"));
app.use("/admin", require("./routes/admin"));
app.use("/ads",       requireAuth, require("./routes/ads"));
app.use("/coffre",    requireAuth, require("./routes/coffre"));
app.use("/arsenal",   requireAuth, require("./routes/arsenal"));
app.use("/guerre", require("./routes/guerre"));
app.use("/samii/opportunites", require("./routes/opportunites"));
app.use("/samii/griot", require("./routes/griot"));
app.use("/samii/top-produits", require("./routes/topproduits"));
app.use("/samii/tendances", require("./routes/tendances"));
app.use("/samii/diplomate", require("./routes/diplomate"));
app.use("/samii/oeil-concurrentiel", require("./routes/oeilconcurrentiel"));
app.use("/samii/chasseur-stock", require("./routes/chasseurstock"));
app.use("/samii/radar-prospects", require("./routes/radarprospects"));
app.use("/samii/memoire-client", require("./routes/memoireclient"));
app.use("/automatisations", requireAuth, require("./routes/automatisations"));
app.use("/missions", requireAuth, require("./routes/missions"));
app.use("/samii/miroir", requireAuth, require("./routes/miroir"));
app.use("/samii/messager-eclair", requireAuth, require("./routes/messagereclair"));
app.use("/samii/oracle-financier", requireAuth, require("./routes/oraclefinancier"));
app.use("/samii",     requireAuth, require("./routes/samii-mode"));
app.use("/connect",   require("./routes/connector"));
app.use("/youtube",   require("./routes/youtube"));
app.use("/autopost",  require("./routes/autopost"));
app.use("/livreur",    require("./routes/livreur"));
app.use("/livraisons", require("./routes/livraisons"));
app.use("/verification", require("./routes/verification"));

// ══════════════════════════════════════════════════════
// ROUTES — Vitrine (public)
// ══════════════════════════════════════════════════════
// La porte de l'Académie passe AVANT le reste : /academy/rejoindre doit
// répondre même à quelqu'un qui n'a encore rien accepté, et les deux routeurs
// se partagent le même préfixe.
app.use("/academy",     require("./routes/academie-porte").router);
app.use("/academy",     require("./routes/academy"));
app.use("/community",   require("./routes/community"));
// Le lien court des communautés partenaires : /c/coindudigital.
// Une créatrice le colle dans une story ou en commentaire — il doit tenir
// en un coup d'œil et survivre à un copier-coller sur téléphone. C'est le
// même module que /community, seule la marque affichée change.
// S'inscrire et se connecter SOUS SA MARQUE. Monté avant le routeur de
// communauté : sans ça, un visiteur qui crée son compte depuis chez elle
// traverse une page SAMII au milieu du parcours — juste au moment où il
// donne son email, c'est-à-dire au moment où on abandonne.
app.use("/c",           require("./routes/auth-communaute"));
app.use("/c",           require("./routes/community"));
app.use("/discussions", require("./routes/discussions"));
app.use("/stories",     require("./routes/stories"));
app.use("/marketplace", require("./routes/marketplace"));
app.use("/drivers",     require("./routes/drivers"));
// API publique partenaires (n8n, Make, ERP...) : authentifiée par clé, pas
// par session. Montée AVANT /api pour ne pas passer par apiLimiter (limité
// par IP), qui pénaliserait tous les partenaires sortant d'une même IP —
// api-v1 applique sa propre limite, par clé.
app.use("/api/v1", require("./routes/api-v1"));
app.use("/developpeurs", require("./routes/developpeurs"));
app.use("/apps", require("./routes/apps"));
app.use("/api", apiLimiter, require("./routes/api"));
// Chat public de la page d'accueil — porte non authentifiée, sa propre
// limite (bien plus stricte) est définie dans le routeur lui-même.
app.use("/vitrine", require("./routes/vitrine"));
// Les moyens de paiement : la liste que voit un acheteur selon son pays, et
// l'état réel côté serveur (ce qui est branché, ce qui manque).
app.use("/paiement", require("./routes/paiement"));
// L'espace d'administration d'une communauté partenaire. Monté ici, comme
// tout le reste : il était branché par un `if` planqué dans le middleware de
// navigation, dont le rôle est de calculer un libellé de bouton « Retour ».
// Une route qui vit dans un fichier dont ce n'est pas le sujet est une route
// que personne ne retrouve. Le routeur fait lui-même son contrôle d'accès.
app.use("/", require("./routes/community-admin"));
app.get("/api-docs", (req, res) => res.sendFile(path.join(__dirname, "public", "api-docs.html")));

app.get("/inscription", requireAuth, (req, res) => {
    const metier = req.query.metier || "";
    res.redirect(`/workspace/create${metier ? `?metier=${metier}` : ""}`);
});

// ── SOUS-DOMAINE BOUTIQUE (maboutique.souverain-store.com) ──
// Un marchand qui a configuré une adresse dans Réglages → Ma boutique voit
// sa vitrine directement à la racine de son sous-domaine, à la Shopify —
// tout le reste (marketplace, paiement...) reste servi normalement, seul
// le "/" change selon le sous-domaine appelé.
const RESERVED_HOST_PREFIXES = ["www", "samii", "api"];

app.get("/", (req, res, next) => {
    if (!COMMUNAUTE_HOTE) return next();
    return res.redirect(302, `/c/${COMMUNAUTE_HOTE}`);
});

app.get("/", async (req, res, next) => {
    try {
        const host = (req.hostname || "").toLowerCase();
        if (host.endsWith(".souverain-store.com")) {
            const prefix = host.slice(0, -".souverain-store.com".length);
            if (prefix && !RESERVED_HOST_PREFIXES.includes(prefix)) {
                const rows = await db.query(`SELECT id FROM utilisateurs WHERE sous_domaine = $1`, [prefix]);
                if (rows[0]) {
                    // Attribution pub : toute la navigation qui suit (produit, achat)
                    // est rattachée à ce vendeur pour le déclenchement des pixels.
                    req.session.pixelVendeurId = rows[0].id;
                    const { renderVitrine } = require("./routes/vitrine");
                    return renderVitrine(rows[0].id, req, res);
                }
            }
        }
    } catch (err) {
        console.error("❌ Routage sous-domaine boutique :", err.message);
    }
    next();
});

// ── PAGE ACCUEIL ────────────────────────────────────────
app.get("/", (req, res) => {
    res.render("index", {
        loggedIn: !!req.session?.loggedIn,
        nom: req.session?.nom || "",
        typeCompte: req.session?.typeCompte || "client",
        // Les tarifs affichés sur la page d'accueil viennent du même fichier
        // que ceux facturés (config/paliers.js) : impossible d'annoncer un
        // prix en vitrine et d'en encaisser un autre sur /billing.
        tarifs: paliers.PALIERS,
    });
});

// ── QG — route universelle SOLDAT V1 ────────────────────
app.get("/qg", requireAuth, async (req, res) => {
    try {
        if (req.session?.typeCompte === "client") return res.redirect("/client-qg");

        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");

        const workspace = await workspaceService.getById(workspaceId);
        if (!workspace) {
            return clearWorkspaceSession(req, () => res.redirect("/hub"));
        }
        const estAgenceProprietaire = req.session.typeCompte === "agence"
            && workspace.agenceId
            && workspace.agenceId === req.session.userId;
        if (workspace.owner !== req.session.email && !estAgenceProprietaire) {
            return clearWorkspaceSession(req, () => res.redirect("/hub"));
        }

        const communautes = require("./config/communautes");
        let themeVisuel = "og";
        // La communauté du COMPTE, pas celle de la session : c'est elle qui
        // décide des modules et de la marque affichée dans la colonne de
        // gauche. Une session se vide, un compte non.
        let COM = communautes.get(communautes.DEFAUT);
        try {
            const rows = await db.query(
                `SELECT theme_visuel, communaute FROM utilisateurs WHERE id = $1`,
                [req.session.userId],
            );
            themeVisuel = rows[0]?.theme_visuel || "og";
            // LE DOMAINE DÉCIDE, PAS LE COMPTE.
            //
            // « Pour créer une boutique je tombe dans les QG de OG. » Vrai :
            // le QG lisait la communauté du COMPTE. Un compte de la maison
            // qui ouvre son QG depuis le domaine d'une partenaire y voyait
            // donc NOTRE catalogue complet — Marketplace, Arsenal, Coffre OG,
            // « OG · TECHNOLOGY » en haut à gauche — sur SON domaine à elle.
            //
            // Un service partenaire ne sert qu'une communauté : il porte donc
            // sa marque pour tout le monde. Qui veut son QG à nous va sur
            // notre domaine. Sans COMMUNAUTE_PAR_DEFAUT (la maison), on
            // revient au compte, et rien ne change.
            COM = communautes.pourLeQG(COMMUNAUTE_HOTE, rows[0]?.communaute);
        } catch (err) {
            // La colonne `communaute` peut ne pas encore exister au premier
            // démarrage qui suit un déploiement : on retombe sur la maison
            // plutôt que de refuser d'afficher le QG.
            console.error("❌ GET /qg (profil) :", err.message);
        }

        res.render("qg-template", {
            workspaceId : workspace.workspaceId,
            nom         : workspace.nom,
            metier      : workspace.metier      || "workspace",
            description : workspace.description || "",
            langue      : workspace.langue      || "fr",
            pays        : workspace.pays        || "DZ",
            devise      : workspace.devise      || "DZD",
            connecteurs : workspace.connecteurs || [],
            samii       : workspace.samii       || { mode: "auto" },
            logo        : workspace.logo        || "",
            shop        : req.session.shop      || "",
            themeVisuel,
            attente     : false,
            vueAgence   : estAgenceProprietaire,
            typeCompte  : req.session.typeCompte || "marchand",
            communaute  : COM,
        });
    } catch (err) {
        console.error("❌ GET /qg :", err);
        return clearWorkspaceSession(req, () => res.redirect("/hub"));
    }
});

app.get("/qg/:metier", requireAuth, (req, res) => {
    if (req.session?.workspaceId) return res.redirect("/qg");
    res.redirect("/hub");
});

app.get("/qg/:metier/connecter", requireAuth, (req, res) => {
    res.redirect("/qg");
});

// ── SAMII — copilote universel ──────────────────────────
app.get("/samii", requireAuth, async (req, res) => {
    // Les cartes de la grille (Miroir, Oracle Financier, Griot...) sont des
    // outils métier marchand — la plupart supposent un workspace et n'ont
    // aucun sens pour un particulier. Un particulier n'a que le chat.
    const communautes = require("./config/communautes");
    let estParticulier = false;
    // La même règle qu'au QG : le domaine décide. Sans cette ligne, la
    // colonne partagée retombe sur la maison — et sur le service d'une
    // partenaire, ça rend précisément le QG qu'on essaie de ne plus rendre.
    let COM = communautes.get(communautes.DEFAUT);
    try {
        const db = require("./services/db");
        const rows = await db.query(`SELECT type_compte, communaute FROM utilisateurs WHERE id = $1`, [req.session.userId]);
        estParticulier = rows[0]?.type_compte === "client";
        COM = communautes.pourLeQG(COMMUNAUTE_HOTE, rows[0]?.communaute);
    } catch (err) {
        // La colonne `communaute` peut manquer juste après un déploiement.
        // On garde au moins la marque du service plutôt que de rendre la
        // nôtre chez elle.
        console.error("❌ GET /samii (profil) :", err.message);
        COM = communautes.pourLeQG(COMMUNAUTE_HOTE, communautes.DEFAUT);
    }

    res.render("samii", {
        workspaceId : req.session.workspaceId || "",
        shop        : req.session.shop        || "",
        estParticulier,
        communaute  : COM,
        typeCompte  : req.session.typeCompte || "marchand",
    });
});

// ── LOGOUT ───────────────────────────────────────────────
app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

// ── SOCKET.IO ────────────────────────────────────────────
io.on("connection", (socket) => {
    console.log("🔌 Socket connecté :", socket.id);
    socket.on("join", (workspaceId) => {
        if (workspaceId && typeof workspaceId === "string") {
            socket.join(workspaceId);
            console.log(`👑 Socket workspace : ${workspaceId}`);
        }
    });
    socket.on("disconnect", () => {
        console.log("🔌 Socket déconnecté :", socket.id);
    });
});

// ── ENV CHECK ─────────────────────────────────────────────
// Airtable n'est plus une dépendance réelle de l'app (tout tourne sur
// Postgres) — plus vérifié ici, ça n'a jamais rien testé de toute façon.
if (!CONFIG.GEMINI.API_KEY)   console.error("❌ GEMINI_API_KEY manquante");
if (!process.env.DATABASE_URL) console.error("❌ DATABASE_URL manquante (sessions Supabase)");

// ── TEST TELEGRAM ─────────────────────────────────────────
app.get("/test-telegram", async (req, res) => {
    const telegram = require("./services/telegramService");
    const result   = await telegram.send("8276462482", "👑 SAMII OS — Test direct !");
    res.json(result);
});

// ── SERVEUR ────────────────────────────────────────────────
server.listen(CONFIG.PORT, () => {
    console.log("🚀 SAMII OS démarre...");
    console.log(`🚀 SAMII OS lancé sur ${CONFIG.PORT}`);
});
