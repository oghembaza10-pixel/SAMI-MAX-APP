// ==========================================================================
// SAMII OS — TELEGRAM SERVICE V2
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
            chat_id   : chatId,
            text      : message,
            parse_mode: "Markdown",
        });
        console.log(`✅ Telegram → ${chatId}`);
        return { success: true };
    } catch (err) {
        console.error("❌ Telegram send :", err.response?.data || err.message);
        return { success: false, error: err.message };
    }
}

// ── CONFIRMATION OUI/NON ───────────────────────────────────────────────────
async function demanderConfirmation(chatId, commande) {
    try {
        if (!TOKEN) return { success: false, error: "TOKEN manquant" };

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

        await axios.post(`${BASE}/sendMessage`, {
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
    demanderConfirmation,
    notifyCommande,
    notifyExpedition,
    notifyStock,
    receive,
};
