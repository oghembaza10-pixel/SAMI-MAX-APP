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
const stripe              = require("../services/stripe");
const paypal             = require("../services/paypal");
const yalidine           = require("../services/yalidine");
const scheduler          = require("./scheduler");
const ambassadeurEngine  = require("../engines/ambassadeurEngine");
const sereniteEngine     = require("../engines/sereniteEngine");
const messagerEclairEngine = require("../engines/messagerEclairEngine");
const abonnementEngine    = require("../engines/abonnementEngine");
const canalEngine         = require("../engines/canalEngine");
const trackingRegistry   = require("../services/tracking");
const yalidineTracking   = require("../services/tracking/yalidine");
const universalTracking  = require("../services/tracking/universal");

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

function registerTrackingProviders() {
    // Yalidine — clé perso marchand en priorité, bascule interne vers 17TRACK si absente
    trackingRegistry.register("yalidine", yalidineTracking);

    // Transporteurs mondiaux/africains — tous suivis via l'agrégateur 17TRACK
    // (aucun n'a d'API individuelle publique accessible sans compte pro dédié)
    const transporteursUniversels = [
        "amana", "ctm", "dhl", "aramex",
        "colissimo", "chronopost", "mondialrelay", "dpd", "ups",
    ];
    transporteursUniversels.forEach(id => {
        trackingRegistry.register(id, universalTracking);
    });

    console.log("✅ Transporteurs de suivi enregistrés :", trackingRegistry.list().join(", "));
}

function registerScheduledJobs() {
    scheduler.add("0 10 * * *", "Ambassadeur - offres VIP quotidiennes", ambassadeurEngine.runDaily);
    scheduler.add("0 22 * * *", "Sérénité - rapport quotidien apaisé", sereniteEngine.runDaily);
    scheduler.add("0 * * * *", "Messager Éclair - vérification colis", messagerEclairEngine.runCheck);
    const guerreEngine = require("../engines/guerreEngine");
scheduler.add("0 9 * * *", "Guerre - compte à rebours communauté", guerreEngine.runDaily);
    scheduler.add("0 8 * * *", "Abonnement - rappel de renouvellement", abonnementEngine.runDailyRenewalCheck);
    scheduler.add("0 12 * * *", "Canal SAMII - post promo quotidien", canalEngine.runDaily);
    const pageEngine = require("../engines/pageEngine");
    scheduler.add("0 9,14,19 * * *", "Page Facebook - 3 posts/jour", pageEngine.runFacebook);
    scheduler.add("15 9,14,19 * * *", "Page Instagram - 3 posts/jour", pageEngine.runInstagram);
    const communityEngine = require("../engines/communityEngine");
    scheduler.add("30 11,18 * * *", "Tchat général - sujet SAMII 2x/jour", communityEngine.run);
    scheduler.start();
}

module.exports = { registerChannels, registerScheduledJobs, registerTrackingProviders };
