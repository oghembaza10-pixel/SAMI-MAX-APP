// ======================================================
// SAMII OS — Connector Routes
// ======================================================
const express          = require("express");
const axios            = require("axios");
const router           = express.Router();
const connectorService = require("../services/connectorService");
const workspaceService = require("../services/workspaceService");
const db                = require("../services/db");
const CONFIG            = require("../config");
const abonnementService = require("../services/abonnementService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const TOOLS = [
    { id: "shopify",      label: "Shopify",              icon: "shopping-bag",   color: "#95BF47", available: true  },
    { id: "woocommerce",  label: "WooCommerce",          icon: "shopping-cart",  color: "#96588A", available: true  },
    { id: "facebook",     label: "Facebook",             icon: "facebook",       color: "#1877F2", available: true  },
    { id: "instagram",    label: "Instagram",            icon: "instagram",      color: "#E1306C", available: true  },
    { id: "telegram",     label: "Telegram",             icon: "send",           color: "#229ED9", available: true  },
    { id: "discord",      label: "Discord",               icon: "message-square", color: "#5865F2", available: true  },
    { id: "youtube",      label: "YouTube",               icon: "youtube",        color: "#FF0000", available: true, mode: "impression" },
    { id: "tiktok",       label: "TikTok",                 icon: "music",          color: "#010101", available: true, mode: "impression" },
    { id: "gmail",        label: "Gmail",                  icon: "mail",           color: "#EA4335", available: true, mode: "impression" },
    { id: "google",       label: "Google (Gmail, Agenda, Drive, YouTube)", icon: "chrome", color: "#4285F4", available: true },
    { id: "whatsapp",     label: "WhatsApp Business",      icon: "message-circle", color: "#25D366", available: true, mode: "transporteur", emoji: "💬", purpose: "pour recevoir tes messages et commandes clients" },
    { id: "linkedin",     label: "LinkedIn",               icon: "linkedin",       color: "#0A66C2", available: true, mode: "impression" },

    { id: "yalidine",     label: "Yalidine",               icon: "truck", color: "#F5A623", available: true, mode: "transporteur" },
    { id: "amana",        label: "Amana (Poste Maroc)",    icon: "truck", color: "#C8102E", available: true, mode: "transporteur" },
    { id: "ctm",          label: "CTM Maroc",              icon: "truck", color: "#004B87", available: true, mode: "transporteur" },
    { id: "dhl",          label: "DHL",                    icon: "truck", color: "#FFCC00", available: true, mode: "transporteur" },
    { id: "aramex",       label: "Aramex",                 icon: "truck", color: "#E4002B", available: true, mode: "transporteur" },
    { id: "colissimo",    label: "Colissimo (France)",     icon: "truck", color: "#FFCD00", available: true, mode: "transporteur" },
    { id: "chronopost",   label: "Chronopost",             icon: "truck", color: "#004B87", available: true, mode: "transporteur" },
    { id: "mondialrelay", label: "Mondial Relay",          icon: "truck", color: "#00A651", available: true, mode: "transporteur" },
    { id: "dpd",          label: "DPD",                    icon: "truck", color: "#DC0032", available: true, mode: "transporteur" },
    { id: "ups",          label: "UPS",                    icon: "truck", color: "#351C15", available: true, mode: "transporteur" },

    { id: "stripe",       label: "Stripe",                 icon: "credit-card",    color: "#635BFF", available: false },
    { id: "paypal",       label: "PayPal",                 icon: "wallet",         color: "#00457C", available: false },
    { id: "dahabia",      label: "Dahabia",                icon: "credit-card",    color: "#00A859", available: false },
    { id: "ccp",          label: "CCP (Algérie Poste)",    icon: "landmark",       color: "#F5A623", available: true  },
    { id: "autre",        label: "Autre outil",            icon: "plug",           color: "#718096", available: false },
];

