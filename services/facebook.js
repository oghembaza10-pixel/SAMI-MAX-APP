const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");

async function send({ to, message }) {
    try {
        await axios.post(
            `https://graph.facebook.com/v19.0/me/messages`,
            { recipient: { id: to }, message: { text: message } },
            { params: { access_token: CONFIG.META.PAGE_TOKEN } }
        );
        console.log(`✅ Facebook → ${to}`);
        return { success: true };
    } catch (err) {
        console.error("❌ Facebook send :", err.message);
        return { success: false, error: err.message };
    }
}

async function receive(msg) {
    await orchestrator.process({
        type   : "facebook.message",
        shop   : msg.shop || "",
        payload: msg,
    });
}

module.exports = { send, receive };
