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
const confirmationsQuota = require("../services/confirmationsQuota");
const telegramCommunity = require("../services/telegramCommunity");
const transcription = require("../services/transcription");

const router = express.Router();
const TOKEN  = CONFIG.TELEGRAM.BOT_TOKEN;
const BASE   = `https://api.telegram.org/bot${TOKEN}`;

// ── Bot perso du marchand (routes/connector.js, POST /connect/telegram/bot) ──
// Chaque bot perso a son propre webhook dédié (/telegram/:workspaceId, voir
// plus bas) — contrairement à WhatsApp, aucune ambiguïté de routage : c'est
// justement Telegram qui indique par QUELLE URL le message arrive.
async function resolveBotBase(workspaceId) {
    if (!workspaceId) return BASE;
    try {
        const rows = await db.query(
            `SELECT config FROM connecteurs WHERE type = 'telegram_bot' AND actif = true AND workspace_id = $1`,
            [workspaceId]
        );
        const config = rows[0] ? JSON.parse(rows[0].config || "{}") : null;
        if (config?.botToken) return `https://api.telegram.org/bot${config.botToken}`;
    } catch (err) {
        console.error("❌ Telegram resolveBotBase :", err.message);
    }
    return BASE;
}

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
        rdvChoisirHeure: "🕐 Choisis un créneau :",
        rdvJourComplet: "😔 Ce jour est complet, choisis-en un autre.",
        rdvExpire: "⏳ Ce calendrier a expiré, redemande un rendez-vous.",
        rdvCree: (date) => `✅ *Rendez-vous confirmé !*\n\n🗓️ ${date}\n\nÀ bientôt 🙏`,
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
        rdvChoisirHeure: "🕐 Pick a time slot:",
        rdvJourComplet: "😔 This day is fully booked, pick another one.",
        rdvExpire: "⏳ This calendar has expired, ask for an appointment again.",
        rdvCree: (date) => `✅ *Appointment confirmed!*\n\n🗓️ ${date}\n\nSee you soon 🙏`,
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
        rdvChoisirHeure: "🕐 اختر موعداً:",
        rdvJourComplet: "😔 هذا اليوم محجوز بالكامل، اختر يوماً آخر.",
        rdvExpire: "⏳ انتهت صلاحية هذا التقويم، اطلب موعداً من جديد.",
        rdvCree: (date) => `✅ *تم تأكيد الموعد!*\n\n🗓️ ${date}\n\nإلى اللقاء 🙏`,
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

// ── Note vocale : Telegram ne fournit qu'un file_id, il faut d'abord
// résoudre son chemin de téléchargement réel via getFile avant de pouvoir
// récupérer l'audio et le transcrire (Groq Whisper, gratuit).
async function transcribeVoice(fileId, base) {
    try {
        const { data } = await axios.get(`${base}/getFile`, { params: { file_id: fileId } });
        const filePath = data?.result?.file_path;
        if (!filePath) return "";
        const fileUrl = `${base.replace("api.telegram.org/bot", "api.telegram.org/file/bot")}/${filePath}`;
        return await transcription.transcribeFromUrl(fileUrl, "voice.oga");
    } catch (err) {
        console.error("❌ Telegram transcribeVoice :", err.response?.data || err.message);
        return "";
    }
}

