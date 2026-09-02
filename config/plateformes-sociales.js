// ==========================================================================
// LE REGISTRE DES PLATEFORMES SOCIALES
// ==========================================================================
//
// ── POURQUOI UN REGISTRE, ET PAS DES `if (plateforme === "instagram")` ────
//
// Ce dépôt a déjà payé le prix de la règle recopiée : la décision « faut-il
// du TLS » était écrite deux fois, les deux copies ont divergé, et SAMII ne
// pouvait plus démarrer sur une base sans TLS sans que personne le voie.
//
// Les contraintes des plateformes sont exactement le même piège. La limite
// de caractères de Twitter/X, le nombre maximum de hashtags Instagram, le
// fait que TikTok exige une vidéo : si ces règles sont éparpillées dans
// l'agent d'adaptation, dans le relecteur ET dans le publieur, elles
// divergeront. Elles vivent donc ICI, une seule fois, et les trois les
// lisent.
//
// Ajouter une plateforme = ajouter une entrée ici + un provider. Rien
// d'autre à toucher.
//
// ── LES LIMITES SONT DES REPÈRES, PAS DES VÉRITÉS ÉTERNELLES ──────────────
//
// Ces chiffres viennent de la documentation publique des plateformes et
// changent sans prévenir. Ils servent à ce que SAMII écrive du contenu
// *plausible* pour chaque endroit, pas à garantir qu'une publication
// passera. La vraie validation vient de la plateforme, au moment de
// publier — c'est pour ça que `social_publications` garde le message
// d'erreur exact qu'elle renvoie.

const PLATEFORMES = {
    facebook: {
        nom: "Facebook",
        // « fil » = on publie sur une page, visible par tous.
        // « message » = on écrit à une personne. Ce n'est PAS la même chose,
        // et les confondre est la première erreur qu'on ferait ici :
        // `services/facebook.js` fait des messages Messenger, pas des posts.
        genre: "fil",
        maxCaracteres: 63206,
        // Longueur VISÉE, pas la limite : un post Facebook de 60 000 signes
        // est autorisé et illisible.
        longueurVisee: [400, 1200],
        hashtagsMax: 5,
        mediaRequis: false,
        mediaAccepte: ["image", "video"],
        ton: "développé, narratif, on peut poser le contexte",
        approbationMeta: true,   // dépend des permissions accordées par Meta
    },
    instagram: {
        nom: "Instagram",
        genre: "fil",
        maxCaracteres: 2200,
        longueurVisee: [80, 400],
        hashtagsMax: 30,
        // Une publication Instagram SANS image n'existe pas. Le relecteur
        // s'en sert pour refuser avant d'appeler l'API et de se prendre une
        // erreur illisible.
        mediaRequis: true,
        mediaAccepte: ["image", "video"],
        ton: "visuel d'abord, légende courte, émotion",
        approbationMeta: true,
    },
    tiktok: {
        nom: "TikTok",
        genre: "fil",
        maxCaracteres: 2200,
        longueurVisee: [30, 150],
        hashtagsMax: 5,
        mediaRequis: true,
        mediaAccepte: ["video"],   // uniquement de la vidéo
        ton: "accroche dans les 3 premières secondes, direct, parlé",
        approbationMeta: false,
    },
    linkedin: {
        nom: "LinkedIn",
        genre: "fil",
        maxCaracteres: 3000,
        longueurVisee: [500, 1500],
        hashtagsMax: 5,
        mediaRequis: false,
        mediaAccepte: ["image", "video"],
        ton: "professionnel, B2B, un enseignement ou un chiffre, jamais de familiarité",
        approbationMeta: false,
    },
    telegram: {
        nom: "Telegram",
        genre: "fil",
        maxCaracteres: 4096,
        longueurVisee: [200, 800],
        hashtagsMax: 3,
        mediaRequis: false,
        mediaAccepte: ["image", "video"],
        ton: "message à une communauté qui te connaît déjà, direct, sans vendre",
        approbationMeta: false,
    },
    whatsapp: {
        nom: "WhatsApp",
        // « message » : on écrit à quelqu'un. Une publication WhatsApp n'est
        // pas un post public — c'est un message envoyé à une liste. Le
        // marquer ici évite qu'un agent traite WhatsApp comme un fil.
        genre: "message",
        maxCaracteres: 4096,
        longueurVisee: [100, 400],
        hashtagsMax: 0,           // personne ne met de hashtag dans un WhatsApp
        mediaRequis: false,
        mediaAccepte: ["image", "video"],
        ton: "conversation, on s'adresse à une personne, jamais un communiqué",
        approbationMeta: false,
    },
    messenger: {
        nom: "Messenger",
        genre: "message",
        maxCaracteres: 2000,
        longueurVisee: [80, 300],
        hashtagsMax: 0,
        mediaRequis: false,
        mediaAccepte: ["image"],
        ton: "conversation, court, une seule idée par message",
        approbationMeta: true,
    },
};

// L'ordre d'affichage et de traitement. Explicite, parce que
// `Object.keys()` sur un objet ne garantit rien de lisible pour un humain,
// et parce qu'on veut les fils publics avant les messages privés.
const ORDRE = ["facebook", "instagram", "tiktok", "linkedin", "telegram", "whatsapp", "messenger"];

function existe(slug) {
    return Object.prototype.hasOwnProperty.call(PLATEFORMES, String(slug || "").toLowerCase());
}

function get(slug) {
    const propre = String(slug || "").toLowerCase();
    return PLATEFORMES[propre] || null;
}

function liste() {
    return ORDRE.filter(existe).map((slug) => ({ slug, ...PLATEFORMES[slug] }));
}

// Les fils publics d'un côté, les messageries de l'autre : plusieurs agents
// ont besoin de cette distinction et aucun ne doit la redéduire lui-même.
function lesFils() {
    return liste().filter((p) => p.genre === "fil");
}
function lesMessageries() {
    return liste().filter((p) => p.genre === "message");
}

// ── COUPER UNE PLATEFORME, SANS DÉPLOIEMENT ───────────────────────────────
//
// « possibilité de désactiver chaque plateforme ».
//
// Une variable d'environnement, lue à chaque appel (pas mise en cache au
// chargement) : si TikTok se met à refuser tout ce qu'on lui envoie un
// dimanche, on la coupe depuis Render sans toucher au code.
//
//     SOCIAL_PLATEFORMES_COUPEES=tiktok,linkedin
function estCoupee(slug) {
    const coupees = String(process.env.SOCIAL_PLATEFORMES_COUPEES || "")
        .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return coupees.includes(String(slug || "").toLowerCase());
}

function listeActives() {
    return liste().filter((p) => !estCoupee(p.slug));
}

module.exports = {
    PLATEFORMES, ORDRE,
    existe, get, liste, lesFils, lesMessageries,
    estCoupee, listeActives,
};
