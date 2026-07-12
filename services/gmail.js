const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");

async function send({ to, subject, message }) {
    try {
        console.log(`📧 Gmail → ${to} : ${subject}`);
        // Brancher nodemailer ou Gmail API ici
        return { success: true };
    } catch (err) {
        console.error("❌ Gmail send :", err.message);
        return { success: false, error: err.message };
    }
}

async function receive(msg) {
    await orchestrator.process({
        type   : "email.message",
        shop   : msg.shop || "",
        payload: msg,
    });
}

module.exports = { send, receive };
