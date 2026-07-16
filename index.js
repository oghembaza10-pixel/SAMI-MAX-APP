// ======================================================
// SAMII OS V1 — Point d'entrée
// ======================================================

// ── 1. CONFIG ─────────────────────────────────────────
const path    = require("path");
const express = require("express");
const CONFIG  = require("./config");

// ── 2. EXPRESS ────────────────────────────────────────
const app = express();

// ── 3. MIDDLEWARES ────────────────────────────────────
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ── 4. BOOTSTRAP ──────────────────────────────────────
const { registerChannels } = require("./kernel/bootstrap");
registerChannels();
const scheduler = require("./kernel/scheduler");

// ── 5. ROUTES ─────────────────────────────────────────
app.use(require("./Itinéraires/auth-meta"));
app.use(require("./Itinéraires/auth-shopify"));

app.use("/webhook",     require("./routes/webhook"));
app.use("/telegram",    require("./routes/telegram"));
app.use("/hub",         require("./routes/hub"));
app.use("/connect",     require("./routes/connect"));
app.use("/dashboard",   require("./routes/dashboard"));
app.use("/profile",     require("./routes/profile"));
app.use("/settings",    require("./routes/settings"));
app.use("/academy",     require("./routes/academy"));
app.use("/community",   require("./routes/community"));
app.use("/marketplace", require("./routes/marketplace"));
app.use("/drivers",     require("./routes/drivers"));
app.use("/login",       require("./routes/login"));
app.use("/register",    require("./routes/register"));
app.use("/api",         require("./routes/api"));

app.get("/", (req, res) => res.render("index"));
app.get("/samii", (req, res) => res.render("samii"));
app.get("/qg/:metier", (req, res) => res.render("qg-template", { metier: req.params.metier }));

// ── 6. VÉRIFICATION ENV ───────────────────────────────
if (!CONFIG.AIRTABLE.API_KEY) console.error("❌ AIRTABLE_API_KEY manquante");
if (!CONFIG.AIRTABLE.BASE_ID) console.error("❌ AIRTABLE_BASE_ID manquant");
if (!CONFIG.GEMINI.API_KEY)   console.error("❌ GEMINI_API_KEY manquante");

// ── 7. SERVEUR ────────────────────────────────────────
app.listen(CONFIG.PORT, () => {
    console.log("✅ Airtable connecté");
    console.log("🚀 SAMII OS démarre...");
    console.log(`🚀 SAMII OS lancé sur ${CONFIG.PORT}`);
});
