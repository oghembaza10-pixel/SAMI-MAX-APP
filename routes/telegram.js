// ==========================================================================
// SAMII OS — TELEGRAM WEBHOOK — V3 Universel (tous métiers, multi-langue)
// ==========================================================================
const express      = require("express");
const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");
const planner      = require("../brain/planner");
const memory       = require("../brain/memory");
const db           = require("../services/db");
const socketService = require("../services/socketService");

const router = express.Router();
const TOKEN  = CONFIG.TELEGRAM.BOT_TOKEN;
const BASE   = `https://api.telegram.org/bot${TOKEN}`;

// ── MULTI-LANGUE ───────────────────────────────────────────────
const LANGUES_SUPPORTEES = ["fr", "en", "ar"];

function detecterLangue(message) {
    const code = (message?.from?.language_code || "fr").toLowerCase().slice(0, 2);
    return LANGUES_SUPPORTEES.includes(code) ? code : "fr";
}

const T = {
    fr: {
        bienvenueClient: "👑 *Bienvenue !*\n\nJe suis SAMII, votre Bras droit. Comment puis-je vous aider aujourd'hui ?",
        bienvenueGenerique: (chatId) => `👑 *Bienvenue sur SAMII OS !*\n\n✅ Chat ID : \`${chatId}\`\n\nJe suis SAMII, votre Bras droit. Comment puis-je vous aider ?`,
        adminConnecte: "✅ *Telegram connecté à ton QG !*\n\nTu recevras désormais toutes tes commandes/rendez-vous ici directement. 👑",
        adminErreur: "❌ Erreur de connexion. Réessaie depuis ton QG.",
        rdvConfirme: (id) => `✅ *Rendez-vous #${id} confirmé !*\n\nÀ bientôt 🙏`,
        rdvAnnule: (id) => `❌ *Rendez-vous #${id} annulé.*\n\nSi c'est une erreur, répondez-nous 😊`,
        commandeConfirmee: (id) => `✅ *Commande #${id} confirmée !*\n\nNous préparons le colis 📦\nMerci de votre confiance 🙏`,
        commandeAnnuleeId: (id) => `❌ *Commande #${id} annulée.*\n\nSi c'est une erreur, répondez-nous 😊`,
        idChat: (chatId) => `🆔 Chat ID : \`${chatId}\``,
    },
    en: {
        bienvenueClient: "👑 *Welcome!*\n\nI'm SAMII, your assistant. How can I help you today?",
        bienvenueGenerique: (chatId) => `👑 *Welcome to SAMII OS!*\n\n✅ Chat ID: \`${chatId}\`\n\nI'm SAMII, your assistant. How can I help?`,
        adminConnecte: "✅ *Telegram connected to your QG!*\n\nYou'll now receive all your orders/appointments here directly. 👑",
        adminErreur: "❌ Connection error. Try again from your QG.",
        rdvConfirme: (id) => `✅ *Appointment #${id} confirmed!*\n\nSee you soon 🙏`,
        rdvAnnule: (id) => `❌ *Appointment #${id} cancelled.*\n\nIf this is a mistake, reply to us 😊`,
        commandeConfirmee: (id) => `✅ *Order #${id} confirmed!*\n\nWe're preparing your package 📦\nThank you for your trust 🙏`,
        commandeAnnuleeId: (id) => `❌ *Order #${id} cancelled.*\n\nIf this is a mistake, reply to us 😊`,
        idChat: (chatId) => `🆔 Chat ID: \`${chatId}\``,
    },
    ar: {
        bienvenueClient: "👑 *مرحباً!*\n\nأنا سامي، مساعدك. كيف يمكنني مساعدتك اليوم؟",
        bienvenueGenerique: (chatId) => `👑 *مرحباً بك في SAMII OS!*\n\n✅ Chat ID: \`${chatId}\`\n\nأنا سامي، مساعدك. كيف يمكنني مساعدتك؟`,
        adminConnecte: "✅ *تم ربط تيليجرام بمركز قيادتك!*\n\nستستقبل الآن جميع طلباتك ومواعيدك هنا مباشرة. 👑",
        adminErreur: "❌ خطأ في الاتصال. حاول مرة أخرى من مركز القيادة.",
        rdvConfirme: (id) => `✅ *تم تأكيد الموعد #${id}!*\n\nإلى اللقاء 🙏`,
        rdvAnnule: (id) => `❌ *تم إلغاء الموعد #${id}.*\n\nإذا كان هذا خطأ، يرجى الرد علينا 😊`,
        commandeConfirmee: (id) => `✅ *تم تأكيد الطلب #${id}!*\n\nنحضّر طردك 📦\nشكراً لثقتك 🙏`,
        commandeAnnuleeId: (id) => `❌ *تم إلغاء الطلب #${id}.*\n\nإذا كان هذا خطأ، يرجى الرد علينا 😊`,
        idChat: (chatId) => `🆔 Chat ID: \`${chatId}\``,
    },
};

