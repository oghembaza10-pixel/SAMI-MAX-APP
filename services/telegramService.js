// ==========================================================================
// SAMII OS — TELEGRAM SERVICE VERSION DÉFINITIVE
// ==========================================================================

const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");

const TOKEN = CONFIG.TELEGRAM.BOT_TOKEN;
const BASE  = `https://api.telegram.org/bot${TOKEN}`;

// ── ENVOYER MESSAGE ────────────────────────────────────────────────────────
async function send(chatId, message) {
    try {
        if (!TOKEN) return { success: false, error: "TOKEN manquant" };
        await axios.post(`${BASE}/sendMessage`, {
            chat_id    : chatId,
            text       : message,
            parse_mode : "Markdown"
        });
        console.log(`✅ Telegram → ${chatId}`);
        return { success: true };
    } catch (err) {
        console.error("❌ Telegram send :", err.response?.data || err.message);
        return { success: false, error: err.message };
    }
}

// ── NOTIFIER NOUVELLE COMMANDE (SAMII AGIT + RAPPORTE) ────────────────────
async function notifyCommande(chatId, commande) {
    const msg =
        `👑 *SAMII — Commande #${commande.order_number} traitée*\n\n` +
        `✅ J'ai enregistré la commande automatiquement.\n\n` +
        `👤 *Client :* ${commande.client}\n` +
        `📞 *Tél :* ${commande.phone}\n` +
        `📍 *Adresse :* ${commande.address}\n` +
        `📦 *Produits :* ${commande.produits}\n` +
        `💰 *Total :* ${commande.total} DZD\n` +
        `📊 *Statut :* ${commande.statut}\n\n` +
        `_SAMII gère la suite automatiquement._`;

    return await send(chatId, msg);
}

// ── NOTIFIER EXPÉDITION ────────────────────────────────────────────────────
async function notifyExpedition(chatId, commande) {
    const msg =
        `🚚 *SAMII — Expédition #${commande.order_number}*\n\n` +
        `✅ J'ai mis à jour le statut en "expédiée".\n\n` +
        `👤 *Client :* ${commande.client}\n` +
        `📦 *Transporteur :* ${commande.carrier || "N/A"}\n` +
        `🔍 *Tracking :* ${commande.tracking || "N/A"}\n\n` +
        `_Client notifié automatiquement._`;

    return await send(chatId, msg);
}

// ── NOTIFIER STOCK FAIBLE ──────────────────────────────────────────────────
async function notifyStock(chatId, data) {
    const msg =
        `⚠️ *SAMII — Alerte Stock*\n\n` +
        `📦 *Produit :* ${data.product}\n` +
        `🔢 *Quantité restante :* ${data.variant}\n\n` +
        `_Pensez à réapprovisionner._`;

    return await send(chatId, msg);
}

// ── RECEVOIR MESSAGE TEXTE ─────────────────────────────────────────────────
async function receive(msg) {
    await orchestrator.process({
        type   : "telegram.message",
        shop   : msg.shop || "",
        payload: msg,
    });
}

module.exports = { send, notifyCommande, notifyExpedition, notifyStock, receive };

