// ======================================================
// SAMII OS — TELEGRAM WEBHOOK V3
// ======================================================

const express      = require("express");
const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");
const planner      = require("../brain/planner");

const router = express.Router();
const TOKEN  = CONFIG.TELEGRAM.BOT_TOKEN;
const BASE   = `https://api.telegram.org/bot${TOKEN}`;

async function reply(chatId, text) {
    try {
        await axios.post(`${BASE}/sendMessage`, {
            chat_id   : chatId,
            text,
            parse_mode: "Markdown",
        });
    } catch (err) {
        console.error("❌ Telegram reply :", err.response?.data || err.message);
    }
}

router.post("/", async (req, res) => {
    res.sendStatus(200);

    try {
        const body = req.body;

        // ── CALLBACK QUERY (bouton OUI/NON) ──────────────────
        if (body.callback_query) {
            const cb     = body.callback_query;
            const chatId = cb.message.chat.id;
            const data   = cb.data || "";

            await axios.post(`${BASE}/answerCallbackQuery`, {
                callback_query_id: cb.id,
                text             : "⚙️ SAMII traite...",
            });

            if (data.startsWith("confirm_")) {
                const orderId = data.replace("confirm_", "");
                await orchestrator.process({
                    type   : "order.confirmed",
                    shop   : "",
                    payload: { orderId, chatId },
                });
                await reply(chatId,
                    `✅ *Commande confirmée !*\n\nNous préparons votre colis 📦\nVous serez notifié dès l'expédition 🚚\n\nMerci de votre confiance 🙏`
                );
                return;
            }

            if (data.startsWith("cancel_")) {
                const orderId = data.replace("cancel_", "");
                await orchestrator.process({
                    type   : "order.cancelled",
                    shop   : "",
                    payload: { orderId, chatId },
                });
                await reply(chatId,
                    `❌ *Commande annulée.*\n\nSi c'est une erreur, répondez-nous et nous vous aiderons 😊`
                );
                return;
            }

            await orchestrator.process({
                type   : "telegram.callback",
                shop   : "",
                payload: { chatId, data, cb },
            });
            return;
        }

        // ── MESSAGE TEXTE ─────────────────────────────────────
        const message = body.message;
        if (!message) return;

        const chatId = message.chat.id;
        const text   = (message.text || "").trim();
        const name   = message.from?.first_name || "Client";

        console.log(`📨 Telegram [${name}] : ${text}`);

        // /start
        if (text === "/start") {
            await reply(chatId,
                `👑 *Bienvenue sur SAMII OS !*\n\n` +
                `✅ Ton Chat ID :\n\`${chatId}\`\n\n` +
                `Copie ce numéro dans ton Hub pour activer les notifications.`
            );
            return;
        }

        // /id
        if (text === "/id") {
            await reply(chatId, `🆔 Ton Chat ID : \`${chatId}\``);
            return;
        }

        // ── Log dans orchestrateur (CRM) ──────────────────────
        await orchestrator.process({
            type   : "telegram.message",
            shop   : "",
            payload: { chatId, text, message },
        });

        // ── Réponse Gemini ────────────────────────────────────
        const geminiReply = await planner.ask(text, {
            source : "telegram",
            chatId,
            name,
        });

        await reply(chatId, geminiReply);

    } catch (err) {
        console.error("❌ Telegram webhook :", err.message);
    }
});

module.exports = router;