function tr(lang, key, ...args) {
    const dict = T[lang] || T.fr;
    const entry = dict[key] || T.fr[key];
    return typeof entry === "function" ? entry(...args) : entry;
}

async function reply(chatId, text) {
    try {
        await axios.post(`${BASE}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: "Markdown",
        });
    } catch (err) {
        console.error("❌ Telegram reply :", err.response?.data || err.message);
    }
}

// ── LIAISON WORKSPACE ──────────────────────────────────────────
async function linkClientToWorkspace(chatId, workspaceId) {
    try {
        const existing = await db.query(
            `SELECT id FROM connecteurs WHERE type = 'telegram_client' AND config LIKE $1`,
            [`%${chatId}%`]
        );
        if (existing.length > 0) return;
        await db.query(
            `INSERT INTO connecteurs (workspace_id, type, config, actif) VALUES ($1, 'telegram_client', $2, true)`,
            [workspaceId, JSON.stringify({ chatId: String(chatId), linkedAt: new Date().toISOString() })]
        );
        console.log(`🔗 Client ${chatId} lié au workspace ${workspaceId}`);
    } catch (err) {
        console.error("❌ linkClientToWorkspace :", err.message);
    }
}

async function linkMerchantToWorkspace(chatId, workspaceId) {
    try {
        const existing = await db.query(
            `SELECT id FROM connecteurs WHERE type = 'telegram' AND workspace_id = $1`,
            [workspaceId]
        );
        const config = JSON.stringify({ chatId: String(chatId), connectedAt: new Date().toISOString() });
        if (existing.length > 0) {
            await db.query(`UPDATE connecteurs SET config = $1, actif = true WHERE id = $2`, [config, existing[0].id]);
            return true;
        }
        await db.query(
            `INSERT INTO connecteurs (workspace_id, type, config, actif) VALUES ($1, 'telegram', $2, true)`,
            [workspaceId, config]
        );
        return true;
    } catch (err) {
        console.error("❌ linkMerchantToWorkspace :", err.message);
        return false;
    }
}

async function getClientWorkspace(chatId) {
    try {
        const rows = await db.query(
            `SELECT workspace_id FROM connecteurs WHERE type = 'telegram_client' AND config LIKE $1`,
            [`%${chatId}%`]
        );
        return rows[0]?.workspace_id || "";
    } catch { return ""; }
}

async function getWorkspaceByChatId(chatId) {
    try {
        const rows = await db.query(
            `SELECT workspace_id FROM connecteurs WHERE type = 'telegram' AND actif = true AND config LIKE $1`,
            [`%${chatId}%`]
        );
        return rows[0]?.workspace_id || "";
    } catch { return ""; }
}

async function getMetierWorkspace(workspaceId) {
    try {
        if (!workspaceId) return "";
        const rows = await db.query(`SELECT metier FROM workspaces WHERE id = $1`, [workspaceId]);
        return rows[0]?.metier || "";
    } catch { return ""; }
}

async function getProduitsDuWorkspace(workspaceId) {
    try {
        return await db.query(
            `SELECT id, nom, prix, options FROM produits WHERE workspace_id = $1 AND actif = true ORDER BY nom`,
            [workspaceId]
        );
    } catch { return []; }
}

router.post("/", async (req, res) => {
    res.sendStatus(200);
    try {
        const body = req.body;

        if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const data = cb.data || "";
            const lang = memory.get(chatId)?.lang || "fr";

            await axios.post(`${BASE}/answerCallbackQuery`, { callback_query_id: cb.id, text: "⚙️ SAMII..." });

            if (data.startsWith("confirm_")) {
                const orderId = data.replace("confirm_", "");
                const rows = await db.query(`UPDATE commandes SET statut = 'confirmée' WHERE id = $1 RETURNING workspace_id`, [orderId]);
                await orchestrator.process({ type: "order.confirmed", shop: "", payload: { orderId, chatId } });
                socketService.emitToShop(rows[0]?.workspace_id, "commande-confirmee", { id: orderId });
                await reply(chatId, tr(lang, "commandeConfirmee", orderId));
                return;
            }
            if (data.startsWith("cancel_")) {
                const orderId = data.replace("cancel_", "");
                const rows = await db.query(`UPDATE commandes SET statut = 'annulée' WHERE id = $1 RETURNING workspace_id`, [orderId]);
                await orchestrator.process({ type: "order.cancelled.telegram", shop: "", payload: { orderId, chatId } });
                socketService.emitToShop(rows[0]?.workspace_id, "commande-annulee", { id: orderId });
                await reply(chatId, tr(lang, "commandeAnnuleeId", orderId));
                return;
            }
            if (data.startsWith("rdvconfirm_")) {
                const rdvId = data.replace("rdvconfirm_", "");
                const rows = await db.query(`UPDATE rendez_vous SET statut = 'confirmé' WHERE id = $1 RETURNING workspace_id`, [rdvId.replace("RDV-", "")]);
                socketService.emitToShop(rows[0]?.workspace_id, "rdv-confirme", { id: rdvId });
                await reply(chatId, tr(lang, "rdvConfirme", rdvId));
                return;
            }
            if (data.startsWith("rdvcancel_")) {
                const rdvId = data.replace("rdvcancel_", "");
                const rows = await db.query(`UPDATE rendez_vous SET statut = 'annulé' WHERE id = $1 RETURNING workspace_id`, [rdvId.replace("RDV-", "")]);
                socketService.emitToShop(rows[0]?.workspace_id, "rdv-annule", { id: rdvId });
                await reply(chatId, tr(lang, "rdvAnnule", rdvId));
                return;
            }

            await orchestrator.process({ type: "telegram.callback", shop: "", payload: { chatId, data, cb } });
            return;
        }

        const message = body.message;
        if (!message) return;

        const chatId = message.chat.id;
        const text = (message.text || "").trim();
        const name = message.from?.first_name || "Client";
        const langDetectee = detecterLangue(message);
        const lang = memory.get(chatId)?.lang || langDetectee;

        console.log(`📨 Telegram [${name}] (${lang}) : ${text}`);

        if (text.startsWith("/start")) {
            memory.clear(chatId);
            const param = text.split(" ")[1] || null;

            if (param && param.startsWith("admin_")) {
                const workspaceId = param.replace("admin_", "");
                const ok = await linkMerchantToWorkspace(chatId, workspaceId);
                await reply(chatId, ok ? tr(lang, "adminConnecte") : tr(lang, "adminErreur"));
                return;
            }

            if (param) {
                await linkClientToWorkspace(chatId, param);
                await reply(chatId, tr(lang, "bienvenueClient"));
                return;
            }

            await reply(chatId, tr(lang, "bienvenueGenerique", chatId));
            return;
        }

        if (text === "/id") { await reply(chatId, tr(lang, "idChat", chatId)); return; }

        // ── Raisonnement universel : SAMII mène la conversation lui-même, tous métiers ──
        // (prise de rendez-vous, commande, questions...), via function-calling Gemini,
        // au lieu d'un parcours pas-à-pas figé par métier.
        let workspaceId = await getClientWorkspace(chatId);
        if (!workspaceId) workspaceId = await getWorkspaceByChatId(chatId);
        const metier   = await getMetierWorkspace(workspaceId);
        const produits = workspaceId ? await getProduitsDuWorkspace(workspaceId) : [];

        const session      = memory.get(chatId) || {};
        const conversation = session.history || [];

        await orchestrator.process({ type: "telegram.message", shop: "", payload: { chatId, text, message } });
        const geminiReply = await planner.ask(text, {
            source: "telegram", chatId, name, lang, audience: "client",
            workspaceId, metier, produits,
        }, conversation);
        await reply(chatId, geminiReply);

        const nextHistory = [...conversation, { role: "user", message: text }, { role: "model", message: geminiReply }].slice(-16);
        memory.set(chatId, { ...session, lang, history: nextHistory });
    } catch (err) {
        console.error("❌ Telegram webhook :", err.message);
    }
});

module.exports = router;
