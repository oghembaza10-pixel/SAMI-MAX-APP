// ==========================================================================
// SAMII OS — TELEGRAM SERVICE V2
// ==========================================================================

const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");
const db           = require("./db");

const TOKEN = CONFIG.TELEGRAM.BOT_TOKEN;
const BASE  = `https://api.telegram.org/bot${TOKEN}`;

// ── CREDENTIALS : bot perso du marchand si connecté, sinon bot partagé SAMII ──
// Miroir de services/whatsapp.js : un marchand qui a connecté son propre bot
// Telegram (routes/connector.js, POST /connect/telegram/bot) voit ses clients
// lui parler sous SA PROPRE identité (nom/photo de son bot), pas sous
// "SAMII_OGBot". Contrairement au numéro WhatsApp partagé, le bot partagé
// Telegram reste un repli sûr : chaque bot (perso ou partagé) a son webhook
// dédié (voir routes/telegram.js), aucune ambiguïté de routage possible.
async function resolveCredentials(workspaceId) {
    if (workspaceId) {
        try {
            const rows = await db.query(
                `SELECT config FROM connecteurs WHERE type = 'telegram_bot' AND actif = true AND workspace_id = $1`,
                [workspaceId]
            );
            const config = rows[0] ? JSON.parse(rows[0].config || "{}") : null;
            if (config?.botToken) {
                return { token: config.botToken, base: `https://api.telegram.org/bot${config.botToken}` };
            }
        } catch (err) {
            console.error("❌ Telegram resolveCredentials :", err.message);
        }
    }
    return { token: TOKEN, base: BASE };
}

// ── CHAT ID DU MARCHAND CONNECTÉ SUR UN WORKSPACE ──────────────────────────
async function getAdminChatId(workspaceId) {
    try {
        if (!workspaceId) return null;
        const rows = await db.query(
            `SELECT config FROM connecteurs WHERE type = 'telegram' AND actif = true AND workspace_id = $1`,
            [workspaceId]
        );
        if (!rows[0]) return null;
        const config = JSON.parse(rows[0].config || "{}");
        return config.chatId || null;
    } catch { return null; }
}

