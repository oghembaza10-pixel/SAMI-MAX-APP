const express = require("express");
const axios = require("axios");

const router = express.Router();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

router.post("/", async (req, res) => {

    try {

        const message = req.body.message;

        if (!message) {
            return res.sendStatus(200);
        }

        const chatId = message.chat.id;
        const text = message.text || "";

        let reply = "";

        if (text === "/start") {

            reply =
`👋 Welcome to SAMII

I am the official AI assistant of OG Empire.

Your HQ is almost ready.

Ask me anything.`;

        } else {

            reply =
`You said:

${text}

⚡ SAMII is now connected.
Gemini AI will be connected in the next step.`;

        }

        await axios.post(
            `https://api.telegram.org/bot${TOKEN}/sendMessage`,
            {
                chat_id: chatId,
                text: reply
            }
        );

        res.sendStatus(200);

    } catch (err) {

        console.log(err.response?.data || err.message);

        res.sendStatus(500);

    }

});

module.exports = router;
