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
    // Contrairement à pageEngine (compte officiel OG uniquement) : vérifie
    // TOUS les workspaces marchands ayant activé /autopost, chacun selon sa
    // propre fréquence (voir engines/autopostEngine.js).
    const autopostEngine = require("../engines/autopostEngine");
    scheduler.add("0 * * * *", "Auto-post marchand - vérification horaire", autopostEngine.runCheck);

    // ── LES AGENTS SOCIAUX ────────────────────────────────────────────────
    //
    // Sans ces trois lignes, SOCIAL_MODE=AUTO ne changeait presque rien :
    // la chaîne savait préparer et programmer, mais personne ne l'appelait,
    // et `publisher.passer()` n'était branché nulle part. SAMII attendait un
    // clic humain — c'est-à-dire l'inverse de ce qu'on lui demande.
    //
    // Les trois tâches vérifient le mode elles-mêmes : en MANUAL elles
    // tournent et ne font rien. Il n'y a donc pas deux endroits où le mode
    // est décidé, et couper AUTO depuis Render suffit à tout arrêter.
    const socialCycle = require("../engines/social/cycle");
    // Toutes les 5 minutes : expédie ce qui est dû. Rythme court exprès —
    // un contenu programmé pour 14 h doit partir à 14 h, pas à 15 h.
    scheduler.add("*/5 * * * *", "Agents sociaux - envoi de ce qui est dû", socialCycle.envoyer);
    // Toutes les heures : le cycle décide lui-même si l'heure est une heure
    // de publication (SOCIAL_HEURES) et si le plafond du jour est atteint.
    scheduler.add("5 * * * *", "Agents sociaux - préparation automatique", socialCycle.preparer);
    // Les statistiques, quand un collecteur existera.
    scheduler.add("0 */6 * * *", "Agents sociaux - relevé des statistiques", socialCycle.mesurer);

    scheduler.start();
}

module.exports = { registerChannels, registerScheduledJobs, registerTrackingProviders };
