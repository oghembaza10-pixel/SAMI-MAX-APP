// ======================================================
// SAMII OS — Connector Routes
// ======================================================
const express          = require("express");
const router           = express.Router();
const connectorService = require("../services/connectorService");
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const TOOLS = [
    { id: "shopify",   label: "Shopify",           icon: "shopping-bag",   color: "#95BF47", available: true  },
    { id: "woocommerce", label: "WooCommerce",      icon: "shopping-cart",  color: "#96588A", available: true }, 
    { id: "facebook",  label: "Facebook",          icon: "facebook",       color: "#1877F2", available: true  },
    { id: "instagram", label: "Instagram",         icon: "instagram",      color: "#E1306C", available: true  },
    { id: "telegram",  label: "Telegram",          icon: "send",           color: "#229ED9", available: true  },
    { id: "discord",   label: "Discord",           icon: "message-square", color: "#5865F2", available: true  },
    { id: "youtube",   label: "YouTube",           icon: "youtube",        color: "#FF0000", available: true, mode: "impression" },
    { id: "tiktok",    label: "TikTok",            icon: "music",          color: "#010101", available: true, mode: "impression" },
    { id: "gmail",     label: "Gmail",             icon: "mail",           color: "#EA4335", available: true, mode: "impression" },
    { id: "google",    label: "Google",            icon: "chrome",         color: "#4285F4", available: true, mode: "impression" },
    { id: "whatsapp",  label: "WhatsApp Business", icon: "message-circle", color: "#25D366", available: true, mode: "impression" },
    { id: "linkedin",  label: "LinkedIn",          icon: "linkedin",       color: "#0A66C2", available: true, mode: "impression" },
    { id: "yalidine", label: "Yalidine", icon: "truck", color: "#F5A623", available: true, mode: "transporteur" },
    { id: "stripe",    label: "Stripe",            icon: "credit-card",    color: "#635BFF", available: false },
    { id: "paypal",    label: "PayPal",            icon: "wallet",         color: "#00457C", available: false },
    { id: "dahabia",   label: "Dahabia",           icon: "credit-card",    color: "#00A859", available: false },
    { id: "ccp",       label: "CCP",               icon: "landmark",       color: "#F5A623", available: false },
    { id: "autre",     label: "Autre outil",       icon: "plug",           color: "#718096", available: false },
];

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

router.post("/tools/save", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.json({ success: false, error: "Session expirée." });
        const { toolId, value } = req.body;
        if (!toolId) return res.json({ success: false, error: "Outil manquant." });
        const result = await connectorService.save(workspaceId, toolId, value || {});
        if (!result) return res.json({ success: false, error: "Erreur Airtable." });
        res.json({ success: true, toolId, connected: true });
    } catch (err) {
        console.error("❌ POST /connect/tools/save :", err);
        res.json({ success: false, error: "Erreur interne." });
    }
});

router.post("/tools/disconnect", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.json({ success: false, error: "Session expirée." });
        const { toolId } = req.body;
        if (!toolId) return res.json({ success: false, error: "Outil manquant." });
        const result = await connectorService.disconnect(workspaceId, toolId);
        if (!result) return res.json({ success: false, error: "Connecteur introuvable." });
        res.json({ success: true, toolId, connected: false });
    } catch (err) {
        console.error("❌ POST /connect/tools/disconnect :", err);
        res.json({ success: false, error: "Erreur interne." });
    }
});

router.get("/shopify", requireAuth, (req, res) => {
    const shop = req.query.shop || req.session?.shop || "";
    if (!shop) {
        return res.render("connect-shopify", {
            workspaceId : req.session?.workspaceId || "",
            error       : null,
        });
    }
    res.redirect(`/auth/shopify?shop=${encodeURIComponent(shop)}`);
});

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

router.get("/facebook", requireAuth, (req, res) => {
    res.redirect("/auth/meta");
});

router.get("/instagram", requireAuth, (req, res) => {
    res.redirect("/auth/meta");
});

