// ======================================================
// SAMII OS V1 — Point d'entrée
// ======================================================
// Doit être la toute première ligne exécutée, avant tout require() : le
// serveur (Render) tourne en UTC par défaut, alors que la clientèle et les
// horaires d'ouverture (RDV, missions du jour...) sont en heure d'Algérie.
// Fixer le fuseau ici rend correct tout new Date()/getHours()/getDay() du
// reste du code sans avoir à convertir manuellement partout.
process.env.TZ = "Africa/Algiers";

// ══════════════════════════════════════════════════════════════════════════
// SENTRY — SAVOIR QU'UNE ERREUR EST ARRIVÉE
//
// ── LE PROBLÈME ───────────────────────────────────────────────────────────
//
// Quand SAMII casse chez une marchande, la seule trace est une ligne dans
// les journaux de Render. Ils défilent, ils s'effacent, et personne ne les
// regarde à 22 h un samedi. On l'apprend donc par un message : « ça marche
// pas ». Sans page, sans heure, sans pile d'appel. La table `journal` posée
// plus bas garde le message de l'erreur, mais pas OÙ elle s'est produite ni
// DANS QUEL ORDRE le code y est arrivé.
//
// ── POURQUOI ICI, TOUT EN HAUT ────────────────────────────────────────────
//
// Sentry pose ses crochets sur les modules Node (http, pg, express) au
// moment où il démarre. Un module déjà chargé n'est plus instrumenté. Cet
// appel doit donc précéder TOUS les require() de l'application — y compris
// `express`. C'est la même règle que `process.env.TZ` juste au-dessus.
//
// ── AUCUNE CLÉ DANS CE DÉPÔT ──────────────────────────────────────────────
//
// Le DSN se pose sur Render, dans les variables d'environnement, et nulle
// part ailleurs. Sans lui, ce bloc ne fait STRICTEMENT rien : pas de
// module chargé, pas de requête sortante, pas de ralentissement. SAMII
// tourne exactement comme avant.
//
// ── CE QU'ON NE LUI ENVOIE PAS ────────────────────────────────────────────
//
// `sendDefaultPii: false` : ni adresses IP, ni en-têtes, ni corps de
// requête. Une erreur sur une commande ne doit pas expédier le téléphone et
// l'adresse d'une cliente de Douala vers un service américain. On veut
// savoir OÙ ça casse, pas QUI était en train d'acheter.
//
// ── LA LIMITE, DITE FRANCHEMENT ───────────────────────────────────────────
//
// L'offre gratuite s'arrête à 5 000 erreurs par mois, et au-delà les
// suivantes sont jetées EN SILENCE. Elle n'accepte qu'un seul utilisateur :
// ce sera toi, pas Inès.
(function brancherSentry() {
    const dsn = (process.env.SENTRY_DSN || "").trim();
    if (!dsn) return;   // pas de DSN = ce bloc n'existe pas
    try {
        require("@sentry/node").init({
            dsn,
            // Le nom du service, pour distinguer les deux déploiements qui
            // partagent ce dépôt : chez nous et chez la partenaire. Sans
            // ça, les erreurs des deux arrivent mélangées.
            environment: process.env.COMMUNAUTE_PAR_DEFAUT || "maison",
            sendDefaultPii: false,
            // Aucune mesure de performance : on veut les pannes, pas un
            // suivi de vitesse — et chaque transaction envoyée consomme le
            // quota gratuit.
            tracesSampleRate: 0,
        });
        console.log("🛰️  Sentry branché —", process.env.COMMUNAUTE_PAR_DEFAUT || "maison");
    } catch (err) {
        // Un outil de surveillance qui empêche le serveur de démarrer est
        // une panne qu'on s'est infligée pour éviter les pannes.
        console.error("⚠️ Sentry n'a pas pu démarrer, on continue sans :", err.message);
    }
})();

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

