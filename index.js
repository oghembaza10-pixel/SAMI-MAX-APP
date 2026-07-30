// ======================================================
// SAMII OS V1 — Point d'entrée
// ======================================================
const path             = require("path");
const express          = require("express");
const session          = require("express-session");
const pgSession         = require("connect-pg-simple")(session);
const { Pool }          = require("pg");
const http             = require("http");
const { Server }       = require("socket.io");
const CONFIG           = require("./config");
const workspaceService = require("./services/workspaceService");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

const socketService = require("./services/socketService");
socketService.init(io);

// ── MIDDLEWARES ───────────────────────────────────────
app.set("trust proxy", 1);

app.use("/billing/webhook", express.raw({ type: "application/json" }));
app.use("/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

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

// ── LOCALS (disponibles dans toutes les vues EJS) ─────
app.use((req, res, next) => {
    res.locals.workspaceId = req.session?.workspaceId || null;
    res.locals.shop        = req.session?.shop || null;
    res.locals.loggedIn    = !!req.session?.loggedIn;
    next();
});

// ── AUTH MIDDLEWARE ───────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function clearWorkspaceSession(req, callback) {
    delete req.session.workspaceId;
    delete req.session.lastWorkspace;
    req.session.save(callback);
}

// ── BOOTSTRAP MOTEURS ─────────────────────────────────
const { registerChannels, registerScheduledJobs } = require("./kernel/bootstrap");
registerChannels();
registerScheduledJobs();

// ══════════════════════════════════════════════════════
// ROUTES — OAuth externes (Meta, Shopify)
// ══════════════════════════════════════════════════════
app.use(require("./Itinéraires/auth-meta"));
app.use(require("./Itinéraires/auth-shopify"));
app.use(require("./Itinéraires/auth-woocommerce"));
app.use(require("./Itinéraires/webhook-woocommerce").router);
// ══════════════════════════════════════════════════════
// ROUTES — Webhooks entrants
// ══════════════════════════════════════════════════════
app.use("/webhook", require("./routes/webhook-compliance"));
app.use("/webhook", require("./routes/webhook"));
app.use("/telegram", require("./routes/telegram"));

// ══════════════════════════════════════════════════════
// ROUTES — Authentification / compte
// ══════════════════════════════════════════════════════
app.use("/billing", require("./routes/billing"));
app.use("/login",    require("./routes/login"));
app.use("/register", require("./routes/register"));

// ══════════════════════════════════════════════════════
// ROUTES — Plateforme (protégées par requireAuth)
// ══════════════════════════════════════════════════════
app.use("/hub",       require("./routes/hub"));
app.use("/workspace", require("./routes/workspace"));
app.use("/dashboard", requireAuth, require("./routes/dashboard"));
app.use(requireAuth, require("./routes/tools"));
app.use("/profile",   requireAuth, require("./routes/profile"));
app.use("/settings",  requireAuth, require("./routes/settings"));
app.use("/ads",       requireAuth, require("./routes/ads"));
app.use("/coffre",    requireAuth, require("./routes/coffre"));
app.use("/arsenal",   requireAuth, require("./routes/arsenal"));
app.use("/samii/opportunites", require("./routes/opportunites"));
app.use("/samii/griot", require("./routes/griot"));
app.use("/samii/top-produits", require("./routes/topproduits"));
app.use("/samii",     requireAuth, require("./routes/samii-mode"));
app.use("/connect",   require("./routes/connector"));

// ══════════════════════════════════════════════════════
// ROUTES — Vitrine (public)
// ══════════════════════════════════════════════════════
app.use("/academy",     require("./routes/academy"));
app.use("/community",   require("./routes/community"));
app.use("/marketplace", require("./routes/marketplace"));
app.use("/drivers",     require("./routes/drivers"));
app.use("/api",         require("./routes/api"));

app.get("/inscription", requireAuth, (req, res) => {
    const metier = req.query.metier || "";
    res.redirect(`/workspace/create${metier ? `?metier=${metier}` : ""}`);
});

// ── PAGE ACCUEIL ──────────────────────────────────────
app.get("/", (req, res) => res.render("index"));

// ── QG — route universelle SOLDAT V1 ─────────────────
app.get("/qg", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");

        const workspace = await workspaceService.getById(workspaceId);

        if (!workspace) {
            return clearWorkspaceSession(req, () => res.redirect("/hub"));
        }
        if (workspace.owner !== req.session.email) {
            return clearWorkspaceSession(req, () => res.redirect("/hub"));
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
            attente     : false,
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

// ── SAMII — copilote universel ────────────────────────
app.get("/samii", requireAuth, (req, res) => {
    res.render("samii", {
        workspaceId : req.session.workspaceId || "",
        shop        : req.session.shop        || "",
    });
});

// ── LOGOUT ────────────────────────────────────────────
app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

// ── SOCKET.IO ─────────────────────────────────────────
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

// ── ENV CHECK ─────────────────────────────────────────
if (!CONFIG.AIRTABLE.API_KEY) console.error("❌ AIRTABLE_API_KEY manquante");
if (!CONFIG.AIRTABLE.BASE_ID) console.error("❌ AIRTABLE_BASE_ID manquant");
if (!CONFIG.GEMINI.API_KEY)   console.error("❌ GEMINI_API_KEY manquante");
if (!process.env.DATABASE_URL) console.error("❌ DATABASE_URL manquante (sessions Supabase)");

// ── TEST TELEGRAM ─────────────────────────────────────
app.get("/test-telegram", async (req, res) => {
    const telegram = require("./services/telegramService");
    const result   = await telegram.send("8276462482", "👑 SAMII OS — Test direct !");
    res.json(result);
});

// ── SERVEUR ───────────────────────────────────────────
server.listen(CONFIG.PORT, () => {
    console.log("✅ Airtable connecté");
    console.log("🚀 SAMII OS démarre...");
    console.log(`🚀 SAMII OS lancé sur ${CONFIG.PORT}`);
});
