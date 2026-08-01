const axios       = require("axios");
const CONFIG      = require("../config");
const orchestrator = require("../brain/orchestrator");

const RESEND_API_URL = "https://api.resend.com/emails";

const FROM_ADDRESS =
    process.env.RESEND_FROM || "SAMII OS <noreply@samii.souverain-store.com>";

async function send({ to, subject, message, html }) {
    try {
        if (!CONFIG.RESEND?.API_KEY) {
            console.warn("⚠️ RESEND_API_KEY manquante — email non envoyé.");
            return {
                success: false,
                error: "Service email non configuré."
            };
        }

        if (!to || !subject) {
            return {
                success: false,
                error: "Destinataire et sujet requis."
            };
        }

        const response = await axios.post(
            RESEND_API_URL,
            {
                from: FROM_ADDRESS,
                to: [to],
                subject,
                html: html || `<p>${message || ""}</p>`,
                text: message || "",
            },
            {
                headers: {
                    Authorization: `Bearer ${CONFIG.RESEND.API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        console.log(
            `📧 Email envoyé → ${to} : ${subject}`,
            response.data
        );

        return {
            success: true,
            id: response.data?.id || null
        };

    } catch (err) {
        console.error(
            "❌ Resend send :",
            err.response?.data || err.message
        );

        return {
            success: false,
            error: err.response?.data?.message || "Erreur envoi email."
        };
    }
}

async function receive(msg) {
    await orchestrator.process({
        type: "email.message",
        shop: msg.shop || "",
        payload: msg,
    });
}

module.exports = {
    send,
    receive
};
