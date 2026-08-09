// ==========================================================================
// SAMII OS — WEBHOOK WHATSAPP (Green API) — Messages entrants
// ==========================================================================
const express      = require("express");
const orchestrator = require("../brain/orchestrator");
const socketService = require("../services/socketService");
const db            = require("../services/db");

const router = express.Router();

// ── Résout le workspace propriétaire de l'instance Green API ──────────
async function getWorkspaceByInstance(idInstance) {
    try {
        const rows = await db.query(
            `SELECT workspace_id FROM connecteurs WHERE type = 'whatsapp' AND actif = true AND config LIKE $1`,
            [`%"apiId":"${idInstance}"%`]
        );
        return rows[0]?.workspace_id || "";
    } catch {
        return "";
    }
}

router.post("/", async (req, res) => {
    res.sendStatus(200);
    try {
        // Monté sous /webhook, où express.raw() laisse le body en Buffer brut.
        const raw  = req.body;
        const body = Buffer.isBuffer(raw) ? JSON.parse(raw.toString("utf8") || "{}") : (raw || {});

        if (body.typeWebhook !== "incomingMessageReceived") return;

        const idInstance = body.instanceData?.idInstance;
        const senderData  = body.senderData || {};
        const textMessage =
            body.messageData?.textMessageData?.textMessage ||
            body.messageData?.extendedTextMessageData?.text ||
            "";

        if (!idInstance || !textMessage) return;

        const workspaceId = await getWorkspaceByInstance(idInstance);
        if (!workspaceId) {
            console.log(`⚠️ WhatsApp webhook : aucune instance connectée pour idInstance=${idInstance}`);
            return;
        }

        const senderName = senderData.senderName || senderData.chatName || "Client";
        const sender      = (senderData.sender || senderData.chatId || "").replace("@c.us", "");

        console.log(`💬 WhatsApp [${senderName}] (workspace ${workspaceId}) : ${textMessage}`);

        await db.query(
            `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
            ["whatsapp.message", `${senderName}: ${textMessage}`, workspaceId]
        );

        try {
            await orchestrator.process({
                type   : "whatsapp.message",
                shop   : workspaceId,
                payload: { senderName, sender, message: textMessage },
            });
        } catch (procErr) {
            console.error("❌ WhatsApp orchestrator :", procErr.message);
            await db.query(
                `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
                ["error.whatsapp.message", procErr.message, workspaceId]
            );
        }

        socketService.emitToShop(workspaceId, "whatsapp.message", { senderName, message: textMessage });
    } catch (err) {
        console.error("❌ Webhook WhatsApp :", err.message);
    }
});

module.exports = router;
