// ==========================================================================
// SAMII OS — TELEGRAM WEBHOOK VERSION DÉFINITIVE
// ==========================================================================

const express      = require("express");
const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");

const router = express.Router();
const TOKEN  = CONFIG.TELEGRAM.BOT_TOKEN;
const BASE   = `https://api.telegram.org/bot${TOKEN}`;

router.post("/", async (req, res) => {
    res.sendStatus(200);

    try {
        const body = req.body;

        // ── CALLBACK QUERY (bouton cliqué) ────────────────────────────────
        if (body.callback_query) {
            const cb     = body.callback_query;
            const chatId = cb.message.chat.id;
            const data   = cb.data;

            await axios.post(`${BASE}/answerCallbackQuery`, {
                callback_query_id : cb.id,
                text              : "⚙️ SAMII traite..."
            });

            await orchestrator.process({
                type   : "telegram.callback",
                shop   : "",
                payload: { chatId, data, cb }
            });

            return;
        }

        // ── MESSAGE TEXTE ─────────────────────────────────────────────────
        const message = body.message;
        if (!message) return;

        const chatId = message.chat.id;
        const text   = message.text || "";

        // /start
        if (text === "/start") {
            await axios.post(`${BASE}/sendMessage`, {
                chat_id    : chatId,
                text       : `👑 *Bienvenue sur SAMII OS !*\n\n✅ Ton Chat ID :\n\`${chatId}\`\n\nCopie ce numéro dans ton Hub pour activer les notifications.`,
                parse_mode : "Markdown"
            });
            return;
        }

        // /id
        if (text === "/id") {
            await axios.post(`${BASE}/sendMessage`, {
                chat_id    : chatId,
                text       : `🆔 Ton Chat ID : \`${chatId}\``,
                parse_mode : "Markdown"
            });
            return;
        }

        // Tous les autres messages → orchestrator
        await orchestrator.process({
            type   : "telegram.message",
            shop   : "",
            payload: { chatId, text, message }
        });

    } catch (err) {
        console.error("❌ Telegram webhook :", err.message);
    }
});

module.exports = router;

