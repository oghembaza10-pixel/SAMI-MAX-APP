/**
 * ============================================================
 * OG • WhatsApp Service
 * ============================================================
 */

const axios             = require("axios");
const CONFIG            = require("../config");
const orchestrator      = require("../brain/orchestrator");
const connectorService  = require("./connectorService");

// ── CREDENTIALS : instance du marchand en priorité, sinon canal global SAMII ──
async function resolveCredentials(workspaceId) {
    if (workspaceId) {
        try {
            const connecteur = await connectorService.getOne(workspaceId, "whatsapp");
            const { instanceId, apiToken } = connecteur?.config || {};
            if (connecteur?.actif && instanceId && apiToken) {
                return { instanceId, apiToken };
            }
        } catch (err) {
            console.error("❌ WhatsApp resolveCredentials :", err.message);
        }
    }
    return { instanceId: CONFIG.WHATSAPP.INSTANCE, apiToken: CONFIG.WHATSAPP.API_KEY };
}

// ── ENVOIE UN MESSAGE ────────────────────────────────
async function send({ to, message, workspaceId }) {
    try {
        const { instanceId, apiToken } = await resolveCredentials(workspaceId);
        if (!to || !instanceId || !apiToken) {
            console.warn("⚠️ WhatsApp non configuré");
            return { success: false };
        }

        await axios.post(
            `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`,
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
