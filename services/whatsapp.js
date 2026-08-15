/**
 * ============================================================
 * OG • WhatsApp Service
 * ============================================================
 */

const axios             = require("axios");
const CONFIG            = require("../config");
const orchestrator      = require("../brain/orchestrator");
const connectorService  = require("./connectorService");
const notify            = require("./notify");

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

// ── CREDENTIALS : instance perso du marchand, ou dépannage (3 jours, choisi
// explicitement par le marchand) sur le canal partagé SAMII. Plus de repli
// automatique implicite : un marchand qui n'a rien connecté n'envoie rien —
// le numéro partagé ne peut techniquement servir qu'un marchand actif à la
// fois côté réception (voir routes/webhook-whatsapp.js), donc il ne doit
// jamais s'activer sans un choix explicite et limité dans le temps.
async function resolveCredentials(workspaceId) {
    if (!workspaceId) return { instanceId: null, apiToken: null };
    try {
        // Le formulaire générique /connect/whatsapp (routes/connector.js)
        // enregistre { apiId, apiToken } — mêmes noms que tous les autres
        // transporteurs de la boucle TRANSPORTEUR_TOOLS.
        const connecteur = await connectorService.getOne(workspaceId, "whatsapp");
        if (!connecteur?.actif) return { instanceId: null, apiToken: null };

        const { apiId, apiToken, mode, expiresAt } = connecteur.config || {};
        if (apiId && apiToken) {
            return { instanceId: apiId, apiToken };
        }
        if (mode === "depannage" && expiresAt && new Date(expiresAt).getTime() > Date.now()) {
            return { instanceId: CONFIG.WHATSAPP.INSTANCE, apiToken: CONFIG.WHATSAPP.API_KEY, depannage: true };
        }
    } catch (err) {
        console.error("❌ WhatsApp resolveCredentials :", err.message);
    }
    return { instanceId: null, apiToken: null };
}

// ── PRÉVENIR LE MARCHAND AVANT LA FIN DU DÉPANNAGE ─────────────────────────
// Appelée en tâche de fond (non-bloquant) depuis une page visitée souvent
// (le QG) plutôt que par une tâche planifiée — pas de cron dans cette appli,
// et ça reste largement assez réactif pour un délai de 3 jours. Chaque
// avertissement (bientôt fini / terminé) ne part qu'une seule fois, marqué
// dans le connecteur pour ne pas spammer à chaque rafraîchissement du QG.
async function verifierEtNotifierDepannage(workspaceId) {
    if (!workspaceId) return;
    try {
        const connecteur = await connectorService.getOne(workspaceId, "whatsapp");
        const config = connecteur?.config;
        if (!connecteur?.actif || config?.mode !== "depannage" || !config.expiresAt) return;

        const restant = new Date(config.expiresAt).getTime() - Date.now();

        if (restant <= 0) {
            if (config.warnedExpired) return;
            await notify.notifyWorkspace(workspaceId, {
                title: "❌ WhatsApp dépannage terminé",
                body: "Le numéro de secours n'est plus actif — connecte ton propre WhatsApp pour continuer à recevoir les confirmations automatiques.",
                url: "/connect/whatsapp",
            });
            await connectorService.save(workspaceId, "whatsapp", { warnedExpired: true });
            return;
        }

        if (restant <= UN_JOUR_MS && !config.warned) {
            await notify.notifyWorkspace(workspaceId, {
                title: "⏳ WhatsApp dépannage bientôt terminé",
                body: "Il te reste moins d'un jour sur le numéro partagé — connecte ton propre WhatsApp pour ne pas perdre les confirmations automatiques.",
                url: "/connect/whatsapp",
            });
            await connectorService.save(workspaceId, "whatsapp", { warned: true });
        }
    } catch (err) {
        console.error("❌ WhatsApp verifierEtNotifierDepannage :", err.message);
    }
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

module.exports = { send, message, demanderConfirmation, verifierEtNotifierDepannage };
