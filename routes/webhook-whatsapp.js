// ==========================================================================
// SAMII OS — WEBHOOK WHATSAPP (Green API) — Messages entrants
// SAMII raisonne lui-même la conversation (rendez-vous, commande, questions)
// via function-calling Gemini, quel que soit le métier — miroir de routes/telegram.js.
// ==========================================================================
const express      = require("express");
const orchestrator = require("../brain/orchestrator");
const planner       = require("../brain/planner");
const memory        = require("../brain/memory");
const socketService = require("../services/socketService");
const whatsapp       = require("../services/whatsapp");
const db            = require("../services/db");

const router = express.Router();

function sessionKey(sender) { return `wa_${sender}`; }

async function reply(sender, workspaceId, text) {
    await whatsapp.send({ to: sender, message: text, workspaceId });
}

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

async function getMetierWorkspace(workspaceId) {
    try {
        const rows = await db.query(`SELECT metier FROM workspaces WHERE id = $1`, [workspaceId]);
        return rows[0]?.metier || "";
    } catch { return ""; }
}

async function getProduitsDuWorkspace(workspaceId) {
    try {
        return await db.query(
            `SELECT id, nom, prix, options FROM produits WHERE workspace_id = $1 AND actif = true ORDER BY nom`,
            [workspaceId]
        );
    } catch { return []; }
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
        const text        = textMessage.trim();

        console.log(`💬 WhatsApp [${senderName}] (workspace ${workspaceId}) : ${text}`);

        await db.query(
            `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
            ["whatsapp.message", `${senderName}: ${text}`, workspaceId]
        );

        try {
            await orchestrator.process({
                type   : "whatsapp.message",
                shop   : workspaceId,
                payload: { senderName, sender, message: text },
            });
        } catch (procErr) {
            console.error("❌ WhatsApp orchestrator :", procErr.message);
            await db.query(
                `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
                ["error.whatsapp.message", procErr.message, workspaceId]
            );
        }

        socketService.emitToShop(workspaceId, "whatsapp.message", { senderName, message: text });

        // ── Raisonnement universel : SAMII mène la conversation lui-même, tous métiers ──
        // (prise de rendez-vous, commande, questions...), via function-calling Gemini,
        // au lieu d'un parcours pas-à-pas figé par métier.
        const key      = sessionKey(sender);
        const session  = await memory.get(key) || {};
        const conversation = session.history || [];

        const metier   = await getMetierWorkspace(workspaceId);
        const produits = await getProduitsDuWorkspace(workspaceId);

        const geminiReply = await planner.ask(text, {
            source: "whatsapp", chatId: sender, name: senderName, audience: "client",
            workspaceId, metier, produits,
        }, conversation);
        await reply(sender, workspaceId, geminiReply);

        const nextHistory = [...conversation, { role: "user", message: text }, { role: "model", message: geminiReply }].slice(-60);
        await memory.set(key, { ...session, history: nextHistory });

    } catch (err) {
        console.error("❌ Webhook WhatsApp :", err.message);
    }
});

module.exports = router;
