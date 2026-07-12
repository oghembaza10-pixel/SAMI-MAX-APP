/**
 * ============================================================
 * OG • WhatsApp Service
 * ============================================================
 */

const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");

// ── ENVOIE UN MESSAGE ────────────────────────────────
async function send({ to, message }) {
    try {
        if (!to || !CONFIG.WHATSAPP.INSTANCE || !CONFIG.WHATSAPP.TOKEN) {
            console.warn("⚠️ WhatsApp non configuré");
            return { success: false };
        }

        await axios.post(
            `https://api.green-api.com/waInstance${CONFIG.WHATSAPP.INSTANCE}/sendMessage/${CONFIG.WHATSAPP.TOKEN}`,
            { chatId: `${to}@c.us`, message }
        );

        console.log(`✅ WhatsApp → ${to}`);
        return { success: true };

    } catch (err) {
        console.error("❌ WhatsApp send :", err.message);
        return { success: false, error: err.message };
    }
}

// ── REÇOIT UN MESSAGE → ORCHESTRATOR ────────────────
async function message(msg) {
    await orchestrator.process({
        type   : "whatsapp.message",
        shop   : msg.shop || "",
        payload: msg,
    });
}

module.exports = { send, message };
