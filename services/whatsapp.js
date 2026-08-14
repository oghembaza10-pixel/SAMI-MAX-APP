/**
 * ============================================================
 * OG • WhatsApp Service
 * ============================================================
 */

const axios             = require("axios");
const CONFIG            = require("../config");
const orchestrator      = require("../brain/orchestrator");
const connectorService  = require("./connectorService");

// ── CREDENTIALS : instance du marchand en priorité, sinon canal global SAMII ──
async function resolveCredentials(workspaceId) {
    if (workspaceId) {
        try {
            // Le formulaire générique /connect/whatsapp (routes/connector.js)
            // enregistre { apiId, apiToken } — mêmes noms que tous les autres
            // transporteurs de la boucle TRANSPORTEUR_TOOLS.
            const connecteur = await connectorService.getOne(workspaceId, "whatsapp");
            const { apiId, apiToken } = connecteur?.config || {};
            if (connecteur?.actif && apiId && apiToken) {
                return { instanceId: apiId, apiToken };
            }
        } catch (err) {
            console.error("❌ WhatsApp resolveCredentials :", err.message);
        }
    }
    return { instanceId: CONFIG.WHATSAPP.INSTANCE, apiToken: CONFIG.WHATSAPP.API_KEY };
}

// ── ENVOIE UN MESSAGE ────────────────────────────────
async function send({ to, message, workspaceId }) {
    try {
        const { instanceId, apiToken } = await resolveCredentials(workspaceId);
        if (!to || !instanceId || !apiToken) {
            console.warn("⚠️ WhatsApp non configuré");
            return { success: false };
        }

        await axios.post(
            `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`,
            { chatId: `${to}@c.us`, message }
        );

        console.log(`✅ WhatsApp → ${to}`);
        return { success: true };

    } catch (err) {
        console.error("❌ WhatsApp send :", err.message);
        return { success: false, error: err.message };
    }
}

// ── CONFIRMATION OUI/NON (demandée directement au client) ──────────────────
async function demanderConfirmation(to, commande, workspaceId) {
    const prenom  = commande.client   || "cher client";
    const total   = commande.total    || 0;
    const produit = commande.produits || "";

    const texte =
        `Bonjour ${prenom} 👋\n\n` +
        `Merci pour votre commande ! 🙏\n\n` +
        `📦 ${produit}\n` +
        `💰 Total : ${total} DZD\n\n` +
        `Confirmez-vous votre commande ?\n` +
        `Répondez *OUI* pour confirmer ou *NON* pour annuler.`;

    return await send({ to, message: texte, workspaceId });
}

// ── REÇOIT UN MESSAGE → ORCHESTRATOR ────────────────
async function message(msg) {
    await orchestrator.process({
        type   : "whatsapp.message",
        shop   : msg.shop || "",
        payload: msg,
    });
}

module.exports = { send, message, demanderConfirmation };