// ══════════════════════════════════════════════════════════════════════════
// EXPRESS 4 NE SAIT PAS ATTRAPER UNE PROMESSE REJETÉE
//
// CE QU'ON A VU EN FAISANT TOURNER L'APPLICATION. Une requête vers
// /autopost a fait S'ARRÊTER NODE — pas la page, le processus entier.
//
// La cause est une construction qu'on écrit partout sans y penser :
//
//     router.get("/", requireAuth, async (req, res) => { ... })
//
// Express 4 appelle ce gestionnaire et ignore la promesse qu'il renvoie. Si
// elle est rejetée — une colonne absente, une base momentanément
// injoignable, un champ nul là où on n'en attendait pas — personne ne
// l'attrape, et Node arrête le processus sur un rejet non intercepté.
// 33 routes de ce dépôt étaient dans ce cas au moment où ces lignes sont
// écrites, et la 34e aurait été écrite le mois prochain.
//
// ── POURQUOI ICI, ET PAS 33 try/catch ───────────────────────────────────
//
// Un try/catch par route, c'est 33 corrections et un oubli garanti. Ici, on
// enveloppe UNE fois la mécanique qu'Express utilise pour enregistrer un
// gestionnaire : toutes les routes en profitent, y compris celles qui
// n'existent pas encore.
//
// ── CE QUE ÇA CHANGE, EXACTEMENT ────────────────────────────────────────
//
// Rien pour un gestionnaire qui réussit. Pour un gestionnaire qui échoue,
// l'erreur part vers `next(err)` — donc vers le gestionnaire d'erreurs en
// bas de ce fichier, qui répond une page ou du JSON selon la demande.
//
// SANS ÇA, ET C'EST LE PIÈGE : le garde-fou `unhandledRejection` (plus bas)
// empêche bien le processus de mourir, mais PERSONNE NE RÉPOND AU CLIENT.
// La requête reste suspendue jusqu'à ce que le navigateur abandonne. Vu en
// vrai : le serveur restait debout, et la page tournait dans le vide.
// Ne pas planter ne suffit pas ; il faut répondre.
//
// Les gestionnaires d'ERREUR (quatre paramètres) ne sont pas touchés :
// Express les reconnaît à leur nombre d'arguments, et les envelopper leur
// ferait perdre ce signalement.
(function attraperLesPromesses() {
    const Route = require("express/lib/router/route");
    const METHODES = ["get", "post", "put", "delete", "patch", "all", "options", "head"];
    for (const methode of METHODES) {
        const original = Route.prototype[methode];
        if (typeof original !== "function") continue;
        Route.prototype[methode] = function (...gestionnaires) {
            return original.apply(this, gestionnaires.flat().map((g) => {
                if (typeof g !== "function" || g.length === 4) return g;
                const enveloppe = function (req, res, next) {
                    try {
                        const resultat = g.call(this, req, res, next);
                        if (resultat && typeof resultat.catch === "function") resultat.catch(next);
                        return resultat;
                    } catch (err) { next(err); }
                };
                // Le nombre d'arguments est conservé : du code qui inspecte
                // `handler.length` (Express lui-même le fait) doit continuer
                // à voir ce qu'il voyait.
                Object.defineProperty(enveloppe, "length", { value: g.length });
                return enveloppe;
            }));
        };
    }
})();

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
//
// ── UN CONTRÔLE DE SANTÉ QUI RÉPOND TOUJOURS OUI NE CONTRÔLE RIEN ───────
//
// Cette route répondait `200 {status:"ok"}` sans jamais rien vérifier. Elle
// prouvait une seule chose : que Node est vivant. Or Node reste vivant
// quand la base est morte — vu en direct pendant cette séance : Postgres
// arrêté, le journal du serveur plein de `ECONNREFUSED`, et `/health` qui
// répondait 200 sans broncher.
//
// C'est la pire panne possible pour un moniteur : il affiche du vert, ne
// prévient personne, et c'est une marchande qui découvre que sa boutique
// ne charge plus. Un moniteur branché sur une route qui ment est pire
// qu'aucun moniteur — il donne la tranquillité sans la mériter.
//
// On interroge donc la base pour de vrai. `SELECT 1` ne lit aucune table :
// il ne peut pas échouer pour une autre raison qu'une base injoignable, et
// il ne coûte rien même appelé toutes les minutes.
//
// ── POURQUOI 503 ET PAS 500 ─────────────────────────────────────────────
//
// 503 « Service Unavailable » est le code que les moniteurs (Uptime Kuma,
// UptimeRobot) et les orchestrateurs comprennent comme « en panne,
// réessaie », là où un 500 ressemble à un bug applicatif. Render s'en sert
// aussi pour décider si une instance doit recevoir du trafic.
app.get("/health", async (req, res) => {
    const debut = Date.now();
    try {
        await require("./services/db").query("SELECT 1");
        res.status(200).json({
            status: "ok",
            base: "ok",
            baseMs: Date.now() - debut,
            uptime: Math.round(process.uptime()),
        });
    } catch (err) {
        // Le message de l'erreur est renvoyé : cette route n'est protégée
        // par aucune session (un moniteur n'en a pas), donc on ne met ici
        // que ce qu'on accepte de rendre public. `err.message` de `pg`
        // donne « connect ECONNREFUSED … » — un état, pas un secret.
        console.error("❌ /health : base injoignable —", err.message);
        res.status(503).json({
            status: "degrade",
            base: "injoignable",
            detail: err.message,
            uptime: Math.round(process.uptime()),
        });
    }
});