// ── NOTIFIER LE MARCHAND AVEC BOUTONS INLINE (confirmer/annuler) ──────────
async function notifyAdmin(workspaceId, message, inlineKeyboard) {
    const chatId = await getAdminChatId(workspaceId);
    if (!chatId) return { success: false };
    try {
        await axios.post(`${BASE}/sendMessage`, {
            chat_id     : chatId,
            text        : message,
            parse_mode  : "Markdown",
            ...(inlineKeyboard ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
        });
        return { success: true };
    } catch (err) {
        console.error("❌ Telegram notifyAdmin :", err.response?.data || err.message);
        return { success: false, error: err.message };
    }
}

// ── ENVOYER MESSAGE AVEC BOUTONS INLINE (calendrier RDV, choix...) ─────────
async function sendWithKeyboard(chatId, message, inlineKeyboard, workspaceId) {
    try {
        const { token, base } = await resolveCredentials(workspaceId);
        if (!token) return { success: false, error: "TOKEN manquant" };
        await axios.post(`${base}/sendMessage`, {
            chat_id     : chatId,
            text        : message,
            parse_mode  : "Markdown",
            reply_markup: { inline_keyboard: inlineKeyboard },
        });
        return { success: true };
    } catch (err) {
        console.error("❌ Telegram sendWithKeyboard :", err.response?.data || err.message);
        return { success: false, error: err.message };
    }
}

// ── ENVOYER MESSAGE ────────────────────────────────────────────────────────
// parseMode : "Markdown" par défaut (comportement historique, inchangé pour
// tous les appelants existants) — passer null désactive le parsing Markdown
// (utile pour un texte généré par IA dont les astérisques/underscores ne
// sont pas garantis équilibrés, ce qui ferait échouer l'appel Telegram).
async function send(chatId, message, workspaceId, parseMode = "Markdown") {
    try {
        const { token, base } = await resolveCredentials(workspaceId);
        if (!token) return { success: false, error: "TOKEN manquant" };
        await axios.post(`${base}/sendMessage`, {
            chat_id: chatId,
            text: message,
            ...(parseMode ? { parse_mode: parseMode } : {}),
        });
        console.log(`✅ Telegram → ${chatId}`);
        return { success: true };
    } catch (err) {
        console.error("❌ Telegram send :", err.response?.data || err.message);
        return { success: false, error: err.message };
    }
}

// ── CONFIRMATION OUI/NON ───────────────────────────────────────────────────
async function demanderConfirmation(chatId, commande, workspaceId) {
    try {
        const { token, base } = await resolveCredentials(workspaceId);
        if (!token) return { success: false, error: "TOKEN manquant" };

        const prenom  = commande.client   || "cher client";
        const total   = commande.total    || "0";
        const produits = commande.produits || "";
        const pays    = commande.pays     || "DZ";
        const arab    = ["DZ", "MA", "TN"].includes(pays);

        const texte = arab
            ? `السلام عليكم ${prenom} 👋\n\n` +
              `شكراً على طلبك ! 🙏\n\n` +
              `📦 *${produits}*\n` +
              `💰 *المبلغ :* ${total} دج\n\n` +
              `هل تؤكد طلبك ؟`
            : `Bonjour ${prenom} 👋\n\n` +
              `Merci pour votre commande ! 🙏\n\n` +
              `📦 *${produits}*\n` +
              `💰 *Total :* ${total} DZD\n\n` +
              `Confirmez-vous votre commande ?`;

        await axios.post(`${base}/sendMessage`, {
            chat_id     : chatId,
            text        : texte,
            parse_mode  : "Markdown",
            reply_markup: {
                inline_keyboard: [[
                    { text: "✅ OUI — Confirmer", callback_data: `confirm_${commande.order_id}` },
                    { text: "❌ NON — Annuler",   callback_data: `cancel_${commande.order_id}`  },
                ]]
            },
        });

        console.log(`✅ Confirmation envoyée → ${chatId}`);
        return { success: true };

    } catch (err) {
        console.error("❌ demanderConfirmation :", err.response?.data || err.message);
        return { success: false, error: err.message };
    }
}

// ── NOTIFIER COMMANDE ──────────────────────────────────────────────────────
async function notifyCommande(chatId, commande) {
    const msg =
        `👑 *SAMII — Commande #${commande.order_number} traitée*\n\n` +
        `✅ Enregistrée automatiquement.\n\n` +
        `👤 *Client :* ${commande.client   || "—"}\n` +
        `📞 *Tél :* ${commande.phone       || "—"}\n` +
        `📍 *Adresse :* ${commande.address || "—"}\n` +
        `📦 *Produits :* ${commande.produits || "—"}\n` +
        `💰 *Total :* ${commande.total     || "0"} DZD\n` +
        `📊 *Statut :* ${commande.statut   || "—"}\n\n` +
        `_SAMII gère la suite automatiquement._`;

    return await send(chatId, msg);
}

// ── NOTIFIER EXPÉDITION ────────────────────────────────────────────────────
async function notifyExpedition(chatId, commande) {
    const msg =
        `🚚 *SAMII — Expédition #${commande.order_number}*\n\n` +
        `✅ Statut mis à jour : expédiée.\n\n` +
        `👤 *Client :* ${commande.client       || "—"}\n` +
        `📦 *Transporteur :* ${commande.carrier || "N/A"}\n` +
        `🔍 *Tracking :* ${commande.tracking   || "N/A"}\n\n` +
        `_Client notifié automatiquement._`;

    return await send(chatId, msg);
}

// ── NOTIFIER STOCK FAIBLE ──────────────────────────────────────────────────
async function notifyStock(chatId, data) {
    const msg =
        `⚠️ *SAMII — Alerte Stock*\n\n` +
        `📦 *Produit :* ${data.product || "—"}\n` +
        `🔢 *Quantité restante :* ${data.variant || "—"}\n\n` +
        `_Pensez à réapprovisionner._`;

    return await send(chatId, msg);
}

// ── RECEVOIR MESSAGE ───────────────────────────────────────────────────────
async function receive(msg) {
    await orchestrator.process({
        type   : "telegram.message",
        shop   : msg.shop || "",
        payload: msg,
    });
}

module.exports = {
    send,
    sendWithKeyboard,
    getAdminChatId,
    notifyAdmin,
    demanderConfirmation,
    notifyCommande,
    notifyExpedition,
    notifyStock,
    receive,
};
