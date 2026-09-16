// ==========================================================================
// SAMII OS — LES MÉTIERS : LA PORTE D'ENTRÉE GOOGLE
// ==========================================================================
//
// LE PROBLÈME QUE CES PAGES RÉSOLVENT.
//
// « / » est devenu le chat. C'est ce qu'il fallait pour convertir, mais un
// champ de saisie ne se classe sur aucune recherche : il n'y a rien à
// indexer. Le chat convertit les gens qui arrivent ; il ne les fait pas
// arriver. Ces pages-ci sont l'autre moitié — elles portent le texte que
// Google lit, et chacune repart vers SAMII.
//
// POURQUOI PAS DANS LE HUB.
//
// Le Hub (routes/hub.js) regroupe bien des métiers, et c'était le premier
// endroit à regarder. Mais il est en requireAuth et renvoie les comptes
// client ailleurs : Googlebot n'a pas de session, il ne le verra jamais. Son
// propre en-tête le dit — « Le Hub sélectionne le Workspace. Il ne contient
// aucune logique métier. » Le Hub choisit un espace de travail existant ;
// ces pages s'adressent à quelqu'un qui n'a encore rien.
//
// CE QUI N'EST PAS DUPLIQUÉ.
//
// Tout vient de services/metiers.js, la source unique déjà consommée par
// l'onboarding, l'agence et l'API. Aucune liste n'est recopiée, aucune
// seconde vérité n'est créée. Et la sortie « ouvrir mon QG » pointe sur
// /workspace/create?metier=<id>, la route de création qui existait déjà et
// qui sait pré-remplir le métier : rien de neuf n'a été inventé pour ça.
// ==========================================================================
const express = require("express");
const router = express.Router();
const metiers = require("../services/metiers");
const CONFIG = require("../config");

// L'adresse canonique vient d'APP_URL, la même que celle utilisée par les
// redirections OAuth. Une URL canonique doit être STABLE : la déduire de
// l'en-tête Host ferait qu'un même contenu s'annonce sous deux adresses
// (domaine et adresse Render brute), et Google les traiterait comme deux
// pages en concurrence.
const BASE = String(CONFIG.APP_URL || "").replace(/\/+$/, "");

// ── LE HUB PUBLIC ────────────────────────────────────────────────────────
router.get("/", (req, res) => {
    res.render("metiers", {
        loggedIn: !!req.session?.loggedIn,
        typeCompte: req.session?.typeCompte || "client",
        groupes: metiers.parGroupe(),
        base: BASE,
        // Le hub n'en avait pas, alors que ses trente-quatre fiches en ont
        // une. Mesuré : /metiers, /metiers?lang=en et /metiers?lang=ar
        // répondaient 200 avec le même contenu et aucune canonique — trois
        // adresses indexables pour une seule page, et c'est celle qui porte
        // la priorité la plus haute du plan du site après l'accueil.
        canonique: `${BASE}/metiers`,
    });
});

// ── LE TITRE, LE H1, ET POURQUOI CE SONT DEUX CHOSES ─────────────────────
//
// Ils étaient la même chaîne, servie aux deux endroits. Deux conséquences
// mesurées sur les trente-quatre fiches :
//
//   1. Le <h1> affiché se terminait par « — SAMII ». C'est un suffixe de
//      balise title ; dans un titre de page, ça se lit comme une coquille.
//   2. Trente titres sur trente-quatre dépassaient 60 caractères (médiane
//      67, maximum 83) : Google les coupait dans ses résultats.
//
// Les deux ne servent pas la même personne. Le <title> s'adresse à quelqu'un
// qui lit une liste de résultats et doit choisir en une seconde : il doit
// tenir. Le <h1> s'adresse à quelqu'un qui vient d'arriver sur la page : il
// peut respirer.
//
// Aucune phrase de métier n'est touchée ici — perte, défaut et réponse
// restent mot pour mot ce que services/metiers.js déclare. Ce qui change est
// la formule de l'enrobage, et elle vit déjà dans ce fichier.
const PROMESSE_LONGUE = {
    rdv: "remplir son agenda sans décrocher le téléphone",
    produit: "vendre en ligne sans perdre ses colis",
};
const PROMESSE_COURTE = {
    rdv: "agenda rempli sans téléphone",
    produit: "vendre sans perdre ses colis",
};
// Trois libellés sont trop longs pour la formule courte — « Électronique /
// Téléphonie » (25 caractères), « Laboratoire d'analyses » et « Hôtel /
// Maison d'hôtes » (22). Plutôt que de raboter le libellé du métier, qui est
// son nom, on raccourcit la promesse pour eux seuls.
const PROMESSE_BREVE = {
    rdv: "agenda en ligne",
    produit: "vendre en ligne",
};
const LIMITE_TITRE = 60;

