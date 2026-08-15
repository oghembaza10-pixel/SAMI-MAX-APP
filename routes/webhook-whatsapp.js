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
const confirmationsQuota = require("../services/confirmationsQuota");

const router = express.Router();

function sessionKey(sender) { return `wa_${sender}`; }

async function reply(sender, workspaceId, text) {
    await whatsapp.send({ to: sender, message: text, workspaceId });
}

const REPONSES_OUI = ["oui", "yes", "ok", "okay", "confirme", "confirmé", "نعم", "1"];
const REPONSES_NON = ["non", "no", "annule", "annulé", "لا", "2"];

// ── Confirmation/annulation directe par le client (réponse texte OUI/NON à
// la demande envoyée après création de commande) — évite de dépendre du
// raisonnement Gemini pour une action aussi sensible, même principe que les
// boutons inline déjà utilisés côté Telegram.
async function traiterReponseConfirmation(sender, workspaceId, text) {
    const normalise = text.trim().toLowerCase();
    if (!REPONSES_OUI.includes(normalise) && !REPONSES_NON.includes(normalise)) return false;

    const pending = await db.query(
        `SELECT id FROM commandes WHERE workspace_id = $1 AND contact_id = $2 AND statut = 'en attente' ORDER BY created_at DESC LIMIT 1`,
        [workspaceId, sender]
    );
    const orderId = pending[0]?.id;
    if (!orderId) return false;

    if (REPONSES_OUI.includes(normalise)) {
        await db.query(`UPDATE commandes SET statut = 'confirmée', confirme_le = now() WHERE id = $1`, [orderId]);
        confirmationsQuota.enregistrerSiDepassement(workspaceId).catch(() => {});
        socketService.emitToShop(workspaceId, "commande-confirmee", { id: orderId });
        await reply(sender, workspaceId, `✅ Commande ${orderId} confirmée ! Merci 🙏`);
    } else {
        await db.query(`UPDATE commandes SET statut = 'annulée' WHERE id = $1`, [orderId]);
        socketService.emitToShop(workspaceId, "commande-annulee", { id: orderId });
        await reply(sender, workspaceId, `❌ Commande ${orderId} annulée.`);
    }
    return true;
}

// ── Résout le workspace propriétaire de l'instance Green API ──────────
// Fiable uniquement pour une instance personnelle (1 instance = 1 marchand).
// Sur l'instance partagée de dépannage, plusieurs marchands peuvent être
// actifs en même temps — cette fonction ne trouvera jamais rien pour elle
// (aucun connecteur de dépannage n'y stocke d'apiId), ce qui est volontaire :
// voir resolveWorkspaceEntrant ci-dessous pour la vraie résolution.
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

// ── Résout le marchand d'un message entrant ────────────────────────────
// 1) D'abord via une commande WhatsApp en attente pour ce numéro : marche
//    aussi bien sur une instance perso que sur l'instance de dépannage
//    partagée, puisqu'une telle commande n'a pu être créée que par un
//    marchand effectivement autorisé à envoyer au moment de sa création.
// 2) Sinon, repli sur la correspondance instance → marchand — utile pour
//    une question nouvelle du client sur son instance perso, mais qui ne
//    résout jamais rien sur l'instance partagée (ambiguë entre marchands).
async function resolveWorkspaceEntrant(idInstance, sender) {
    try {
        const rows = await db.query(
            `SELECT workspace_id FROM commandes WHERE contact_id = $1 AND source = 'whatsapp' AND statut = 'en attente' ORDER BY created_at DESC LIMIT 1`,
            [sender]
        );
        if (rows[0]?.workspace_id) return rows[0].workspace_id;
    } catch { /* ignore, on retombe sur l'instance */ }
    return await getWorkspaceByInstance(idInstance);
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

        const senderName = senderData.senderName || senderData.chatName || "Client";
        const sender      = (senderData.sender || senderData.chatId || "").replace("@c.us", "");
        const text        = textMessage.trim();

        const workspaceId = await resolveWorkspaceEntrant(idInstance, sender);
        if (!workspaceId) {
            console.log(`⚠️ WhatsApp webhook : marchand introuvable pour idInstance=${idInstance}, sender=${sender}`);
            return;
        }

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

        // Réponse directe à une demande de confirmation de commande en cours —
        // traitée avant le raisonnement Gemini général (action sensible, pas
        // besoin de laisser l'IA l'interpréter).
        const traitee = await traiterReponseConfirmation(sender, workspaceId, text);
        if (traitee) return;

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
