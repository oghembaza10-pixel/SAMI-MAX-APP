// ======================================================
// SAMII OS V1 — Point d'entrée
// ======================================================

const path    = require("path");
const express = require("express");
const session = require("express-session");
const http    = require("http");
const { Server } = require("socket.io");
const CONFIG  = require("./config");

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
    cookie           : {
        httpOnly: true,
        sameSite: "lax",
        secure  : process.env.NODE_ENV === "production",
        maxAge  : 7 * 24 * 60 * 60 * 1000,
    },
}));

// ── LOCALS ────────────────────────────────────────────
app.use((req, res, next) => {
    res.locals.shop     = req.session?.shop    || null;
    res.locals.loggedIn = !!req.session?.loggedIn;
    next();
});

// ── AUTH MIDDLEWARE ───────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
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

// ── PAGE ACCUEIL ──────────────────────────────────────
app.get("/", (req, res) => res.render("index"));

// ── QG — accès direct après login ────────────────────
app.get("/qg/:metier", (req, res) => {
    if (!req.session?.loggedIn) return res.redirect("/login");

    // ✅ Query param prioritaire sur session
    const shop = req.query.shop || req.session.shop || "";

    res.render("qg-template", {
        metier    : req.params.metier,
        shop,
        boutiqueId: req.session.boutiqueId || "",
        nom       : req.session.nom        || "",
        attente   : false,
    });
});

app.get("/qg/:metier/connecter", requireAuth, async (req, res) => {
    // ✅ Query param prioritaire sur session
    const shop    = req.query.shop || req.session.shop || "";
    const headers = { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` };

    let boutique = {};
    try {
        const r = await require("axios").get(
            `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.TABLE_BOUTIQUES}`,
            { headers, params: { filterByFormula: `{shop_url}="${shop}"`, maxRecords: 1 } }
        );
        boutique = r.data.records[0]?.fields || {};
    } catch (e) { console.error("❌ /qg/connecter :", e.message); }

    res.render("connect/outils", {
        metier        : req.params.metier,
        shop,
        shopifyActif  : !!boutique.access_token,
        telegramActif : !!boutique.telegram_actif,
        telegramChatId: boutique.telegram_chat_id || "",
        whatsappActif : !!boutique.whatsapp_actif,
        whatsappPhone : boutique.whatsapp_phone   || "",
    });
});

// ── SAMII — accessible depuis le QG ──────────────────
app.get("/samii", (req, res) => {
    if (!req.session?.loggedIn) return res.redirect("/login");
    res.render("samii", {
        shop: req.query.shop || req.session.shop || "",
    });
});

// ── LOGOUT ────────────────────────────────────────────
app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

// ── SOCKET.IO ─────────────────────────────────────────
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