function titreEtH1(fiche, L) {
    const label = L(fiche.label);
    const parcours = fiche.parcours === "rdv" ? "rdv" : "produit";
    const court = `${label} : ${L(PROMESSE_COURTE[parcours])} — SAMII`;
    return {
        titre: court.length <= LIMITE_TITRE
            ? court
            : `${label} : ${L(PROMESSE_BREVE[parcours])} — SAMII`,
        // Le H1 garde la phrase complète, et perd « — SAMII ».
        h1: `${label} : ${L(PROMESSE_LONGUE[parcours])}`,
    };
}

// ══════════════════════════════════════════════════════════════════════════
// LE BLOC COMMUN — DEUX VARIANTES, PAS TRENTE-QUATRE
// ══════════════════════════════════════════════════════════════════════════
//
// ── LE PROBLÈME QU'IL RÉSOUT ─────────────────────────────────────────────
//
// Mesuré sur les trente-quatre fiches : 136 à 184 mots de texte visible,
// médiane 154, dont près de la moitié de décor commun. Une page qui tient en
// trois phrases ne se classe pas, même quand ces trois phrases sont justes.
//
// ── POURQUOI DEUX VARIANTES ET NON TRENTE-QUATRE ─────────────────────────
//
// Parce que trente-quatre textes écrits pour remplir seraient trente-quatre
// mensonges polis. La différence réelle entre ces métiers n'est pas
// trente-quatre façons de fonctionner : c'est DEUX. Un dentiste et un avocat
// vendent un créneau ; un restaurant et une boutique vendent un objet qui
// part. `parcours` porte déjà cette distinction, et le QG s'en sert depuis
// longtemps pour afficher un calendrier ou des commandes.
//
// Écrire deux fois la vérité vaut mieux que trente-quatre fois une variation.
// Ce que chaque métier a de PROPRE reste ce qu'il a toujours eu : ses trois
// phrases dans services/metiers.js, et ses mots à lui.
//
// ── CE QUI EST ÉCRIT ICI EST DÉJÀ EN PRODUCTION ──────────────────────────
//
// Aucune capacité annoncée qui n'existe pas : les canaux, le calendrier, la
// confirmation avant expédition et le QG sont ceux que brain/prompts/vitrine
// déclare déjà comme réellement livrés. Un visiteur qui teste doit trouver
// exactement ce qu'on lui a promis.
const ETAPES = {
    rdv: [
        "Votre page montre vos créneaux libres. Le client choisit le sien, à l'heure qui l'arrange, même la nuit.",
        "SAMII confirme tout de suite, inscrit le rendez-vous au calendrier et envoie un rappel la veille.",
        "Une annulation libère le créneau, et SAMII le repropose aux personnes en attente sans que vous fassiez rien.",
        "Vous retrouvez chaque client, son historique et ses prochains rendez-vous dans votre QG, en un seul endroit.",
    ],
    produit: [
        "Le client commande depuis votre page, ou simplement en écrivant sur WhatsApp, Instagram, Telegram ou Messenger.",
        "SAMII répond, note l'article et l'adresse, et fait confirmer la commande avant qu'elle parte.",
        "Le colis part avec son suivi. Le client est prévenu à l'expédition et à l'approche de la livraison.",
        "Vous retrouvez commandes, clients et chiffre d'affaires dans votre QG, en un seul endroit.",
    ],
};