router.get("/telegram", requireAuth, async (req, res) => {
    const workspaceId = req.session?.workspaceId || "";
    let telegramChatId = "";
    let telegramActif  = false;

    try {
        if (workspaceId) {
            const connecteurs = await connectorService.getByWorkspace(workspaceId);
            const tg = connecteurs?.telegram;
            if (tg) {
                telegramChatId = tg.chatId || tg.identifiant || "";
                telegramActif  = tg.actif === true;
            }
        }
    } catch (err) {
        console.error("❌ GET /connect/telegram (lecture) :", err.message);
    }

    res.render("connect-telegram", {
        workspaceId,
        shop           : req.session?.shop || "",
        telegramChatId,
        telegramActif,
        error          : null,
    });
});

router.post("/telegram", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");

        const chatId = req.body.telegram_chat_id;
        const actif  = req.body.telegram_actif === "true";

        if (!chatId || !chatId.trim()) {
            return res.render("connect-telegram", {
                workspaceId,
                shop           : req.session?.shop || "",
                telegramChatId : "",
                telegramActif  : false,
                error          : "Entre ton Chat ID Telegram.",
            });
        }

        await connectorService.save(workspaceId, "telegram", {
            chatId      : chatId.trim(),
            actif,
            connectedAt : new Date().toISOString(),
        });

        res.redirect("/connect/tools");
    } catch (err) {
        console.error("❌ POST /connect/telegram :", err);
        res.render("connect-telegram", {
            workspaceId    : req.session?.workspaceId || "",
            shop           : req.session?.shop || "",
            telegramChatId : "",
            telegramActif  : false,
            error          : "Erreur interne. Réessayez.",
        });
    }
});

// ── DISCORD — vraie connexion (token de bot collé par le client) ──
router.get("/discord", requireAuth, async (req, res) => {
    const workspaceId = req.session?.workspaceId || "";
    let discordActif = false;
    let discordLabel = "";

    try {
        if (workspaceId) {
            const connecteurs = await connectorService.getByWorkspace(workspaceId);
            const dc = connecteurs.find(c => c.type === "discord");
            if (dc) {
                discordActif = dc.actif === true;
                discordLabel = dc.config?.serverName || "";
            }
        }
    } catch (err) {
        console.error("❌ GET /connect/discord (lecture) :", err.message);
    }

    res.render("connect-discord", {
        workspaceId,
        discordActif,
        discordLabel,
        error: null,
    });
});

router.post("/discord", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");

        const botToken   = (req.body.bot_token || "").trim();
        const serverName = (req.body.server_name || "").trim();

        if (!botToken) {
            return res.render("connect-discord", {
                workspaceId,
                discordActif: false,
                discordLabel: "",
                error: "Colle le token de ton bot Discord.",
            });
        }

        await connectorService.save(workspaceId, "discord", {
            botToken,
            serverName,
            connectedAt: new Date().toISOString(),
        });

        return res.render("connect-discord", {
            workspaceId,
            discordActif: true,
            discordLabel: serverName,
            error: null,
        });
    } catch (err) {
        console.error("❌ POST /connect/discord :", err);
        res.render("connect-discord", {
            workspaceId : req.session?.workspaceId || "",
            discordActif: false,
            discordLabel: "",
            error       : "Erreur interne. Réessaie.",
        });
    }
});
// ── TRANSPORTEURS — clé API perso (optionnel, sinon clé globale OG Empire) ──
router.get("/yalidine", requireAuth, async (req, res) => {
    const workspaceId = req.session?.workspaceId || "";
    let actif = false;
    let apiId = "";

    try {
        if (workspaceId) {
            const connecteurs = await connectorService.getByWorkspace(workspaceId);
            const c = connecteurs.find(x => x.type === "yalidine");
            if (c) {
                actif = c.actif === true;
                apiId = c.config?.apiId || "";
            }
        }
    } catch (err) {
        console.error("❌ GET /connect/yalidine (lecture) :", err.message);
    }

    res.render("connect-transporteur", {
        workspaceId,
        tool: TOOLS.find(t => t.id === "yalidine"),
        actif,
        apiId,
        error: null,
    });
});

