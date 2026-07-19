// ======================================================
// SAMII OS — Connector Routes
// ======================================================
// Gestion des connexions outils par workspace.
// OAuth : Shopify, Meta (Facebook/Instagram)
// Simple : Telegram (bot)
// Bientôt : Google, Stripe, Discord, WhatsApp, etc.
// ======================================================

const express          = require("express");
const router           = express.Router();
const connectorService = require("../services/connectorService");
const workspaceService = require("../services/workspaceService");

// ── Auth middleware ───────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// ── Liste des outils ──────────────────────────────────
const TOOLS = [
    // ✅ Disponibles V1
    { id: "shopify",   label: "Shopify",            icon: "shopping-bag",   color: "#95BF47", available: true  },
    { id: "facebook",  label: "Facebook",           icon: "facebook",       color: "#1877F2", available: true  },
    { id: "instagram", label: "Instagram",          icon: "instagram",      color: "#E1306C", available: true  },
    { id: "telegram",  label: "Telegram",           icon: "send",           color: "#229ED9", available: true  },
    // ⏳ Bientôt disponibles
    { id: "whatsapp",  label: "WhatsApp Business",  icon: "message-circle", color: "#25D366", available: false },
    { id: "gmail",     label: "Gmail",              icon: "mail",           color: "#EA4335", available: false },
    { id: "google",    label: "Google",             icon: "chrome",         color: "#4285F4", available: false },
    { id: "stripe",    label: "Stripe",             icon: "credit-card",    color: "#635BFF", available: false },
    { id: "paypal",    label: "PayPal",             icon: "wallet",         color: "#00457C", available: false },
    { id: "discord",   label: "Discord",            icon: "message-square", color: "#5865F2", available: false },
    { id: "youtube",   label: "YouTube",            icon: "youtube",        color: "#FF0000", available: false },
    { id: "dahabia",   label: "Dahabia",            icon: "credit-card",    color: "#00A859", available: false },
    { id: "ccp",       label: "CCP",                icon: "landmark",       color: "#F5A623", available: false },
    { id: "autre",     label: "Autre outil",        icon: "plug",           color: "#718096", available: false },
];

// ── GET /connect/tools ────────────────────────────────
router.get("/tools", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");

        const workspace = await workspaceService.getById(workspaceId);
        if (!workspace) return res.redirect("/hub");

        const connecteurs = await connectorService.getByWorkspace(workspaceId);

        res.render("connect-tools", {
            workspaceId,
            nom       : workspace.nom || "",
            tools     : TOOLS,
            connecteurs,
            error     : null,
        });

    } catch (err) {
        console.error("❌ GET /connect/tools :", err);
        res.redirect("/hub");
    }
});

// ── GET /connect/shopify ──────────────────────────────
// Redirige vers l'OAuth Shopify existant
router.get("/shopify", requireAuth, (req, res) => {
    const shop = req.query.shop || req.session?.shop || "";
    if (!shop) {
        // Demander l'URL de la boutique
        return res.render("connect-shopify", {
            workspaceId : req.session?.workspaceId || "",
            error       : null,
        });
    }
    res.redirect(`/auth/shopify?shop=${encodeURIComponent(shop)}`);
});

// ── POST /connect/shopify ─────────────────────────────
router.post("/shopify", requireAuth, (req, res) => {
    const { shop } = req.body;
    if (!shop || !shop.trim()) {
        return res.render("connect-shopify", {
            workspaceId : req.session?.workspaceId || "",
            error       : "Entre l'URL de ta boutique Shopify.",
        });
    }
    let shopUrl = shop.trim().toLowerCase();
    if (!shopUrl.includes(".myshopify.com")) shopUrl += ".myshopify.com";
    res.redirect(`/auth/shopify?shop=${encodeURIComponent(shopUrl)}`);
});

// ── GET /connect/facebook ─────────────────────────────
router.get("/facebook", requireAuth, (req, res) => {
    res.redirect("/auth/meta");
});

// ── GET /connect/instagram ────────────────────────────
router.get("/instagram", requireAuth, (req, res) => {
    res.redirect("/auth/meta");
});

// ── GET /connect/telegram ─────────────────────────────
router.get("/telegram", requireAuth, (req, res) => {
    const workspaceId = req.session?.workspaceId || "";
    res.render("connect-telegram", { workspaceId, error: null });
});

// ── POST /connect/telegram ────────────────────────────
router.post("/telegram", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");

        const { chatId } = req.body;
        if (!chatId || !chatId.trim()) {
            return res.render("connect-telegram", {
                workspaceId,
                error: "Entre ton Chat ID Telegram.",
            });
        }

        await connectorService.save(workspaceId, "telegram", {
            chatId      : chatId.trim(),
            connectedAt : new Date().toISOString(),
        });

        res.redirect("/connect/tools");

    } catch (err) {
        console.error("❌ POST /connect/telegram :", err);
        res.render("connect-telegram", {
            workspaceId : req.session?.workspaceId || "",
            error       : "Erreur interne. Réessayez.",
        });
    }
});

// ── GET /connect/tools/continue → QG ─────────────────
router.get("/tools/continue", requireAuth, (req, res) => {
    if (!req.session?.workspaceId) return res.redirect("/hub");
    res.redirect("/qg");
});

// ── Routes "Bientôt disponible" ───────────────────────
const COMING_SOON = ["whatsapp", "gmail", "google", "stripe", "paypal", "discord", "youtube", "dahabia", "ccp", "autre"];

COMING_SOON.forEach(tool => {
    router.get(`/${tool}`, requireAuth, (req, res) => {
        res.render("connect-soon", {
            tool      : TOOLS.find(t => t.id === tool) || { label: tool, color: "#718096" },
            workspaceId: req.session?.workspaceId || "",
        });
    });
});

module.exports = router;
module.exports.TOOLS = TOOLS;
