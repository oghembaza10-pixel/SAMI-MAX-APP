/**
 * ============================================================
 * OG • Bootstrap
 * Démarre SAMII OS et enregistre tous les handlers
 * ============================================================
 */
const notificationEngine = require("../engines/notificationEngine");
const telegram           = require("../services/telegramService");
const whatsapp           = require("../services/whatsapp");
const instagram          = require("../services/instagram");
const facebook           = require("../services/facebook");
const gmail              = require("../services/gmail");
const stripe             = require("../services/stripe");
const paypal             = require("../services/paypal");
const yalidine           = require("../services/yalidine");
const sereniteEngine     = require("../engines/sereniteEngine");
const scheduler          = require("./scheduler");
const ambassadeurEngine  = require("../engines/ambassadeurEngine");

function registerChannels() {
    notificationEngine.register("telegram", {
        send: async ({ to, message }) => telegram.send(to, message)
    });
    notificationEngine.register("whatsapp", {
        send: async ({ to, message }) => whatsapp.send({ to, message })
    });
    notificationEngine.register("instagram", {
        send: async ({ to, message }) => instagram.send({ to, message })
    });
    notificationEngine.register("facebook", {
        send: async ({ to, message }) => facebook.send({ to, message })
    });
    notificationEngine.register("email", {
        send: async ({ to, message }) => gmail.send({ to, message })
    });
    notificationEngine.register("stripe", {
        send: async ({ to, message }) => stripe.send({ to, message })
    });
    notificationEngine.register("paypal", {
        send: async ({ to, message }) => paypal.send({ to, message })
    });
    notificationEngine.register("yalidine", {
        send: async ({ to, message }) => yalidine.send({ to, message })
    });
    console.log("✅ Tous les canaux enregistrés");
}

function registerScheduledJobs() {
    scheduler.add("0 10 * * *", "Ambassadeur - offres VIP quotidiennes", ambassadeurEngine.runDaily);
    scheduler.start();
}

module.exports = { registerChannels, registerScheduledJobs };
