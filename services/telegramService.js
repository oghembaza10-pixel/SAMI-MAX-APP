 // ==========================================================================
// SAMII OS — TELEGRAM AGENT DE VENTE AUTONOME
// ==========================================================================

const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");

const TOKEN = CONFIG.TELEGRAM.BOT_TOKEN;
const BASE  = `https://api.telegram.org/bot${TOKEN}`;

// ── ENVOYER MESSAGE SIMPLE ─────────────────────────────────────────────────
async function send(chatId, message) {
    try {
        if (!TOKEN) return { success: false };
        await axios.post(`${BASE}/sendMessage`, {
            chat_id    : chatId,
            text       : message,
            parse_mode : "Markdown"
        });
        console.log(`✅ Telegram → ${chatId}`);
        return { success: true };
    } catch (err) {
        console.error("❌ Telegram send :", err.message);
        return { success: false, error: err.message };
    }
}

// ── ENVOYER MESSAGE AVEC BOUTONS ───────────────────────────────────────────
async function sendButtons(chatId, message, buttons) {
    try {
        if (!TOKEN) return { success: false };
        await axios.post(`${BASE}/sendMessage`, {
            chat_id      : chatId,
            text         : message,
            parse_mode   : "Markdown",
            reply_markup : {
                inline_keyboard: buttons
            }
        });
        return { success: true };
    } catch (err) {
        console.error("❌ Telegram buttons :", err.message);
        return { success: false };
    }
}

// ── RÉPONDRE À UN CALLBACK (bouton cliqué) ────────────────────────────────
async function answerCallback(callbackQueryId, text) {
    try {
        await axios.post(`${BASE}/answerCallbackQuery`, {
            callback_query_id : callbackQueryId,
            text              : text
        });
    } catch (err) {
        console.error("❌ answerCallback :", err.message);
    }
}

// ── RECEVOIR MESSAGE TEXTE ────────────────────────────────────────────────
async function receive(msg) {
    await orchestrator.process({
        type   : "telegram.message",
        shop   : msg.shop || "",
        payload: msg,
    });
}

// ── RECEVOIR CALLBACK (bouton cliqué) ────────────────────────────────────
async function receiveCallback(callbackQuery) {
    await orchestrator.process({
        type   : "telegram.callback",
        shop   : callbackQuery.shop || "",
        payload: callbackQuery,
    });
}

// ── NOTIFIER NOUVELLE COMMANDE AVEC BOUTONS ───────────────────────────────
async function notifyCommande(chatId, commande) {
    const msg =
        `👑 *NOUVELLE COMMANDE #${commande.id}*\n\n` +
        `👤 *Client :* ${commande.client}\n` +
        `📦 *Produits :* ${commande.produits}\n` +
        `💰 *Total :* ${commande.total} DZD\n` +
        `📍 *Adresse :* ${commande.adresse}\n` +
        `📞 *Téléphone :* ${commande.telephone}`;

    const buttons = [[
        { text: "✅ Confirmer",  callback_data: `confirm_${commande.id}` },
        { text: "❌ Annuler",    callback_data: `cancel_${commande.id}`  },
    ],[
        { text: "🚚 Expédier",   callback_data: `ship_${commande.id}`    },
        { text: "📋 Détails",    callback_data: `details_${commande.id}` },
    ]];

    return await sendButtons(chatId, msg, buttons);
}

module.exports = { send, sendButtons, answerCallback, receive, receiveCallback, notifyCommande };