async function reply(chatId, text, base = BASE) {
    try {
        await axios.post(`${base}/sendMessage`, {
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

// ── Traite une mise à jour Telegram, pour n'importe quel bot ──────────────
async function handleUpdate(body, base, forcedWorkspaceId) {
    try {
        const memKey = (chatId) => forcedWorkspaceId ? `tg_${forcedWorkspaceId}_${chatId}` : String(chatId);

        // Les groupes/communautés passent par l'agent communautaire dédié.
        // Cela évite de mélanger la mémoire collective avec une conversation privée.
        if (body.message && telegramCommunity.isGroup(body.message)) {
            await telegramCommunity.handleMessage(body.message, base, {
                workspaceId: forcedWorkspaceId || ""
            });
            return;
        }

        if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const data = cb.data || "";
            const lang = (await memory.get(memKey(chatId)))?.lang || "fr";

            await axios.post(`${base}/answerCallbackQuery`, { callback_query_id: cb.id, text: "⚙️ SAMII..." });

            if (data.startsWith("confirm_")) {
                const orderId = data.replace("confirm_", "");
                const rows = await db.query(`UPDATE commandes SET statut = 'confirmée', confirme_le = now() WHERE id = $1 RETURNING workspace_id`, [orderId]);
                if (rows[0]?.workspace_id) confirmationsQuota.enregistrerSiDepassement(rows[0].workspace_id).catch(() => {});
                await orchestrator.process({ type: "order.confirmed", shop: "", payload: { orderId, chatId } });
                socketService.emitToShop(rows[0]?.workspace_id, "commande-confirmee", { id: orderId });
                await reply(chatId, tr(lang, "commandeConfirmee", orderId), base);
                return;
            }
            if (data.startsWith("cancel_")) {
                const orderId = data.replace("cancel_", "");
                const rows = await db.query(`UPDATE commandes SET statut = 'annulée' WHERE id = $1 RETURNING workspace_id`, [orderId]);
                await orchestrator.process({ type: "order.cancelled.telegram", shop: "", payload: { orderId, chatId } });
                socketService.emitToShop(rows[0]?.workspace_id, "commande-annulee", { id: orderId });
                await reply(chatId, tr(lang, "commandeAnnuleeId", orderId), base);
                return;
            }
            if (data.startsWith("rdvconfirm_")) {
                const rdvId = data.replace("rdvconfirm_", "");
                const rows = await db.query(`UPDATE rendez_vous SET statut = 'confirmé' WHERE id = $1 RETURNING workspace_id`, [rdvId.replace("RDV-", "")]);
                socketService.emitToShop(rows[0]?.workspace_id, "rdv-confirme", { id: rdvId });
                await reply(chatId, tr(lang, "rdvConfirme", rdvId), base);
                return;
            }
            if (data.startsWith("rdvcancel_")) {
                const rdvId = data.replace("rdvcancel_", "");
                const rows = await db.query(`UPDATE rendez_vous SET statut = 'annulé' WHERE id = $1 RETURNING workspace_id`, [rdvId.replace("RDV-", "")]);
                socketService.emitToShop(rows[0]?.workspace_id, "rdv-annule", { id: rdvId });
                await reply(chatId, tr(lang, "rdvAnnule", rdvId), base);
                return;
            }

            if (data.startsWith("rdvday_")) {
                const [, draftId, dateISO] = data.match(/^rdvday_(\d+)_(\d{4}-\d{2}-\d{2})$/) || [];
                if (!draftId) return;
                const draftRows = await db.query(`SELECT workspace_id FROM rendez_vous WHERE id = $1 AND statut = 'brouillon'`, [draftId]);
                const workspaceId = draftRows[0]?.workspace_id;
                if (!workspaceId) { await reply(chatId, tr(lang, "rdvExpire"), base); return; }

                const commerceEngine = require("../engines/commerceEngine");
                const creneaux = await commerceEngine.creneauxLibresPourJour(workspaceId, dateISO);
                if (!creneaux.length) { await reply(chatId, tr(lang, "rdvJourComplet"), base); return; }

                const boutons = [];
                for (let i = 0; i < creneaux.length; i += 3) {
                    boutons.push(creneaux.slice(i, i + 3).map(c => ({
                        text: c.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
                        callback_data: `rdvslot_${draftId}_${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}T${String(c.getHours()).padStart(2, "0")}:${String(c.getMinutes()).padStart(2, "0")}:00`,
                    })));
                }
                await require("../services/telegramService").sendWithKeyboard(chatId, tr(lang, "rdvChoisirHeure"), boutons, forcedWorkspaceId);
                return;
            }

            if (data.startsWith("rdvslot_")) {
                const [, draftId, dateRdv] = data.match(/^rdvslot_(\d+)_(.+)$/) || [];
                if (!draftId) return;
                const commerceEngine = require("../engines/commerceEngine");
                const rdv = await commerceEngine.finaliserCreneauRdv(draftId, dateRdv);
                if (!rdv) { await reply(chatId, tr(lang, "rdvExpire"), base); return; }
                await reply(chatId, tr(lang, "rdvCree", new Date(rdv.date_rdv).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })), base);
                return;
            }

            await orchestrator.process({ type: "telegram.callback", shop: "", payload: { chatId, data, cb } });
            return;
        }

        const message = body.message;
        if (!message) return;

        const chatId = message.chat.id;
        let text = (message.text || "").trim();
        if (!text && message.voice?.file_id) {
            text = (await transcribeVoice(message.voice.file_id, base)).trim();
        }
        const name = message.from?.first_name || "Client";
        const langDetectee = detecterLangue(message);
        const lang = (await memory.get(memKey(chatId)))?.lang || langDetectee;

        console.log(`📨 Telegram [${name}] (${lang}) : ${text}`);

        if (text.startsWith("/start")) {
            await memory.clear(memKey(chatId));

            if (forcedWorkspaceId) {
                await reply(chatId, tr(lang, "bienvenueClient"), base);
                return;
            }

            const param = text.split(" ")[1] || null;

            if (param && param.startsWith("admin_")) {
                const workspaceId = param.replace("admin_", "");
                const ok = await linkMerchantToWorkspace(chatId, workspaceId);
                await reply(chatId, ok ? tr(lang, "adminConnecte") : tr(lang, "adminErreur"), base);
                return;
            }

            if (param) {
                await linkClientToWorkspace(chatId, param);
                await reply(chatId, tr(lang, "bienvenueClient"), base);
                return;
            }

            await reply(chatId, tr(lang, "bienvenueGenerique", chatId), base);
            return;
        }

        if (text === "/id") { await reply(chatId, tr(lang, "idChat", chatId), base); return; }

        let workspaceId = forcedWorkspaceId;
        if (!workspaceId) {
            workspaceId = await getClientWorkspace(chatId);
            if (!workspaceId) workspaceId = await getWorkspaceByChatId(chatId);
        }
        const metier   = await getMetierWorkspace(workspaceId);
        const produits = workspaceId ? await getProduitsDuWorkspace(workspaceId) : [];

        const session      = await memory.get(memKey(chatId)) || {};
        const conversation = session.history || [];

        await orchestrator.process({ type: "telegram.message", shop: "", payload: { chatId, text, message } });
        const geminiReply = await planner.ask(text, {
            source: "telegram", chatId, name, lang, audience: "client",
            workspaceId, metier, produits,
        }, conversation);
        await reply(chatId, geminiReply, base);

        const nextHistory = [...conversation, { role: "user", message: text }, { role: "model", message: geminiReply }].slice(-60);
        await memory.set(memKey(chatId), { ...session, lang, history: nextHistory });
    } catch (err) {
        console.error("❌ Telegram webhook :", err.message);
    }
}

router.post("/", (req, res) => {
    res.sendStatus(200);
    handleUpdate(req.body, BASE, null);
});

router.post("/:workspaceId", async (req, res) => {
    res.sendStatus(200);
    const base = await resolveBotBase(req.params.workspaceId);
    handleUpdate(req.body, base, req.params.workspaceId);
});

module.exports = router;
