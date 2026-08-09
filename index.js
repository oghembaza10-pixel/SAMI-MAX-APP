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

app.set("trust proxy", 1);
app.use("/billing/webhook", express.raw({ type: "application/json" }));
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
app.use(session({
    store: new pgSession({ pool: pgPool, tableName: "session", createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "samii-secret-v1",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
    res.locals.workspaceId = req.session?.workspaceId || null;
    res.locals.shop = req.session?.shop || null;
    res.locals.loggedIn = !!req.session?.loggedIn;
    res.locals.userId = req.session?.userId || null;
    next();
});

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function clearWorkspaceSession(req, callback) {
    delete req.session.workspaceId;
    delete req.session.lastWorkspace;
    req.session.save(callback);
}

const { registerChannels, registerScheduledJobs, registerTrackingProviders } = require("./kernel/bootstrap");
registerChannels();
registerTrackingProviders();
registerScheduledJobs();

app.use(require("./routes/auth-meta"));
app.use(require("./routes/auth-shopify"));
app.use(require("./routes/auth-woocommerce"));
app.use(require("./routes/webhook-woocommerce").router);
app.use("/webhook", require("./routes/webhook-compliance"));
app.use("/webhook", require("./routes/webhook"));
app.use("/telegram", require("./routes/telegram"));

app.use("/billing", require("./routes/billing"));
app.use("/login", require("./routes/login"));
app.use("/register", require("./routes/register"));
app.use("/password-reset", require("./routes/password-reset"));

app.use("/hub", require("./routes/hub"));
app.use("/workspace", require("./routes/workspace"));
app.use("/client-qg", require("./routes/client-qg"));
app.use("/dashboard", requireAuth, require("./routes/dashboard"));
app.use("/tools", requireAuth, require("./routes/tools"));
app.use("/profile", requireAuth, require("./routes/profile"));
app.use("/vitrine", require("./routes/vitrine"));
app.use("/settings", requireAuth, require("./routes/settings"));
app.use("/ads", requireAuth, require("./routes/ads"));
app.use("/coffre", requireAuth, require("./routes/coffre"));
app.use("/arsenal", requireAuth, require("./routes/arsenal"));
app.use("/guerre", require("./routes/guerre"));
app.use("/samii/opportunites", require("./routes/opportunites"));
app.use("/samii/griot", require("./routes/griot"));
app.use("/samii/top-produits", require("./routes/topproduits"));
app.use("/samii/diplomate", require("./routes/diplomate"));
app.use("/samii/oeil-concurrentiel", require("./routes/oeilconcurrentiel"));
app.use("/samii/chasseur-stock", require("./routes/chasseurstock"));
app.use("/samii/memoire-client", require("./routes/memoireclient"));
app.use("/automatisations", requireAuth, require("./routes/automatisations"));
app.use("/missions", requireAuth, require("./routes/missions"));
app.use("/samii/miroir", requireAuth, require("./routes/miroir"));
app.use("/samii/messager-eclair", requireAuth, require("./routes/messagereclair"));
app.use("/samii/oracle-financier", requireAuth, require("./routes/oraclefinancier"));
app.use("/samii", requireAuth, require("./routes/samii-mode"));
app.use("/connect", require("./routes/connector"));

app.use("/academy", require("./routes/academy"));
app.use("/community", require("./routes/community"));
app.use("/marketplace", require("./routes/marketplace"));
app.use("/drivers", require("./routes/drivers"));
app.use("/api", require("./routes/api"));

// CJ DROPSHIPPING — import catalogue protégé
app.use("/api/cj", requireAuth, require("./routes/cj-import"));

app.get("/inscription", requireAuth, (req, res) => {
    const metier = req.query.metier || "";
    res.redirect(`/workspace/create${metier ? `?metier=${metier}` : ""}`);
});

app.get("/", (req, res) => {
    res.render("index", {
        loggedIn: !!req.session?.loggedIn,
        nom: req.session?.nom || "",
        typeCompte: req.session?.typeCompte || "client",
    });
});

app.get("/qg", requireAuth, async (req, res) => {
    try {
        if (req.session?.typeCompte === "client") return res.redirect("/client-qg");
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");
        const workspace = await workspaceService.getById(workspaceId);
        if (!workspace) return clearWorkspaceSession(req, () => res.redirect("/hub"));
        if (workspace.owner !== req.session.email) return clearWorkspaceSession(req, () => res.redirect("/hub"));
        res.render("qg-template", {
            workspaceId: workspace.workspaceId,
            nom: workspace.nom,
            metier: workspace.metier || "workspace",
            description: workspace.description || "",
            langue: workspace.langue || "fr",
            pays: workspace.pays || "DZ",
            devise: workspace.devise || "DZD",
            connecteurs: workspace.connecteurs || [],
            samii: workspace.samii || { mode: "auto" },
            logo: workspace.logo || "",
            shop: req.session.shop || "",
            attente: false,
        });
    } catch (err) {
        console.error("❌ GET /qg :", err);
        return clearWorkspaceSession(req, () => res.redirect("/hub"));
    }
});

app.get("/qg/:metier", requireAuth, (req, res) => req.session?.workspaceId ? res.redirect("/qg") : res.redirect("/hub"));
app.get("/qg/:metier/connecter", requireAuth, (req, res) => res.redirect("/qg"));

app.get("/samii", requireAuth, (req, res) => {
    res.render("samii", { workspaceId: req.session.workspaceId || "", shop: req.session.shop || "" });
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));

io.on("connection", (socket) => {
    console.log("🔌 Socket connecté :", socket.id);
    socket.on("join", (workspaceId) => {
        if (workspaceId && typeof workspaceId === "string") socket.join(workspaceId);
    });
    socket.on("disconnect", () => console.log("🔌 Socket déconnecté :", socket.id));
});

if (!CONFIG.AIRTABLE.API_KEY) console.error("❌ AIRTABLE_API_KEY manquante");
if (!CONFIG.AIRTABLE.BASE_ID) console.error("❌ AIRTABLE_BASE_ID manquant");
if (!CONFIG.GEMINI.API_KEY) console.error("❌ GEMINI_API_KEY manquante");
if (!process.env.DATABASE_URL) console.error("❌ DATABASE_URL manquante (sessions Supabase)");

app.get("/test-telegram", async (req, res) => {
    const telegram = require("./services/telegramService");
    const result = await telegram.send("8276462482", "👑 SAMII OS — Test direct !");
    res.json(result);
});

server.listen(CONFIG.PORT, () => {
    console.log("✅ Airtable connecté");
    console.log("🚀 SAMII OS démarre...");
    console.log(`🚀 SAMII OS lancé sur ${CONFIG.PORT}`);
});