router.post("/yalidine", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");

        const apiId    = (req.body.api_id || "").trim();
        const apiToken = (req.body.api_token || "").trim();

        if (!apiId || !apiToken) {
            return res.render("connect-transporteur", {
                workspaceId,
                tool: TOOLS.find(t => t.id === "yalidine"),
                actif: false,
                apiId: "",
                error: "Les deux champs (ID et Token) sont requis.",
            });
        }

        await connectorService.save(workspaceId, "yalidine", {
            apiId,
            apiToken,
            connectedAt: new Date().toISOString(),
        });

        return res.render("connect-transporteur", {
            workspaceId,
            tool: TOOLS.find(t => t.id === "yalidine"),
            actif: true,
            apiId,
            error: null,
        });
    } catch (err) {
        console.error("❌ POST /connect/yalidine :", err);
        res.render("connect-transporteur", {
            workspaceId: req.session?.workspaceId || "",
            tool: TOOLS.find(t => t.id === "yalidine"),
            actif: false,
            apiId: "",
            error: "Erreur interne. Réessaie.",
        });
    }
});
// ── MODE IMPRESSION — YouTube, TikTok, Gmail, Google, WhatsApp, LinkedIn ──
// Pas de vraie API branchée : le client colle un identifiant simple,
// juste pour l'affichage "connecté" en attendant les permissions officielles.
const IMPRESSION_TOOLS = ["youtube", "tiktok", "gmail", "google", "whatsapp", "linkedin"];

const IMPRESSION_FIELD_LABEL = {
    youtube : "Lien ou @pseudo de ta chaîne YouTube",
    tiktok  : "@pseudo TikTok",
    gmail   : "Adresse Gmail",
    google  : "Adresse Gmail liée à Google",
    whatsapp: "Numéro WhatsApp Business",
    linkedin: "Lien de ton profil ou page LinkedIn",
};

IMPRESSION_TOOLS.forEach(toolId => {
    router.get(`/${toolId}`, requireAuth, async (req, res) => {
        const workspaceId = req.session?.workspaceId || "";
        let actif = false;
        let identifiant = "";

        try {
            if (workspaceId) {
                const connecteurs = await connectorService.getByWorkspace(workspaceId);
                const c = connecteurs.find(x => x.type === toolId);
                if (c) {
                    actif = c.actif === true;
                    identifiant = c.config?.identifiant || "";
                }
            }
        } catch (err) {
            console.error(`❌ GET /connect/${toolId} (lecture) :`, err.message);
        }

        res.render("connect-impression", {
            workspaceId,
            tool: TOOLS.find(t => t.id === toolId),
            fieldLabel: IMPRESSION_FIELD_LABEL[toolId],
            actif,
            identifiant,
            error: null,
        });
    });

    router.post(`/${toolId}`, requireAuth, async (req, res) => {
        try {
            const workspaceId = req.session?.workspaceId;
            if (!workspaceId) return res.redirect("/hub");

            const identifiant = (req.body.identifiant || "").trim();

            if (!identifiant) {
                return res.render("connect-impression", {
                    workspaceId,
                    tool: TOOLS.find(t => t.id === toolId),
                    fieldLabel: IMPRESSION_FIELD_LABEL[toolId],
                    actif: false,
                    identifiant: "",
                    error: "Ce champ est requis.",
                });
            }

            await connectorService.save(workspaceId, toolId, {
                identifiant,
                mode: "impression",
                connectedAt: new Date().toISOString(),
            });

            return res.render("connect-impression", {
                workspaceId,
                tool: TOOLS.find(t => t.id === toolId),
                fieldLabel: IMPRESSION_FIELD_LABEL[toolId],
                actif: true,
                identifiant,
                error: null,
            });
        } catch (err) {
            console.error(`❌ POST /connect/${toolId} :`, err);
            res.render("connect-impression", {
                workspaceId: req.session?.workspaceId || "",
                tool: TOOLS.find(t => t.id === toolId),
                fieldLabel: IMPRESSION_FIELD_LABEL[toolId],
                actif: false,
                identifiant: "",
                error: "Erreur interne. Réessaie.",
            });
        }
    });
});

router.get("/tools/continue", requireAuth, (req, res) => {
    if (!req.session?.workspaceId) return res.redirect("/hub");
    res.redirect("/qg");
});

const COMING_SOON = ["stripe", "paypal", "dahabia", "ccp", "autre"];
COMING_SOON.forEach(tool => {
    router.get(`/${tool}`, requireAuth, (req, res) => {
        res.render("connect-soon", {
            tool       : TOOLS.find(t => t.id === tool) || { label: tool, color: "#718096" },
            workspaceId: req.session?.workspaceId || "",
        });
    });
});

module.exports = router;
module.exports.TOOLS = TOOLS;
