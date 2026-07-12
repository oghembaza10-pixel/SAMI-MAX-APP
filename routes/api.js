/**
 * ============================================================
 * OG • API Routes
 * ============================================================
 */

const express       = require("express");
const router        = express.Router();
const geminiService = require("../services/geminiService");

router.post("/chat", async (req, res) => {
    try {
        const message = req.body.message;

        if (!message) {
            return res.json({ success: false, reply: "Écris un message." });
        }

        const context = {
            user: {
                lang: req.body.lang || "",
            },
            shop      : req.body.shop       || "",
            client    : req.body.client     || "",
            commande  : req.body.commande   || "",
            page      : req.body.page       || "",
            lastAction: req.body.lastAction || "",
            session: {
                timestamp: Date.now(),
            },
        };

        const reply = await geminiService.chat({ message, context });
        res.json({ success: true, reply });

    } catch (err) {
        console.error("❌ API chat :", err.message);
        res.json({
            success: false,
            reply  : "SAMII démarre actuellement. Réessaie dans quelques instants."
        });
    }
});

module.exports = router;


