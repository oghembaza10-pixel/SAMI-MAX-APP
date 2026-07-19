// ======================================================
// SAMII OS V1 — Point d'entrée
// ======================================================

const path             = require("path");
const express          = require("express");
const session          = require("express-session");
const MemoryStore      = require("memorystore")(session);
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
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ── SESSION ───────────────────────────────────────────
app.use(session({
    secret           : process.env.SESSION_SECRET || "samii-secret-v1",
    resave           : false,
    saveUninitialized: false,
    store            : new MemoryStore({ checkPeriod: 86400000 }),
    cookie           : {
        httpOnly: true,
        sameSite: "lax",
        secure  : process.env.NODE_ENV === "production",
        maxAge  : 7 * 24 * 60 * 60 * 1000,
    },
}));

// ── LOCALS ────────────────────────────────────────────
app.use((req, res, next) => {
    res.locals.workspaceId = req.session?.workspaceId || null;
    res.locals.shop        = req.session?.shop        || null;
    res.locals.loggedIn    = !!req.session?.loggedIn;
    next();
});

// ── AUTH MIDDLEWARE ───────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// ── Helper — nettoyer workspace de la session ─────────
function clearWorkspaceSession(req, callback) {
    delete req.session.workspaceId;
    delete req.session.lastWorkspace;
    req.session.save(callback);
}

// ── BOOTSTRAP ─────────────────────────────────────────
const { registerChannels } = require("./kernel/bootstrap");
registerChannels();
require("./kernel/scheduler");

// ── ROUTES APP ────────────────────────────────────────
app.use(require("./Itinéraires/auth-meta"));
app.use(require("./Itinéraires/auth-shopify"));

app.use("/webhook",     require("./routes/webhook"));
app.use("/telegram",    require("./routes/telegram"));
app.use("/connect",     require("./routes/connect"));
app.use("/dashboard",   requireAuth, require("./routes/dashboard"));
app.use("/profile",     requireAuth, require("./routes/profile"));
app.use("/settings",    requireAuth, require("./routes/settings"));
app.use("/hub",         require("./routes/hub"));
app.use("/academy",     require("./routes/academy"));
app.use("/community",   require("./routes/community"));
app.use("/marketplace", require("./routes/marketplace"));
app.use("/drivers",     require("./routes/drivers"));
app.use("/login",       require("./routes/login"));
app.use("/register",    require("./routes/register"));
app.use("/api",         require("./routes/api"));
// ── Workspace create — page à construire ─────────────
app.get("/workspace/create", requireAuth, (req, res) => {
    const metier = req.query.metier || "";
    res.render("workspace-create", { metier });
});

// ── PAGE ACCUEIL ──────────────────────────────────────
app.get("/", (req, res) => res.render("index"));

// ── QG — route universelle SOLDAT V1 ─────────────────
app.get("/qg", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;

        // Pas de workspace en session → hub
        if (!workspaceId) return res.redirect("/hub");

        // ✅ Airtable = source de vérité
        const workspace = await workspaceService.getById(workspaceId);

        // ✅ Sécurité 1 — workspace introuvable → nettoyer session
        if (!workspace) {
            return clearWorkspaceSession(req, () => res.redirect("/hub"));
        }

        // ✅ Sécurité 2 — vérifier ownership (session corrompue ou bug)
        if (workspace.owner !== req.session.email) {
            return clearWorkspaceSession(req, () => res.redirect("/hub"));
        }

        res.render("qg-template", {
            workspaceId : workspace.workspaceId,
            nom         : workspace.nom,
            metier      : workspace.metier || "workspace",
            logo        : workspace.logo   || "",
            shop        : req.session.shop || "",
            attente     : false,
        });

    } catch (err) {
        console.error("❌ GET /qg :", err);
        return clearWorkspaceSession(req, () => res.redirect("/hub"));
    }
});

// ── QG — anciennes routes → redirect temporaire ───────
// À supprimer quand confirmé qu'aucun lien ne les utilise
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