// ── LA FAQ — VISIBLE, ET C'EST TOUT L'INTÉRÊT ────────────────────────────
//
// Elle existait déjà, mais UNIQUEMENT en données structurées : deux questions
// déclarées à Google, jamais montrées au visiteur. C'est exactement ce qu'on
// vient de refuser pour le fil d'Ariane — déclarer un contenu qu'on
// n'affiche pas est du balisage trompeur, et Google le sanctionne.
//
// Elle est donc affichée, et le JSON-LD est construit à partir de CE tableau :
// une seule source, impossible que les deux divergent.
//
// L'ancienne première question — « qu'est-ce que SAMII change pour ce
// métier ? », dont la réponse était `metier.reponse` — a disparu. Affichée,
// elle aurait réimprimé une troisième fois la phrase que l'étape 9a venait
// de dédoubler, et le pavé « Ce que SAMII fait » la dit déjà.
const FAQ_COMMUNE = [{
    q: "Faut-il installer quelque chose ?",
    r: "Non. SAMII fonctionne depuis une page web et depuis WhatsApp. Vos clients n'ont aucune application à télécharger, et vous non plus.",
}];

const FAQ = {
    rdv: [
        {
            q: "Comment les rendez-vous arrivent-ils dans mon agenda ?",
            r: "Le client choisit un créneau que vous avez ouvert. Il s'inscrit au calendrier au moment où il est pris, et vous le voyez arriver en direct dans votre QG.",
        },
        {
            q: "Et si un client annule au dernier moment ?",
            r: "Le créneau redevient libre et SAMII le propose aux personnes en attente. C'est ce qui transforme une annulation en rendez-vous au lieu d'une heure perdue.",
        },
        {
            q: "Est-ce que je garde la main sur mon agenda ?",
            r: "Oui. Vous décidez des horaires ouverts, de la durée des rendez-vous et de ce qui reste fermé. SAMII ne place jamais rien en dehors de ce que vous avez ouvert.",
        },
        ...FAQ_COMMUNE,
    ],
    produit: [
        {
            q: "Comment une commande arrive-t-elle jusqu'à moi ?",
            r: "Depuis votre page, ou depuis un message sur WhatsApp, Instagram, Telegram ou Messenger. SAMII répond, note l'article et l'adresse, et vous la retrouvez écrite dans votre QG.",
        },
        {
            q: "Et si le client ne confirme pas sa commande ?",
            r: "Elle ne part pas. En paiement à la livraison, c'est ce qui évite les colis qui reviennent : SAMII relance, et un colis non confirmé n'est jamais expédié.",
        },
        {
            q: "Je vends déjà sur Instagram, faut-il tout refaire ?",
            r: "Non. Vous connectez le compte que vous avez déjà. Vos messages continuent d'arriver au même endroit, SAMII y répond et range les commandes pour vous.",
        },
        ...FAQ_COMMUNE,
    ],
};

// ── LES MOTS SOUS LESQUELS ON CHERCHE CE MÉTIER ──────────────────────────
//
// `VOCABULAIRE` existe depuis longtemps dans services/metiers.js : ce sont
// les mots avec lesquels un marchand NOMME son activité — « bazin », « wax »,
// « maquis », « shawarma », « riad », « omra », « tresses », « vidange ». Ils
// servaient à reconnaître une phrase libre dans le chat, et n'apparaissaient
// nulle part sur les pages publiques. Or ce sont exactement les mots que les
// gens tapent dans Google.
//
// ── CE QUI EST FAIT, ET CE QUI NE L'EST PAS ──────────────────────────────
//
// Ils sont affichés dans une ligne nommée, courte et bornée. Ce n'est pas du
// bourrage de mots-clés : la liste dit ce qu'elle est, elle est visible, et
// elle est limitée. Un empilement invisible ou une énumération sans fin
// serait précisément ce que Google sanctionne.
//
//   - le mot égal au libellé est retiré : « Dentiste » suivi de
//     « dentiste » n'apprend rien à personne ;
//   - la liste est plafonnée, parce que « prêt-à-porter » en porte quatorze
//     et qu'une ligne de quatorze mots cesse d'être une information ;
//   - « autre » n'a aucun mot, et sa page n'affichera simplement pas ce bloc.
//     Un métier sans vocabulaire est un cas normal, pas une panne.
const MOTS_AFFICHES_MAX = 8;

