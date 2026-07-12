const axios        = require("axios");
const CONFIG       = require("../config");
const SAMII_PROMPT = require("../brain/prompts/index");

async function send({ to, message }) {
    console.log(`🤖 Gemini → ${to} : ${message}`);
    return { success: true };
}

async function chat({ message, context = {} }) {
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI.API_KEY}`,
            { contents: [{ parts: [{ text: SAMII_PROMPT(message, context) }] }] }
        );
        return response.data.candidates[0].content.parts[0].text;
    } catch (err) {
        console.error("❌ Gemini :", err.message);
        return "SAMII démarre actuellement. Réessaie dans quelques instants.";
    }
}

async function receive(msg) {
    console.log("📥 Gemini receive :", msg);
}

module.exports = { send, chat, receive };

