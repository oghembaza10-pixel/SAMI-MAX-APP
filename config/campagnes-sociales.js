// ==========================================================================
// LES CAMPAGNES — CE QUE SAMII A À DIRE
// ==========================================================================
//
// « Il invite les gens à le rejoindre, ou il parle de développement
//   personnel, ou il invite les gens à tester SAMII, il leur dit
//   "laissez-moi piloter votre business". »
//
// ── LE TROU QUE CE FICHIER BOUCHE ─────────────────────────────────────────
//
// Le cycle automatique ne savait raconter qu'UNE chose : un produit du
// catalogue. Un compte qui ne publie que des fiches produit n'intéresse
// personne, et surtout il ne recrute personne — or SAMII a d'abord besoin
// qu'on la rejoigne, pas qu'on achète un casque.
//
// ── POURQUOI UN REGISTRE, ENCORE ──────────────────────────────────────────
//
// Même raison que les plateformes et les formats : ces textes vont être lus
// par le créateur, le sujet de recherche par Pexels, le CTA par
// l'adaptateur. Éparpillés, ils divergent. Ce dépôt a déjà payé ce prix
// trois fois.
//
// ── CE QUE CHAQUE CAMPAGNE DÉCLARE ────────────────────────────────────────
//
//   objectif     ce qu'on veut obtenir — va droit dans le prompt du créateur
//   angle        l'histoire à raconter, jamais un slogan
//   cta          l'action demandée, écrite ici pour ne pas être inventée
//   recherches   les sujets Pexels, plusieurs pour ne pas publier dix fois
//                la même vidéo
//   source       « catalogue » = un vrai produit ; « pexels » = une
//                illustration. C'est ce champ qui décide où la vitrine va
//                chercher le média.
//   poids        la fréquence relative dans la rotation
//   formes       sous quelles FORMES cette campagne peut sortir, et à quelle
//                fréquence chacune : `video`, `image`, `texte`. Voir plus bas.
//
// ── LE TON ────────────────────────────────────────────────────────────────
//
// Écrit pour Douala et l'Afrique francophone, pas pour un communiqué. On
// s'adresse à quelqu'un qui tient une boutique, pas à « une cible ».

const CAMPAGNES = {
    // ── REJOINDRE ────────────────────────────────────────────────────────
    rejoindre: {
        nom: "Rejoindre SAMII",
        objectif: "donner envie à un commerçant de créer son QG sur SAMII",
        angle: "Ce que change le fait d'avoir un assistant qui tient la boutique "
             + "pendant qu'on dort : les commandes qui arrivent la nuit sont "
             + "prises, les clients ont une réponse, rien ne se perd.",
        cta: "Crée ton QG gratuitement",
        // Plusieurs, et volontairement concrets : « business » rend des
        // photos de bureau américain, « african entrepreneur » rend des
        // gens à qui nos marchands ressemblent.
        recherches: [
            "african entrepreneur working",
            "small business owner phone",
            "young african woman laptop",
            "market vendor smartphone",
        ],
        source: "pexels",
        poids: 3,
        formes: { video: 3, image: 2, texte: 1 },
    },

    // ── ESSAYER ──────────────────────────────────────────────────────────
    //
    // « Laissez-moi piloter votre business » — la phrase est de lui, elle est
    // gardée telle quelle : c'est la promesse, pas une reformulation.
    essayer: {
        nom: "Essayer SAMII",
        objectif: "faire essayer SAMII maintenant, sans engagement ni carte bancaire",
        angle: "« Laissez-moi piloter votre business. » Montrer ce que SAMII fait "
             + "en une journée : elle répond aux clients, enregistre les commandes, "
             + "relance les paniers oubliés, suit les colis. Une chose concrète, "
             + "pas une liste de fonctionnalités.",
        cta: "Essaie SAMII aujourd'hui",
        recherches: [
            "technology interface futuristic",
            "artificial intelligence screen",
            "person using smartphone night",
            "data dashboard screen",
        ],
        source: "pexels",
        poids: 3,
        formes: { video: 3, image: 2, texte: 1 },
    },

    // ── DÉVELOPPEMENT PERSONNEL ──────────────────────────────────────────
    //
    // La campagne qui ne vend rien. Elle existe parce qu'un compte qui ne
    // fait que vendre se fait ignorer : il faut donner avant de demander.
    developpement: {
        nom: "Développement personnel",
        objectif: "apporter quelque chose d'utile sans rien vendre, pour être suivi",
        angle: "Une idée courte et applicable aujourd'hui sur la discipline, "
             + "l'organisation, la gestion du temps ou la persévérance quand on "
             + "entreprend seul. Pas de citation de milliardaire américain : "
             + "quelque chose qu'un commerçant de Douala peut faire demain matin.",
        // Pas de vente : le seul appel est de rester.
        cta: "Abonne-toi pour la suite",
        recherches: [
            "sunrise motivation running",
            "person writing notebook morning",
            "focused work desk minimal",
            "african city morning street",
        ],
        source: "pexels",
        poids: 2,
        // Une idée utile se lit très bien sans image. C'est la campagne où
        // le texte seul est le plus légitime.
        formes: { video: 2, image: 2, texte: 3 },
    },

    // ── UN PRODUIT ───────────────────────────────────────────────────────
    //
    // Celle qui existait déjà. Elle garde sa place, avec un poids plus
    // faible : c'est la seule qui demande quelque chose au lecteur.
    produit: {
        nom: "Un produit du catalogue",
        objectif: "faire découvrir un produit disponible maintenant",
        angle: null,   // l'angle vient du produit lui-même
        cta: "Commande dans ton QG",
        recherches: [],
        source: "catalogue",
        // Jamais en texte seul : « voici un manteau à 12,94 € » sans photo
        // ne vend rien. Et le catalogue n'a aucune vidéo (vérifié : 0 sur
        // 203 annonces) — d'où `video: 0`, qui évite un tirage voué au repli.
        poids: 2,
        formes: { video: 0, image: 3, texte: 0 },
    },
};