function motsAffichables(fiche, L) {
    // Le trait d'union compte comme une espace ICI — contrairement à
    // `normaliser()` de services/competences.js, qui le conserve parce qu'il
    // compare des saisies. On compare des LIBELLÉS : « Prêt-à-porter » et
    // « prêt à porter » sont le même mot, et l'afficher sous son propre titre
    // n'apprend rien à personne.
    const sansAccents = (s) => String(s || "").toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’-]/g, " ")
        .replace(/\s+/g, " ").trim();
    const libelle = sansAccents(L(fiche.label));
    return (fiche.mots || [])
        .filter((mot) => sansAccents(mot) !== libelle)
        .slice(0, MOTS_AFFICHES_MAX);
}

// ── LA META DESCRIPTION, TAILLÉE POUR CE QUE GOOGLE AFFICHE ──────────────
//
// Elle était `perte + reponse` coupée à 300 caractères — huit fiches sur
// trente-quatre dépassaient 155, jusqu'à 204. Au-delà, Google coupe et
// choisit lui-même la fin, souvent au milieu d'un mot.
//
// On garde la même matière, dans le même ordre. « perte » passe toujours en
// entier : c'est la phrase qui fait se reconnaître le lecteur. « reponse »
// suit tant qu'elle tient ; sinon elle s'arrête au dernier mot complet.
// Rien n'est réécrit, rien n'est inventé.
const LIMITE_DESCRIPTION = 155;

function descriptionDe(fiche) {
    const complet = `${fiche.perte} ${fiche.reponse}`;
    if (complet.length <= LIMITE_DESCRIPTION) return complet;
    // −1 pour l'espace qui suit `perte`, −1 pour le caractère de suite.
    const place = LIMITE_DESCRIPTION - fiche.perte.length - 2;
    const bout = fiche.reponse.slice(0, place);
    const coupe = bout.lastIndexOf(" ");
    return `${fiche.perte} ${coupe > 0 ? bout.slice(0, coupe) : bout}…`;
}

// ── LA PAGE D'UN MÉTIER ──────────────────────────────────────────────────
router.get("/:id", (req, res, next) => {
    const fiche = metiers.fiche(String(req.params.id || "").toLowerCase());

    // 404 FRANC POUR UN MÉTIER INCONNU.
    //
    // La tentation est de rediriger vers le hub : le visiteur atterrit
    // quelque part, personne ne voit d'erreur. Mais Google, lui, enregistre
    // qu'une adresse inventée répond 200 — et se met à indexer n'importe
    // quelle URL sous /metiers/. On passe donc la main au gestionnaire 404
    // de l'application, qui répond ce qui est vrai.
    if (!fiche) return next();

    const L = res.locals.L || ((s) => s);
    const { titre, h1 } = titreEtH1(fiche, L);

    // Les voisins du même groupe : ils donnent à Google un maillage interne
    // réel (une page isolée se classe mal) et au visiteur un moyen de
    // corriger si sa page n'est pas tout à fait la sienne.
    const voisins = metiers.avecFiche()
        .filter((m) => m.groupe === fiche.groupe && m.id !== fiche.id)
        .slice(0, 8);

    // Le parcours décide de la variante. Une valeur inattendue retombe sur
    // « produit », comme partout ailleurs dans l'application : une page sans
    // bloc serait plus grave qu'une page avec le mauvais des deux.
    const parcours = fiche.parcours === "rdv" ? "rdv" : "produit";

    res.render("metier", {
        metier: fiche,
        voisins,
        titre,
        h1,
        description: descriptionDe(fiche),
        canonique: `${BASE}/metiers/${fiche.id}`,
        base: BASE,
        loggedIn: !!req.session?.loggedIn,
        parcours,
        etapes: ETAPES[parcours].map((e) => L(e)),
        faq: FAQ[parcours].map((x) => ({ q: L(x.q), r: L(x.r) })),
        mots: motsAffichables(fiche, L),
    });
});

module.exports = router;
