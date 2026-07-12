const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");

async function send(chatId, message) {
    try {
        if (!CONFIG.TELEGRAM.TOKEN) return { success: false };
        await axios.post(
            `https://api.telegram.org/bot${CONFIG.TELEGRAM.TOKEN}/sendMessage`,
            { chat_id: chatId, text: message, parse_mode: "Markdown" }
        );
        console.log(`✅ Telegram → ${chatId}`);
        return { success: true };
    } catch (err) {
        console.error("❌ Telegram send :", err.message);
        return { success: false, error: err.message };
    }
}

async function receive(msg) {
    await orchestrator.process({
        type   : "telegram.message",
        shop   : msg.shop || "",
        payload: msg,
    });
}

module.exports = { send, receive };
