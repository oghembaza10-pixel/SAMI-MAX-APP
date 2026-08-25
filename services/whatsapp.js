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
const fournisseurs      = require("./whatsappFournisseurs");

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

// ── CREDENTIALS : instance perso du marchand, ou dépannage (3 jours, choisi
// explicitement par le marchand) sur le canal partagé SAMII. Plus de repli
// automatique implicite : un marchand qui n'a rien connecté n'envoie rien —
// le numéro partagé ne peut techniquement servir qu'un marchand actif à la
// fois côté réception (voir routes/webhook-whatsapp.js), donc il ne doit
// jamais s'activer sans un choix explicite et limité dans le temps.
async function resolveCredentials(workspaceId) {
    if (!workspaceId) return null;
    try {
        const connecteur = await connectorService.getOne(workspaceId, "whatsapp");
        if (!connecteur?.actif) return null;

        const config = connecteur.config || {};

        // Une config complète l'emporte toujours, quel que soit le fournisseur
        // (Green API, Meta Cloud en direct, 360dialog) — c'est
        // services/whatsappFournisseurs.js qui sait lequel c'est.
        if (fournisseurs.estComplete(config)) return config;

        // Dépannage : le canal partagé SAMII, choisi explicitement et limité à
        // trois jours. Toujours du Green API.
        if (config.mode === "depannage" && config.expiresAt && new Date(config.expiresAt).getTime() > Date.now()) {
            return {
                fournisseur: "green",
                apiId: CONFIG.WHATSAPP.INSTANCE,
                apiToken: CONFIG.WHATSAPP.API_KEY,
                depannage: true,
            };
        }
    } catch (err) {
        console.error("❌ WhatsApp resolveCredentials :", err.message);
    }
    return null;
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
// Le fournisseur du marchand décide du transport ; l'appelant n'a jamais à le
// savoir. Le canal officiel OG Technology reste un cas à part : son numéro est
// déclaré en variables d'environnement, pas dans un connecteur.
async function send({ to, message, workspaceId }) {
    if (workspaceId && workspaceId === CONFIG.META.OG_WORKSPACE_ID) {
        const { TOKEN, PHONE_NUMBER_ID } = CONFIG.META.WHATSAPP_CLOUD;
        if (!TOKEN || !PHONE_NUMBER_ID) {
            console.warn("⚠️ WhatsApp Cloud API non configuré (token ou numéro manquant)");
            return { success: false };
        }
        return await fournisseurs.envoyer(
            { fournisseur: "cloud", phoneNumberId: PHONE_NUMBER_ID, token: TOKEN },
            { to, message },
        );
    }

    const config = await resolveCredentials(workspaceId);
    if (!config) {
        console.warn(`⚠️ WhatsApp non configuré (workspace ${workspaceId || "?"})`);
        return { success: false };
    }
    return await fournisseurs.envoyer(config, { to, message });
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

module.exports = { send, message, demanderConfirmation, verifierEtNotifierDepannage, resolveCredentials };