// ── PAGE PRINCIPALE — liste de tous les outils ────────
router.get("/tools", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");
        const workspace = await workspaceService.getById(workspaceId);
        if (!workspace) return res.redirect("/hub");
        const connecteurs = await connectorService.getByWorkspace(workspaceId);
        // La vraie connexion Shopify (routes/auth-shopify.js, installation de
        // l'app via OAuth) écrit directement sur workspaces.shopify_shop_url —
        // jamais dans `connecteurs`, contrairement à toutes les autres cartes
        // de cette page. Sans ça, la carte Shopify affichait "non connecté"
        // même quand la boutique était réellement connectée et recevait des
        // commandes (le badge se basait uniquement sur `connecteurs`).
        const shopifyRows = await db.query(`SELECT shopify_shop_url FROM workspaces WHERE id = $1`, [workspaceId]);
        const shopifyShopUrl = shopifyRows[0]?.shopify_shop_url || "";
        res.render("connect-tools", {
            workspaceId,
            nom: workspace.nom || "",
            tools: TOOLS,
            connecteurs,
            shopifyShopUrl,
            error: null,
            from: req.query.from || "qg",
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
        // Un quota de canaux atteint n'est pas une panne : le marchand doit
        // lire la vraie raison, sinon il croit que l'outil est cassé.
        if (err.code === "QUOTA_CANAUX") return res.json({ success: false, error: err.message, quota: true });
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

// ── SHOPIFY ────────────────────────────────────────────
router.get("/shopify", requireAuth, (req, res) => {
    const shop = req.query.shop || req.session?.shop || "";
    res.render("connect-shopify", {
        workspaceId: req.session?.workspaceId || "",
        shop,
        error: null,
    });
});

// ── FACEBOOK / INSTAGRAM (via Meta OAuth) ──────────────
router.get("/facebook", requireAuth, (req, res) => {
    res.redirect("/auth/meta");
});
router.get("/instagram", requireAuth, (req, res) => {
    res.redirect("/auth/meta");
});

// ── GOOGLE (Gmail / Calendar / Drive / YouTube, via OAuth) ─────────────
router.get("/google", requireAuth, (req, res) => {
    res.redirect("/auth/google");
});

// ── TELEGRAM ────────────────────────────────────────────
async function getTelegramBotState(workspaceId) {
    let botUsername = "";
    let botActif = false;
    if (workspaceId) {
        try {
            const connecteurs = await connectorService.getByWorkspace(workspaceId);
            const bot = connecteurs.find(c => c.type === "telegram_bot");
            if (bot) {
                botUsername = bot.config?.botUsername || "";
                botActif = bot.actif === true;
            }
        } catch (err) {
            console.error("❌ getTelegramBotState :", err.message);
        }
    }
    return { botUsername, botActif };
}

router.get("/telegram", requireAuth, async (req, res) => {
    const workspaceId = req.session?.workspaceId || "";
    let telegramChatId = "";
    let telegramActif = false;
    try {
        if (workspaceId) {
            const connecteurs = await connectorService.getByWorkspace(workspaceId);
            const tg = connecteurs.find(c => c.type === "telegram");
            if (tg) {
                telegramChatId = tg.config?.chatId || tg.config?.identifiant || "";
                telegramActif = tg.actif === true;
            }
        }
    } catch (err) {
        console.error("❌ GET /connect/telegram (lecture) :", err.message);
    }
    const { botUsername, botActif } = await getTelegramBotState(workspaceId);
    res.render("connect-telegram", {
        workspaceId,
        shop: req.session?.shop || "",
        telegramChatId,
        telegramActif,
        botUsername,
        botActif,
        error: null,
    });
});

router.post("/telegram", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");
        const chatId = req.body.telegram_chat_id;
        const actif = req.body.telegram_actif === "true";
        const botState = await getTelegramBotState(workspaceId);
        if (!chatId || !chatId.trim()) {
            return res.render("connect-telegram", {
                workspaceId,
                shop: req.session?.shop || "",
                telegramChatId: "",
                telegramActif: false,
                ...botState,
                error: "Entre ton Chat ID Telegram.",
            });
        }
        await connectorService.save(workspaceId, "telegram", {
            chatId: chatId.trim(),
            actif,
            connectedAt: new Date().toISOString(),
        });
        res.render("connect-telegram", {
            workspaceId,
            shop: req.session?.shop || "",
            telegramChatId: chatId.trim(),
            telegramActif: actif,
            ...botState,
            error: null,
        });
    } catch (err) {
        if (err.code !== "QUOTA_CANAUX") console.error("❌ POST /connect/telegram :", err);
        res.render("connect-telegram", {
            workspaceId: req.session?.workspaceId || "",
            shop: req.session?.shop || "",
            telegramChatId: "",
            telegramActif: false,
            botUsername: "",
            botActif: false,
            error: err.code === "QUOTA_CANAUX" ? err.message : "Erreur interne. Réessayez.",
        });
    }
});

// ── TELEGRAM — bot perso du marchand (mêmes principes que WhatsApp) ──────
// Le marchand crée son propre bot via @BotFather, colle le token ici : on
// valide le token (getMe), on enregistre le webhook Telegram dédié
// (setWebhook → /telegram/<workspaceId>), puis on stocke le token. Ses
// clients lui parlent désormais sous SA PROPRE identité de bot.
router.post("/telegram/bot", requireAuth, async (req, res) => {
    const workspaceId = req.session?.workspaceId;
    if (!workspaceId) return res.redirect("/hub");
    const botToken = (req.body.bot_token || "").trim();
    const chatState = { telegramChatId: "", telegramActif: false };
    try {
        const tgRows = await connectorService.getByWorkspace(workspaceId);
        const tg = tgRows.find(c => c.type === "telegram");
        if (tg) {
            chatState.telegramChatId = tg.config?.chatId || "";
            chatState.telegramActif = tg.actif === true;
        }

        if (!botToken) {
            return res.render("connect-telegram", {
                workspaceId, shop: req.session?.shop || "", ...chatState,
                botUsername: "", botActif: false,
                error: "Colle le token de ton bot Telegram.",
            });
        }

        const meRes = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
        if (!meRes.data?.ok) throw new Error("Token invalide");
        const botUsername = meRes.data.result.username;

        const webhookUrl = `${CONFIG.APP_URL}/telegram/${workspaceId}`;
        await axios.get(`https://api.telegram.org/bot${botToken}/setWebhook`, { params: { url: webhookUrl } });

        await connectorService.save(workspaceId, "telegram_bot", {
            botToken, botUsername, connectedAt: new Date().toISOString(),
        });

        return res.render("connect-telegram", {
            workspaceId, shop: req.session?.shop || "", ...chatState,
            botUsername, botActif: true, error: null,
        });
    } catch (err) {
        console.error("❌ POST /connect/telegram/bot :", err.response?.data || err.message);
        return res.render("connect-telegram", {
            workspaceId, shop: req.session?.shop || "", ...chatState,
            botUsername: "", botActif: false,
            error: "Token invalide ou erreur Telegram. Vérifie le token collé depuis @BotFather.",
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
        const botToken = (req.body.bot_token || "").trim();
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
        res.render("connect-discord", {
            workspaceId,
            discordActif: true,
            discordLabel: serverName,
            error: null,
        });
    } catch (err) {
        console.error("❌ POST /connect/discord :", err);
        res.render("connect-discord", {
            workspaceId: req.session?.workspaceId || "",
            discordActif: false,
            discordLabel: "",
            error: "Erreur interne. Réessaie.",
        });
    }
});

// ── TRANSPORTEURS — le marchand entre SA PROPRE clé API ──
// Yalidine + tous les nouveaux transporteurs marocains/africains/européens,
// gérés par une seule boucle générique (identifiant + clé API).
const TRANSPORTEUR_TOOLS = [
    "yalidine", "amana", "ctm", "dhl", "aramex",
    "colissimo", "chronopost", "mondialrelay", "dpd", "ups",
];

TRANSPORTEUR_TOOLS.forEach(toolId => {
    router.get(`/${toolId}`, requireAuth, async (req, res) => {
        const workspaceId = req.session?.workspaceId || "";
        let actif = false;
        let apiId = "";
        try {
            if (workspaceId) {
                const connecteurs = await connectorService.getByWorkspace(workspaceId);
                const c = connecteurs.find(x => x.type === toolId);
                if (c) {
                    actif = c.actif === true;
                    apiId = c.config?.apiId || "";
                }
            }
        } catch (err) {
            console.error(`❌ GET /connect/${toolId} (lecture) :`, err.message);
        }
        res.render("connect-transporteur", {
            workspaceId,
            tool: TOOLS.find(t => t.id === toolId),
            actif,
            apiId,
            error: null,
        });
    });

    router.post(`/${toolId}`, requireAuth, async (req, res) => {
        try {
            const workspaceId = req.session?.workspaceId;
            if (!workspaceId) return res.redirect("/hub");
            const apiId = (req.body.api_id || "").trim();
            const apiToken = (req.body.api_token || "").trim();
            if (!apiId || !apiToken) {
                return res.render("connect-transporteur", {
                    workspaceId,
                    tool: TOOLS.find(t => t.id === toolId),
                    actif: false,
                    apiId: "",
                    error: "Renseigne ton identifiant et ta clé API.",
                });
            }
            await connectorService.save(workspaceId, toolId, {
                apiId,
                apiToken,
                connectedAt: new Date().toISOString(),
            });
            return res.render("connect-transporteur", {
                workspaceId,
                tool: TOOLS.find(t => t.id === toolId),
                actif: true,
                apiId,
                error: null,
            });
        } catch (err) {
            console.error(`❌ POST /connect/${toolId} :`, err);
            res.render("connect-transporteur", {
                workspaceId: req.session?.workspaceId || "",
                tool: TOOLS.find(t => t.id === toolId),
                actif: false,
                apiId: "",
                error: "Erreur interne. Réessaie.",
            });
        }
    });
});

// ── WHATSAPP — cas particulier : deux façons de démarrer ──────────────────
// 1) Dépannage : le marchand utilise le numéro partagé SAMII, 3 jours, une
//    seule fois (pas un palier gratuit renouvelable — sinon tout le monde y
//    reste et le numéro partagé prend un volume dangereux, voir
//    services/whatsapp.js). 2) Connexion perso Green API (identique aux
//    transporteurs, mais nécessite sa propre vue avec les deux options
//    présentées ensemble.
const DEPANNAGE_DUREE_MS = 3 * 24 * 60 * 60 * 1000;

// WhatsApp est un canal payant, Telegram non. Un numéro WhatsApp coûte cher à
// tenir (instance Green API dédiée, support, risque de blocage Meta) et c'est
// la première chose qu'un marchand vient chercher : c'est donc le levier du
// palier Actif, annoncé comme tel sur la page d'accueil et sur /billing. Le
// dépannage 3 jours reste ouvert au palier gratuit — c'est l'essai, pas le
// service. Sans ce contrôle, la page promettrait un palier et le produit en
// donnerait un autre.
const PALIER_MINIMUM_WHATSAPP = "standard";

function depannageState(config) {
    if (!config || config.mode !== "depannage") {
        return config?.depannageUsedAt ? { dejaUtilise: true, active: false, joursRestants: 0 } : null;
    }
    const expiresAt = config.expiresAt ? new Date(config.expiresAt).getTime() : 0;
    const restant = expiresAt - Date.now();
    return {
        dejaUtilise: true,
        active: restant > 0,
        joursRestants: Math.max(0, Math.ceil(restant / (24 * 60 * 60 * 1000))),
    };
}

router.get("/whatsapp", requireAuth, async (req, res) => {
    const workspaceId = req.session?.workspaceId || "";
    let actif = false;
    let apiId = "";
    let depannage = null;
    try {
        if (workspaceId) {
            const c = await connectorService.getOne(workspaceId, "whatsapp");
            if (c) {
                apiId = c.config?.apiId || "";
                actif = c.actif === true && !!apiId;
                depannage = depannageState(c.config);
            }
        }
    } catch (err) {
        console.error("❌ GET /connect/whatsapp (lecture) :", err.message);
    }
    const palierOk = await abonnementService.auMoins(workspaceId, PALIER_MINIMUM_WHATSAPP);
    res.render("connect-whatsapp", {
        workspaceId,
        tool: TOOLS.find(t => t.id === "whatsapp"),
        actif,
        apiId,
        depannage,
        palierOk,
        error: null,
    });
});

router.post("/whatsapp", requireAuth, async (req, res) => {
    const workspaceId = req.session?.workspaceId;
    if (!workspaceId) return res.redirect("/hub");
    try {
        const palierOk = await abonnementService.auMoins(workspaceId, PALIER_MINIMUM_WHATSAPP);
        if (!palierOk) {
            const c = await connectorService.getOne(workspaceId, "whatsapp");
            return res.render("connect-whatsapp", {
                workspaceId,
                tool: TOOLS.find(t => t.id === "whatsapp"),
                actif: false,
                apiId: "",
                depannage: depannageState(c?.config),
                palierOk: false,
                error: "WhatsApp est inclus à partir du palier Actif. Telegram reste disponible sans abonnement.",
            });
        }
        const apiId = (req.body.api_id || "").trim();
        const apiToken = (req.body.api_token || "").trim();
        if (!apiId || !apiToken) {
            const c = await connectorService.getOne(workspaceId, "whatsapp");
            return res.render("connect-whatsapp", {
                workspaceId,
                tool: TOOLS.find(t => t.id === "whatsapp"),
                actif: false,
                apiId: "",
                depannage: depannageState(c?.config),
                palierOk: true,
                error: "Renseigne ton ID API et ton Token API.",
            });
        }
        await connectorService.save(workspaceId, "whatsapp", {
            apiId, apiToken, connectedAt: new Date().toISOString(),
        });
        return res.render("connect-whatsapp", {
            workspaceId,
            tool: TOOLS.find(t => t.id === "whatsapp"),
            actif: true,
            apiId,
            depannage: null,
            palierOk: true,
            error: null,
        });
    } catch (err) {
        console.error("❌ POST /connect/whatsapp :", err);
        res.render("connect-whatsapp", {
            workspaceId,
            tool: TOOLS.find(t => t.id === "whatsapp"),
            actif: false,
            apiId: "",
            depannage: null,
            palierOk: true,
            error: "Erreur interne. Réessaie.",
        });
    }
});

router.post("/whatsapp/depannage", requireAuth, async (req, res) => {
    const workspaceId = req.session?.workspaceId;
    if (!workspaceId) return res.redirect("/hub");
    try {
        const existing = await connectorService.getOne(workspaceId, "whatsapp");
        if (existing?.config?.depannageUsedAt) {
            return res.redirect("/connect/whatsapp");
        }
        const now = new Date();
        await connectorService.save(workspaceId, "whatsapp", {
            mode: "depannage",
            depannageUsedAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + DEPANNAGE_DUREE_MS).toISOString(),
            warned: false,
        });
        return res.redirect("/connect/whatsapp");
    } catch (err) {
        console.error("❌ POST /connect/whatsapp/depannage :", err);
        res.redirect("/connect/whatsapp");
    }
});

// ── MODE IMPRESSION — YouTube, TikTok, Gmail, Google, WhatsApp, LinkedIn ──
// Pas de vraie API branchée : le client colle un identifiant simple,
// juste pour l'affichage "connecté" en attendant les permissions officielles.
const IMPRESSION_TOOLS = ["youtube", "tiktok", "gmail", "linkedin"];
const IMPRESSION_FIELD_LABEL = {
    youtube: "Lien ou @pseudo de ta chaîne YouTube",
    tiktok: "@pseudo TikTok",
    gmail: "Adresse Gmail",
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

// ── CONTINUER APRÈS CONNEXION ──────────────────────────
router.get("/tools/continue", requireAuth, (req, res) => {
    if (!req.session?.workspaceId) return res.redirect("/hub");
    const destinations = { hub: "/hub", qg: "/qg", samii: "/samii" };
    const destination = destinations[req.query.from] || "/qg";
    res.redirect(destination);
});

// ── CCP (Algérie Poste) — affichage compte, confirmation manuelle ──
router.get("/ccp", requireAuth, async (req, res) => {
    const workspaceId = req.session?.workspaceId || "";
    let ccpActif = false, ccpTitulaire = "", ccpNumero = "", ccpCle = "";
    try {
        if (workspaceId) {
            const connecteurs = await connectorService.getByWorkspace(workspaceId);
            const c = connecteurs.find(c => c.type === "ccp");
            if (c) {
                ccpActif = c.actif === true;
                ccpTitulaire = c.config?.titulaire || "";
                ccpNumero = c.config?.numero || "";
                ccpCle = c.config?.cle || "";
            }
        }
    } catch (err) {
        console.error("❌ GET /connect/ccp (lecture) :", err.message);
    }
    res.render("connect-ccp", { workspaceId, ccpActif, ccpTitulaire, ccpNumero, ccpCle, error: null });
});

router.post("/ccp", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");
        const titulaire = (req.body.titulaire || "").trim();
        const numero = (req.body.numero || "").trim();
        const cle = (req.body.cle || "").trim();
        if (!titulaire || !numero) {
            return res.render("connect-ccp", {
                workspaceId, ccpActif: false, ccpTitulaire: "", ccpNumero: "", ccpCle: "",
                error: "Renseigne au moins le titulaire et le numéro de compte.",
            });
        }
        await connectorService.save(workspaceId, "ccp", {
            titulaire, numero, cle,
            connectedAt: new Date().toISOString(),
        });
        res.render("connect-ccp", { workspaceId, ccpActif: true, ccpTitulaire: titulaire, ccpNumero: numero, ccpCle: cle, error: null });
    } catch (err) {
        console.error("❌ POST /connect/ccp :", err);
        res.render("connect-ccp", {
            workspaceId: req.session?.workspaceId || "",
            ccpActif: false, ccpTitulaire: "", ccpNumero: "", ccpCle: "",
            error: "Erreur interne. Réessaie.",
        });
    }
});

// ── BIENTÔT DISPONIBLE ──────────────────────────────────
const COMING_SOON = ["stripe", "paypal", "dahabia", "autre"];
COMING_SOON.forEach(tool => {
    router.get(`/${tool}`, requireAuth, (req, res) => {
        res.render("connect-soon", {
            tool: TOOLS.find(t => t.id === tool) || { label: tool, color: "#718096" },
            workspaceId: req.session?.workspaceId || "",
        });
    });
});

module.exports = router;
module.exports.TOOLS = TOOLS;
