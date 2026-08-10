// ==========================================================================
// SAMII OS — WEB PUSH (notifications PWA — désactivé tant que pas de clés)
// ==========================================================================
const webpush = require("web-push");
const CONFIG = require("../config");

function isEnabled() {
    return !!(CONFIG.VAPID?.PUBLIC_KEY && CONFIG.VAPID?.PRIVATE_KEY);
}

if (isEnabled()) {
    webpush.setVapidDetails(CONFIG.VAPID.SUBJECT, CONFIG.VAPID.PUBLIC_KEY, CONFIG.VAPID.PRIVATE_KEY);
}

/**
 * Envoie une notification push à un seul abonnement. Si l'abonnement n'est
 * plus valide (410/404 — l'utilisateur a désinstallé/désactivé), le retour
 * l'indique pour que l'appelant puisse le supprimer de la base.
 */
async function sendNotification(subscription, payload) {
    if (!isEnabled()) return { success: false, error: "VAPID non configuré." };
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        return { success: true };
    } catch (err) {
        const expired = err.statusCode === 404 || err.statusCode === 410;
        console.error("❌ Web Push :", err.statusCode || "", err.message);
        return { success: false, error: err.message, expired };
    }
}

module.exports = { isEnabled, sendNotification };
