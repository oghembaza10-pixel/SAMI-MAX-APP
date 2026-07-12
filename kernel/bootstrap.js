/**
 * ============================================================
 * OG • Bootstrap
 * Démarre SAMII OS et enregistre tous les handlers
 * ============================================================
 */

const notificationEngine = require("../engines/notificationEngine");
const telegramService    = require("../services/telegramService");

// ── ENREGISTRE LES CANAUX ────────────────────────────
function registerChannels() {

    // Telegram
    notificationEngine.register("telegram", {
        send: async ({ to, message }) => {
            await telegramService.send(to, message);
        }
    });

    // WhatsApp — activé quand GrindAPI est prêt
    notificationEngine.register("whatsapp", {
        send: async ({ to, message }) => {
            console.log(`📱 WhatsApp → ${to} : ${message}`);
            // await whatsappService.send(to, message);
        }
    });

    // Email — activé quand Gmail est prêt
    notificationEngine.register("email", {
        send: async ({ to, message }) => {
            console.log(`📧 Email → ${to} : ${message}`);
            // await gmailService.send(to, message);
        }
    });

    // Meta — activé quand Meta API est prête
    notificationEngine.register("meta", {
        send: async ({ to, message }) => {
            console.log(`📘 Meta → ${to} : ${message}`);
            // await metaService.send(to, message);
        }
    });

    console.log("✅ Tous les canaux enregistrés");
}

module.exports = { registerChannels };

