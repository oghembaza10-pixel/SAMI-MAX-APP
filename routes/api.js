// ======================================================
// routes/api.js — Chat SAMII
// ======================================================

const express      = require("express");
const router       = express.Router();
const axios        = require("axios");
const CONFIG       = require("../config");
const SAMII_PROMPT = require("../brain/prompts/index");

router.post("/chat", async (req, res) => {
    try {
        const message = req.body.message;

        if (!message) {
            return res.json({ success: false, reply: "Écris un message." });
        }

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI.API_KEY}`,
            {
                contents: [{
                    parts: [{
                        text: SAMII_PROMPT(message, {
                            shop      : req.body.shop       || "",
                            client    : req.body.client     || "",
                            commande  : req.body.commande   || "",
                            page      : req.body.page       || "",
                            lang      : req.body.lang       || "",
                            lastAction: req.body.lastAction || "",
                        })
                    }]
                }]
            }
        );

        const reply = response.data.candidates[0].content.parts[0].text;
        res.json({ success: true, reply });

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.json({
            success: false,
            reply  : "SAMII démarre actuellement. Réessaie dans quelques instants."
        });
    }
});

module.exports = router;