const ORDRE = ["rejoindre", "essayer", "developpement", "produit"];

function existe(slug) {
    return Object.prototype.hasOwnProperty.call(CAMPAGNES, String(slug || "").toLowerCase());
}

function get(slug) {
    const propre = String(slug || "").toLowerCase();
    return existe(propre) ? { slug: propre, ...CAMPAGNES[propre] } : null;
}

function liste() {
    return ORDRE.filter(existe).map((slug) => ({ slug, ...CAMPAGNES[slug] }));
}

// ── COUPER UNE CAMPAGNE DEPUIS RENDER ─────────────────────────────────────
//
//     SOCIAL_CAMPAGNES_COUPEES=developpement
//
// Lu à chaque appel. Si un sujet part de travers un dimanche, on le coupe
// sans déploiement — comme les plateformes et les formats.
function estCoupee(slug) {
    const coupees = String(process.env.SOCIAL_CAMPAGNES_COUPEES || "")
        .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return coupees.includes(String(slug || "").toLowerCase());
}

function listeActives() {
    return liste().filter((c) => !estCoupee(c.slug));
}

// ── CHOISIR LA PROCHAINE ──────────────────────────────────────────────────
//
// `dejaFaites` porte ce qui est déjà parti aujourd'hui. Une campagne qui
// vient de passer est écartée : sans ça, le tirage pondéré sort deux fois
// « rejoindre » de suite un jour sur trois, et ça se voit.
//
// Si TOUT est déjà passé, on rouvre : mieux vaut répéter un sujet que ne
// rien publier.
function choisir({ dejaFaites = [] } = {}) {
    const actives = listeActives();
    if (!actives.length) return { ok: false, raison: "toutes les campagnes sont coupées" };

    const fraiches = actives.filter((c) => !dejaFaites.includes(c.slug));
    const bassin = fraiches.length ? fraiches : actives;

    // Tirage pondéré : `poids` est le nombre de tickets.
    const tickets = [];
    for (const c of bassin) {
        for (let i = 0; i < Math.max(1, c.poids || 1); i++) tickets.push(c);
    }
    const retenue = tickets[Math.floor(Math.random() * tickets.length)];

    return {
        ok: true,
        campagne: retenue,
        repetition: !fraiches.length
            ? "toutes les campagnes sont déjà passées aujourd'hui — on recommence"
            : null,
    };
}

// ── SOUS QUELLE FORME ON SORT AUJOURD'HUI ─────────────────────────────────
//
// « Il n'est pas obligé de faire que des vidéos. Il peut de temps en temps
//   faire des posts directement, juste l'écriture. »
//
// Avant, le cycle demandait TOUJOURS `prefererVideo: true`. Trois
// conséquences, toutes mauvaises :
//
//   1. un fil qui n'est que de la vidéo se lit comme une chaîne, pas comme
//      quelqu'un qui parle ;
//   2. chaque passage consommait un appel Pexels même quand le texte seul
//      aurait été meilleur — du quota brûlé pour rien ;
//   3. une idée de développement personnel est SOUVENT plus forte nue. Lui
//      coller une photo de lever de soleil l'affaiblit.
//
// La forme est tirée au sort, pondérée, et déclarée par la campagne : c'est
// elle qui sait si elle supporte le texte seul. Un poids à 0 exclut la
// forme — « produit » ne part jamais sans photo.
const FORMES = ["video", "image", "texte"];

// L'arrêt d'urgence, même geste que pour les plateformes et les campagnes :
//     SOCIAL_FORMES_COUPEES=texte
function formeEstCoupee(forme) {
    const coupees = String(process.env.SOCIAL_FORMES_COUPEES || "")
        .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return coupees.includes(String(forme || "").toLowerCase());
}

function formesDe(slug) {
    const c = get(slug);
    // Sans déclaration, on garde l'ancien comportement — vidéo d'abord.
    // Une campagne ajoutée demain sans y penser ne doit pas se retrouver
    // muette.
    return c?.formes || { video: 3, image: 2, texte: 0 };
}

function choisirForme(slug) {
    const poids = formesDe(slug);
    const tickets = [];
    for (const f of FORMES) {
        if (formeEstCoupee(f)) continue;
        for (let i = 0; i < Math.max(0, Number(poids[f]) || 0); i++) tickets.push(f);
    }
    // Tout est à 0 ou tout est coupé : on ne renvoie pas `undefined`, qui
    // ferait planter l'appelant. « image » est le plus petit dénominateur
    // commun — toutes les plateformes l'acceptent.
    if (!tickets.length) return { forme: "image", parDefaut: true };
    return { forme: tickets[Math.floor(Math.random() * tickets.length)], parDefaut: false };
}

// Le sujet de recherche Pexels, tiré au sort parmi ceux de la campagne.
// Écrit ici plutôt que dans le cycle : c'est une propriété de la campagne.
function recherche(slug) {
    const c = get(slug);
    if (!c || !c.recherches?.length) return null;
    return c.recherches[Math.floor(Math.random() * c.recherches.length)];
}

module.exports = {
    CAMPAGNES, ORDRE, FORMES,
    existe, get, liste, listeActives, estCoupee, choisir, recherche,
    formesDe, choisirForme, formeEstCoupee,
};