// ── SESSION (Supabase/Postgres — persiste aux redéploiements) ──
// ── LA MÊME RÈGLE QUE `services/db.js`, PAS UNE COPIE ───────────────────
//
// `ssl: { rejectUnauthorized: false }` était écrit en dur ici. C'était la
// deuxième écriture de la même règle, et celle-ci avait perdu la
// condition : elle EXIGEAIT TLS, toujours.
//
// Ça n'a jamais mordu parce que la base de Render et une base Debian
// locale acceptent toutes deux TLS. Le contrôle automatique l'a trouvé en
// démarrant SAMII contre l'image Docker `postgres:16`, qui ne l'accepte
// pas : « The server does not support SSL connections », et toute requête
// touchant la session — l'inscription, le chat, le QG — répondait 500.
//
// On lit donc la valeur là où elle est décidée. Une règle recopiée finit
// toujours par diverger de son original ; celle-là l'avait déjà fait.
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: db.SSL,
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

// ── LA PORTE : CE QUI N'EST PAS À ELLE NE S'OUVRE PAS ───────────────────
//
// « Cache le hub pour les gens qui s'inscrivent. Enlève tout ce qui relève
// de chez nous, sauf ce qu'on a décidé de laisser. »
//
// Jusqu'ici, on avait retiré nos modules de SA COLONNE DE GAUCHE. Ça les
// rendait invisibles, pas absents : /hub, /marketplace, /arsenal, /coffre,
// /academy, /parrainage répondaient toujours à qui tapait l'adresse. Et une
// adresse se tape sans mauvaise intention — un lien collé dans un groupe
// WhatsApp, un historique de navigateur, une recherche Google.
//
// Cacher un bouton n'a jamais fermé une porte.
//
// CE MIDDLEWARE EST LA PORTE. Il est posé ici, avant TOUTE route, pour une
// raison : plus bas, chaque montage aurait dû penser à se protéger, et
// celui qu'on ajoute demain n'y penserait pas. Ici, l'oubli est fermé par
// défaut — un module qu'on n'a pas explicitement donné n'existe pas chez
// elle.
//
// Sur notre service, `cheminsAutorises` rend null et rien ne change : ce
// code ne peut pas casser la maison.
app.use((req, res, next) => {
    const modulesQg = require("./config/modules-qg");
    const permis = modulesQg.cheminsAutorises(res.locals.COM);
    if (modulesQg.chemineAutorise(req.path, permis)) return next();

    // On ne dit pas « interdit » : pour elle et ses membres, ces pages
    // n'existent tout simplement pas. Un refus expliqué révélerait qu'il y
    // a autre chose derrière, et donnerait envie d'y aller.
    //
    // Une navigation se termine chez elle plutôt que sur une impasse —
    // c'est précisément ce qui manquait. Le reste (formulaire, appel
    // JavaScript) reçoit un vrai 404 : rediriger une requête de données
    // renverrait une page HTML là où du JSON est attendu, et l'erreur
    // serait incompréhensible.
    if (req.method === "GET" && (req.headers.accept || "").includes("text/html")) {
        return res.redirect(require("./config/communautes").accueil(res.locals.COM));
    }
    return res.status(404).json({ error: "Not found" });
});
// ── AUTH MIDDLEWARE ────────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// Le nom d'une communauté vient de notre configuration, pas d'un
// visiteur — mais on l'échappe quand même : le jour où il viendra d'une
// base ou d'un formulaire, personne ne repassera ajouter cette ligne.
function escapeHtmlSimple(v) {
    return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
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
// Les commentaires Facebook et Instagram. Adresse DÉDIÉE plutôt que
// « /webhook/meta » : le routeur de suppression de données est déjà monté
// là, et deux routeurs sur un même préfixe se lisent dans l'ordre de
// déclaration — c'est le genre de voisinage où l'un finit par avaler la
// requête de l'autre le jour où quelqu'un ajoute un `router.post("/")`.
app.use("/webhook/meta/commentaires", require("./routes/webhook-meta"));
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
// Le choix du QG quand on en possède plusieurs. Fait partie du parcours de
// connexion, donc ouvert partout : un marchand d'une communauté partenaire
// peut lui aussi avoir deux boutiques.
app.use("/mes-qg", require("./routes/mes-qg"));
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
// SAMII JARVIS — la bulle de cristal. Volontairement HORS de /samii : ce
// préfixe appartient au module `assistant`, que les partenaires ont, et
// cette page raconte l'activité d'un compte. Sous /samii elle se serait
// ouverte chez elles par simple préfixe. Voir routes/jarvis.js.
// Pas de requireAuth ici : ce fichier a ses PROPRES gardes, et il en a
// deux différents. La bulle demande une session utilisateur ; la page
// d'état du moteur demande le fondateur (session.isAdmin), qui n'a pas
// `loggedIn`. Le garde global d'index.js barrait donc le fondateur à sa
// propre page de diagnostic. Une porte de plus n'est pas une porte de
// mieux quand elle ne connaît pas les gens qui doivent passer.
app.use("/jarvis",    require("./routes/jarvis"));
// Les agents sociaux. Comme /jarvis, sans `requireAuth` ici : le routeur
// pose sa propre porte (fondateur uniquement), et la porte des communautés
// juste au-dessus la ferme déjà chez une partenaire — le contenu d'OG
// Technology ne se pilote pas depuis le domaine d'Inès.
app.use("/social",    require("./routes/social"));
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
// « Mes messages » : le courrier laissé sur un profil ou sous une annonce.
// Distinct de /discussions, qui porte les salons ouverts à la communauté.
app.use("/messages", require("./routes/messages"));
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
        // ── LE COMPTE « CLIENT » QUI A DÉJÀ UNE BOUTIQUE ────────────────
        //
        // Cette ligne renvoyait tout compte « client » au fil d'actualité,
        // sans regarder s'il possédait une boutique. Or « client » est la
        // case cochée d'avance à l'inscription : des gens ont ouvert une
        // boutique et se sont retrouvés dehors, renvoyés à l'accueil à
        // chaque clic sur « Ma boutique ». Silencieusement — du point de
        // vue du serveur, une redirection réussie n'est pas une erreur.
        //
        // On regarde donc les faits avant de fermer : une boutique à son
        // nom, et la porte s'ouvre (le compte est corrigé au passage). Rien
        // à son nom, et on garde l'ancien comportement — /qg est l'espace
        // marchand, quelqu'un qui n'a pas de boutique n'a rien à y faire.
        if (req.session?.typeCompte === "client") {
            const siennes = await workspaceService.getByOwner(req.session.email);
            const sienne = siennes.find((w) =>
                workspaceService.appartientA(w, req.session.email, req.session));
            if (!sienne) {
                return res.redirect(require("./config/communautes").accueilClient(res.locals.COM));
            }
            await workspaceService.promouvoirEnMarchand(req.session);
            req.session.workspaceId = sienne.workspaceId;
            await new Promise((resoudre) => req.session.save(resoudre));
        }

        // ── « JE CLIQUE SUR MA BOUTIQUE ET ÇA NE MÈNE NULLE PART » ───────
        //
        // Trois sorties de cette route renvoyaient vers accueilMarchand(),
        // c'est-à-dire /workspace/create chez une partenaire. Or
        // /workspace/create, s'il trouve une boutique existante, renvoie
        // vers /qg. Deux pages qui se renvoient la balle : la page charge,
        // charge, et on ne bouge pas d'un pixel. Aucune erreur nulle part,
        // parce que du point de vue du serveur tout va bien.
        //
        // C'est moi qui l'ai créée en remplaçant /hub — qui, lui, était une
        // page terminale : il AFFICHAIT la liste des boutiques.
        //
        // LA CORRECTION : cette route ne demande plus à quelqu'un d'autre
        // de retrouver la boutique, elle la retrouve. On ne sort d'ici que
        // s'il n'y en a vraiment aucune — et cette sortie-là ne revient
        // jamais, puisque /workspace/create n'a alors rien à trouver.
        const communautesM = require("./config/communautes");
        let workspace = null;
        if (req.session?.workspaceId) {
            workspace = await workspaceService.getById(req.session.workspaceId);
        }

        // La règle de propriété vit dans workspaceService, à un seul
        // endroit : elle se posait ici ET dans /workspace/create, et les
        // deux ne répondaient pas pareil. C'est ce désaccord qui faisait
        // la boucle.
        const luiAppartient = (w) => workspaceService.appartientA(w, req.session.email, req.session);

        if (!luiAppartient(workspace)) {
            // La boutique de la session est absente ou n'est pas la sienne :
            // on cherche les siennes plutôt que de le renvoyer ailleurs.
            const siennes = await workspaceService.getByOwner(req.session.email);
            workspace = siennes.find(luiAppartient) || null;
            if (!workspace) {
                return clearWorkspaceSession(req, () =>
                    res.redirect(communautesM.accueilMarchand(res.locals.COM)));
            }
            req.session.workspaceId = workspace.workspaceId;
            await new Promise((resoudre) => req.session.save(resoudre));
        }

        const estAgenceProprietaire = req.session.typeCompte === "agence"
            && workspace.agenceId
            && workspace.agenceId === req.session.userId;

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
        // UNE ERREUR S'AFFICHE, ELLE NE SE REDIRIGE PAS.
        //
        // Ce catch renvoyait vers la création de boutique. Or si le QG
        // échoue au rendu, il échouera encore au tour suivant : la création
        // retrouve la boutique, renvoie au QG, qui replante, qui renvoie à
        // la création… La page charge indéfiniment et rien ne bouge, alors
        // que la vraie panne est ici, écrite dans les journaux que personne
        // ne regarde à ce moment-là.
        //
        // Une impasse honnête vaut mieux qu'un manège : on voit qu'il y a
        // un problème, et on peut aller ailleurs.
        console.error("❌ GET /qg :", err);
        const communautesE = require("./config/communautes");
        const COMe = res.locals.COM || communautesE.get(communautesE.DEFAUT);
        const fond = COMe.couleurs?.["--bg"] || "#03060b";
        const encre = COMe.couleurs?.["--text"] || "#f5fbff";
        return res.status(500).send(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtmlSimple(COMe.nom)}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:${fond};color:${encre};font-family:system-ui,-apple-system,sans-serif;padding:28px;text-align:center;">
  <div style="max-width:420px;">
    <h1 style="font-size:19px;margin:0 0 12px;">Ta boutique n'a pas pu s'ouvrir</h1>
    <p style="font-size:14px;line-height:1.6;opacity:.8;margin:0 0 22px;">
      Le problème est de notre côté, pas du tien. Réessaie dans un instant — et préviens-nous si ça continue.</p>
    <a href="/qg" style="display:inline-block;padding:12px 22px;border-radius:11px;background:${COMe.couleurs?.["--blue"] || "#00d9ff"};color:${COMe.couleurs?.["--sur-accent"] || "#001018"};text-decoration:none;font-weight:700;font-size:13.5px;">Réessayer</a>
    <div style="margin-top:14px;"><a href="${communautesE.accueil(COMe)}" style="color:inherit;opacity:.6;font-size:12.5px;">Retour à la communauté</a></div>
  </div>
</body></html>`);
    }
});

app.get("/qg/:metier", requireAuth, (req, res) => {
    if (req.session?.workspaceId) return res.redirect("/qg");
    res.redirect(require("./config/communautes").accueilMarchand(res.locals.COM));
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

// ══════════════════════════════════════════════════════════════════════════
// LE FILET — UNE PAGE QUI TOMBE NE DOIT PAS EMPORTER LE SERVEUR
//
// CE QU'ON A VU EN FAISANT TOURNER L'APPLICATION. Une requête vers
// /autopost a fait S'ARRÊTER NODE. Pas la page : le processus. SAMII, les
// boutiques, les webhooks de paiement, la communauté d'Inès — tout, pendant
// que Render redémarre.
//
// La cause est une construction courante et invisible :
//
//     router.get("/", requireAuth, async (req, res) => { ... })
//
// Express 4 ne sait rien faire d'une promesse rejetée. Le `async` en fait
// une, personne ne l'attrape, et Node arrête le processus sur un rejet non
// intercepté. Il suffit d'une colonne absente, d'une base momentanément
// injoignable, d'un champ nul là où on n'en attendait pas.
//
// À la date où ces lignes sont écrites, 33 routes du dépôt sont dans ce cas.
// On pourrait ajouter 33 try/catch — et le 34e serait oublié le mois
// prochain. On pose donc le filet à l'unique endroit qui les couvre toutes,
// y compris celles qui n'existent pas encore.
//
// ── DEUX FILETS, PAS UN ─────────────────────────────────────────────────
//
// 1. Le gestionnaire d'erreurs Express, pour ce qui remonte jusqu'à lui.
// 2. `unhandledRejection`, pour ce qui lui échappe — une promesse lancée
//    hors d'une requête (un moteur planifié, un `.then` oublié) n'a aucun
//    `res` où atterrir.
//
// ── ON JOURNALISE FORT ──────────────────────────────────────────────────
//
// Un filet qui avale en silence est pire que pas de filet : le bug reste,
// et plus personne ne le voit. Chaque prise est donc écrite avec sa pile
// complète, et ce qui arrive pendant une requête part aussi dans la table
// `journal` — d'où SAMII le lit quand on lui demande ce qui s'est passé.
//
// ── TOUTE ERREUR N'EST PAS UNE PANNE ────────────────────────────────────
//
// `express.json()` lève une erreur portant `status: 400` quand le corps
// reçu n'est pas du JSON valide : ce n'est pas notre serveur qui casse,
// c'est l'appelant qui envoie n'importe quoi. Avant ce filet, Express
// répondait 400. Un filet qui répondrait 500 à tout mentirait deux fois :
// il accuserait le serveur, et il noierait le journal sous des erreurs
// qui ne sont pas les nôtres. On garde donc le code que l'erreur porte
// quand c'est un 4xx, et on ne journalise que ce qui est vraiment de
// notre côté.
app.use((err, req, res, next) => {
    const porte = Number(err.status || err.statusCode);
    const code = porte >= 400 && porte <= 499 ? porte : 500;

    if (code === 500) {
        console.error(`❌ ERREUR NON INTERCEPTÉE sur ${req.method} ${req.originalUrl} :`, err);
        try {
            require("./services/journalService").log({
                action: "erreur.route",
                details: `${req.method} ${req.originalUrl} — ${err.message}`,
                workspaceId: req.session?.workspaceId || null,
                userId: req.session?.userId || null,
            });
        } catch { /* le journal ne doit jamais aggraver une erreur */ }
    } else {
        console.warn(`⚠️ Requête refusée (${code}) sur ${req.method} ${req.originalUrl} : ${err.message}`);
    }

    if (res.headersSent) return next(err);

    // Une requête de données reçoit du JSON, une page reçoit une page. Sinon
    // le navigateur affiche du JSON brut, ou le script reçoit du HTML et
    // échoue sur une erreur qui n'a plus rien à voir avec la vraie.
    const veutHtml = (req.headers.accept || "").includes("text/html");
    if (!veutHtml) {
        return res.status(code).json({
            error: code === 500 ? "Erreur serveur." : "Requête invalide.",
        });
    }
    const titre = code === 500
        ? "Cette page n'a pas pu s'afficher."
        : "Cette demande n'a pas pu être traitée.";
    res.status(code).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Erreur</title></head>
<body style="background:#0b0b0f;color:#e8e6df;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center">
<div><h1 style="font-size:1.1rem;font-weight:600">${titre}</h1>
<p style="color:#8a8f9e;font-size:.9rem;max-width:420px;line-height:1.6">
Le reste du site fonctionne. Reviens en arrière, ou retourne à l'accueil.</p>
<a href="/" style="color:#5ad4ff">Retour à l'accueil</a></div></body></html>`);
});

process.on("unhandledRejection", (raison) => {
    console.error("❌ PROMESSE REJETÉE HORS REQUÊTE — le serveur reste debout :", raison);
});
// `uncaughtException` n'est PAS intercepté ici, volontairement. Une
// exception synchrone qui remonte jusqu'au sommet laisse le processus dans
// un état dont on ne sait rien ; continuer serait servir des réponses
// fausses. Le rejet de promesse, lui, est presque toujours une requête qui a
// mal tourné — le reste du serveur va parfaitement bien.

// ── SERVEUR ────────────────────────────────────────────────
server.listen(CONFIG.PORT, () => {
    console.log("🚀 SAMII OS démarre...");
    console.log(`🚀 SAMII OS lancé sur ${CONFIG.PORT}`);
});
