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
    res.locals.loggedIn = !!req.session?.email;
    next();
});

// ── AUTH MIDDLEWARE (pages admin seulement) ───────────
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

// ── EMAIL GATE — capture email → QG ──────────────────
app.post("/entrer", async (req, res) => {
    const email  = (req.body.email || "").trim().toLowerCase();
    const metier = req.body.metier || "ecommerce";

    if (!email || !email.includes("@")) {
        return res.redirect("/?erreur=email");
    }

    // Sauvegarder en session
    req.session.email  = email;
    req.session.metier = metier;

    // Sauvegarder dans Airtable (sans bloquer)
    try {
        const axios            = require("axios");
        const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
        const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
        const TABLE_USERS      = process.env.TABLE_USERS || "UTILISATEURS";
        const headers          = {
            Authorization : `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        };

        // Vérifier si déjà inscrit
        const check = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}` +
            `?filterByFormula={email}="${email}"`,
            { headers }
        );

        if (check.data.records.length === 0) {
            await axios.post(
                `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}`,
                { fields: {
                    email,
                    metier,
                    statut_acces: "en attente",
                    created_at  : new Date().toISOString(),
                }},
                { headers }
            );
            console.log(`✅ Nouvel email capturé : ${email}`);
        }
    } catch (err) {
        console.error("⚠️ Airtable email :", err.message);
        // On laisse passer quand même
    }

    res.redirect(`/qg/${metier}`);
});

// ── QG — accessible à tous (email requis) ─────────────
app.get("/qg/:metier", (req, res) => {
    // Si pas d'email → page de capture
    if (!req.session?.email) {
        return res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Accéder à votre QG — SAMII</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#0b0b0b; font-family:Arial; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:420px; background:#181818; padding:40px; border-radius:16px; border:1px solid #333; text-align:center; }
        .logo{ font-size:2.5rem; margin-bottom:10px; }
        h1{ color:#C5A059; font-size:1.6rem; margin-bottom:8px; }
        p{ color:#888; font-size:.95rem; margin-bottom:28px; line-height:1.6; }
        input{ width:100%; padding:14px; border:1px solid #333; border-radius:10px; background:#111; color:white; font-size:1rem; margin-bottom:14px; }
        input:focus{ outline:none; border-color:#C5A059; }
        button{ width:100%; padding:14px; background:#C5A059; border:none; border-radius:10px; font-weight:bold; font-size:1rem; cursor:pointer; color:#000; }
        button:hover{ opacity:.9; }
        small{ display:block; margin-top:16px; color:#555; font-size:.8rem; }
    </style>
</head>
<body>
<div class="box">
    <div class="logo">👑</div>
    <h1>Accéder à votre QG</h1>
    <p>Entrez votre email pour accéder à votre centre de commandement.<br>SAMII vous préviendra dès que votre QG est opérationnel.</p>
    <form method="POST" action="/entrer">
        <input type="hidden" name="metier" value="${req.params.metier}">
        <input type="email" name="email" placeholder="Votre adresse email" required autofocus>
        <button type="submit">👑 Accéder à mon QG</button>
    </form>
    <small>Aucun mot de passe requis · Gratuit · SAMII vous guide</small>
</div>
</body>
</html>`);
    }

    res.render("qg-template", {
        metier    : req.params.metier,
        shop      : req.session.shop      || "",
        boutiqueId: req.session.boutiqueId || "",
        nom       : req.session.nom       || "",
        attente   : true,
    });
});

// ── SAMII ─────────────────────────────────────────────
app.get("/samii", requireAuth, (req, res) => res.render("samii", {
    shop: req.session.shop || "",
}));

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
