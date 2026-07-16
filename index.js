// ======================================================
// SAMII OS V1 — Point d'entrée
// ======================================================

// ── 1. CONFIG ─────────────────────────────────────────
const path    = require("path");
const express = require("express");
const session = require("express-session");
const http    = require("http");
const { Server } = require("socket.io");
const CONFIG  = require("./config");

// ── 2. EXPRESS + SERVEUR HTTP ─────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

// ── 3. SOCKET SERVICE ─────────────────────────────────
const socketService = require("./services/socketService");
socketService.init(io);

// ── 4. MIDDLEWARES ────────────────────────────────────
app.set("trust proxy", 1);
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ── 5. SESSION ────────────────────────────────────────
app.use(session({
    secret           : process.env.SESSION_SECRET || "samii-secret-v1",
    resave           : false,
    saveUninitialized: false,
    cookie           : {
        httpOnly: true,
        sameSite: "lax",
        secure  : process.env.NODE_ENV === "production",
        maxAge  : 7 * 24 * 60 * 60 * 1000,
    },
}));

// ── 6. LOCALS GLOBAUX ─────────────────────────────────
app.use((req, res, next) => {
    res.locals.shop       = req.session?.shop       || null;
    res.locals.loggedIn   = !!req.session?.loggedIn;
    res.locals.boutiqueId = req.session?.boutiqueId || null;
    next();
});

// ── 7. AUTH MIDDLEWARE ────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// ── 8. BOOTSTRAP ──────────────────────────────────────
const { registerChannels } = require("./kernel/bootstrap");
registerChannels();
const scheduler = require("./kernel/scheduler");

// ── 9. ROUTES ─────────────────────────────────────────
app.use(require("./Itinéraires/auth-meta"));
app.use(require("./Itinéraires/auth-shopify"));

app.use("/webhook",     require("./routes/webhook"));
app.use("/telegram",    require("./routes/telegram"));
app.use("/hub",         require("./routes/hub"));
app.use("/connect",     require("./routes/connect"));
app.use("/dashboard",   requireAuth, require("./routes/dashboard"));
app.use("/profile",     requireAuth, require("./routes/profile"));
app.use("/settings",    requireAuth, require("./routes/settings"));
app.use("/academy",     require("./routes/academy"));
app.use("/community",   require("./routes/community"));
app.use("/marketplace", require("./routes/marketplace"));
app.use("/drivers",     require("./routes/drivers"));
app.use("/login",       require("./routes/login"));
app.use("/register",    require("./routes/register"));
app.use("/api",         require("./routes/api"));

// ── 10. ROUTES DIRECTES ───────────────────────────────
app.get("/", (req, res) => res.render("index"));

app.get("/samii", requireAuth, (req, res) => res.render("samii", {
    shop: req.session.shop,
}));

app.get("/qg/:metier", requireAuth, (req, res) => res.render("qg-template", {
    metier    : req.params.metier,
    shop      : req.session.shop,
    boutiqueId: req.session.boutiqueId,
}));

app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

// ── 11. SOCKET.IO ─────────────────────────────────────
io.on("connection", (socket) => {
    console.log("🔌 Socket connecté :", socket.id);

    socket.on("join", (shop) => {
        if (shop && typeof shop === "string") {
            socket.join(shop);
            console.log(`👑 Socket room : ${shop}`);
        }
    });

    socket.on("disconnect", () => {
        console.log("🔌 Socket déconnecté :", socket.id);
    });
});

// ── 12. VÉRIFICATION ENV ──────────────────────────────
if (!CONFIG.AIRTABLE.API_KEY) console.error("❌ AIRTABLE_API_KEY manquante");
if (!CONFIG.AIRTABLE.BASE_ID) console.error("❌ AIRTABLE_BASE_ID manquant");
if (!CONFIG.GEMINI.API_KEY)   console.error("❌ GEMINI_API_KEY manquante");

app.get("/test-telegram", async (req, res) => {
    const telegram = require("./services/telegramService");
    const result   = await telegram.send("8276462482", "👑 SAMII OS — Test direct !");
    res.json(result);
});

// ── 13. SERVEUR ───────────────────────────────────────
server.listen(CONFIG.PORT, () => {
    console.log("✅ Airtable connecté");
    console.log("🚀 SAMII OS démarre...");
    console.log(`🚀 SAMII OS lancé sur ${CONFIG.PORT}`);
});
