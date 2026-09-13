// ==========================================================================
// SAMII OS — AUTO : QUEL NIVEAU DE RÉFLEXION POUR CE MESSAGE ?
// ==========================================================================
//
// « L'utilisateur ne devrait pas forcément avoir à choisir. »
//
// « Traduis-moi cette phrase » doit rester instantané. « J'ai 500 000 DA,
// je veux lancer une boutique de vêtements sur Instagram, fais-moi un plan
// complet » mérite qu'on réfléchisse. Entre les deux, c'est à SAMII de voir.
//
// ── SANS UN SEUL APPEL D'IA ───────────────────────────────────────────────
//
// La tentation évidente serait de demander à un modèle « quel niveau
// faut-il ? ». Ce serait payer deux fois et ajouter une attente sur les
// questions simples — exactement celles qui doivent répondre tout de suite.
// Le classement est donc fait ici, en local, sur le texte. Coût : zéro.
// Latence : zéro.
//
// ── ON NE DEVINE PAS LE DOMAINE UNE SECONDE FOIS ──────────────────────────
//
// brain/prompts/sovereign/tables.js classe DÉJÀ chaque message en huit
// domaines pour choisir les lois à injecter. Il tourne à chaque message,
// aujourd'hui, gratuitement. On le réutilise. Un second routeur finirait par
// ne plus classer le même message dans le même domaine, et personne ne
// saurait lequel fait foi.
//
// ── CE QUE ÇA N'EST PAS ───────────────────────────────────────────────────
//
// Ce n'est pas une mesure de l'intelligence d'une question, ni une note
// donnée à la personne. C'est une estimation de l'EFFORT que la réponse va
// demander. Se tromper vers le bas coûte une réponse un peu courte ; se
// tromper vers le haut coûte de l'argent. En cas de doute, on descend.
const NIVEAUX = require("../config/niveaux");
const { detect } = require("../brain/prompts/sovereign/tables");

// ── LIRE UN TEXTE ÉCRIT PAR UN VRAI HUMAIN ───────────────────────────────
//
// Les gens écrivent « strategie » sans accent, « STRATÉGIE » en majuscules,
// et collent les majuscules au milieu d'une phrase. Le routeur de domaine
// existant ne cherche que les formes accentuées en minuscules — ce n'est pas
// un défaut pour son usage, mais ici on veut attraper les deux.
function normaliser(texte) {
    return String(texte || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
}

// ── LES SIGNAUX ──────────────────────────────────────────────────────────
//
// Chacun pèse. Aucun ne décide seul : une question longue n'est pas
// forcément complexe, et « compare » dans une phrase anodine ne vaut pas un
// plan d'affaires. C'est la somme qui tranche.
//
// Les mots sont donnés SANS accent : le texte est normalisé avant.

// Ce qui demande de construire quelque chose, pas seulement de répondre.
const VERBES_DE_TRAVAIL = [
    "analyse", "analyser", "compare", "comparer", "strategie", "plan",
    "planifie", "audit", "optimise", "optimiser", "calcule", "calculer",
    "previsionnel", "rentabilite", "diagnostic", "pourquoi", "comment faire",
    "etude", "projection", "scenario", "budget", "business plan", "lancer",
    "ameliorer", "resoudre", "organiser", "structurer",
    // Demander un avis, c'est demander un raisonnement. Ces formes-là sont
    // arrivées par la mesure : « résume ce rapport ET dis-moi quoi faire »
    // était classé « geste simple » parce que seul « résume » comptait.
    "quoi faire", "que faire", "conseil", "conseille", "recommande",
    "recommandation", "dois-je", "faut-il", "vaut-il mieux",
];

// ── CE QUI SE FAIT D'UN TRAIT ────────────────────────────────────────────
//
// La ligne, trouvée en mesurant : un geste simple TRANSFORME un texte que la
// personne fournit elle-même, ou c'est de la politesse. Rien d'autre.
//
// « C'est quoi… », « définition de… », « qui est… » ont été RETIRÉS d'ici.
// Ce sont des questions de connaissance, pas des gestes : elles demandent à
// SAMII de savoir quelque chose, donc de pouvoir aller vérifier. Et
// « c'est quoi le prix de la livraison à Oran ? » est la façon la plus
// courante de poser une question de prix — l'envoyer au niveau sans outil,
// c'était garantir un chiffre inventé.
//
// Le classement dépendait même de l'apostrophe : « c'est quoi » l'attrapait,
// « c est quoi » non. Une règle qui change selon la façon de taper n'est pas
// une règle.
const GESTES_SIMPLES = [
    "traduis", "traduire", "traduction", "resume", "resumer", "reformule",
    "reformuler", "corrige", "corriger", "orthographe", "comment on dit",
    "bonjour", "salut", "merci", "ca va", "cava", "bonsoir", "slm", "salam",
];

// Les domaines qui demandent presque toujours de construire. Le routeur
// existant les nomme déjà ; on se contente de dire lesquels pèsent.
const DOMAINES_LOURDS = ["strategie", "finance", "programmation"];

// Les seuils. Volontairement peu nombreux : trois frontières, pas une
// formule. Une note qu'on ne sait pas expliquer ne se règle jamais.
const SEUIL_EXPERT = 2;
const SEUIL_PRO = 5;
const SEUIL_MAITRE = 9;

// ── PESER UN MESSAGE ─────────────────────────────────────────────────────
//
// Rend le score ET les raisons. Les raisons ne sont pas décoratives : c'est
// ce qui permettra d'écrire « SAMII réfléchit plus profondément… » en disant
// la vérité, et c'est ce qu'on relira le jour où un choix paraîtra absurde.
function peser(message, { piece = null, domaine = null } = {}) {
    const texte = normaliser(message);
    const brut = String(message || "");
    const raisons = [];
    let score = 0;

    // Un message long demande généralement une réponse construite. Le seuil
    // est haut exprès : quelqu'un qui raconte sa situation en trois lignes
    // ne demande pas pour autant une étude.
    if (brut.length > 400) { score += 3; raisons.push("message long"); }
    else if (brut.length > 180) { score += 1; raisons.push("message détaillé"); }

    // Des chiffres AVEC une monnaie : on parle d'argent réel, donc de
    // calcul. Les monnaies du terrain d'abord.
    if (/\d[\d\s.,]*\s*(da|dzd|dinars?|fcfa|xof|xaf|mad|dh|tnd|eur|euros?|usd|\$|€)/i.test(brut)) {
        score += 3; raisons.push("montants en jeu");
    }

    // Plusieurs questions dans un seul message : il faudra y répondre une
    // par une, donc dérouler.
    const questions = (brut.match(/\?/g) || []).length;
    if (questions >= 3) { score += 2; raisons.push(`${questions} questions`); }
    else if (questions === 2) { score += 1; raisons.push("deux questions"); }

    // Les verbes de travail. On compte les distincts : répéter « analyse »
    // quatre fois ne rend pas la demande quatre fois plus lourde.
    const trouves = VERBES_DE_TRAVAIL.filter((v) => texte.includes(v));
    if (trouves.length) {
        score += Math.min(trouves.length, 3) * 2;
        raisons.push(`demande de travail (${trouves.slice(0, 3).join(", ")})`);
    }

    // Une pièce jointe : il y a quelque chose à regarder avant de répondre.
    if (piece) { score += 2; raisons.push("pièce jointe à examiner"); }

    // Le domaine, lu par le routeur existant.
    const dom = domaine || detect(String(message || ""));
    if (DOMAINES_LOURDS.includes(dom)) { score += 2; raisons.push(`domaine ${dom}`); }

    // ── LE GESTE SIMPLE REPREND LA MAIN, MAIS PAS N'IMPORTE COMMENT ──────
    //
    // « Traduis-moi ce long paragraphe en anglais » coche « message long »
    // sans rien demander de complexe. Un geste simple ramène donc le score au
    // plancher — sous DEUX conditions, toutes deux venues de la mesure :
    //
    //   1. Aucun verbe de travail à côté. « Résume ce rapport ET dis-moi quoi
    //      faire » reste du travail : la deuxième moitié est la vraie demande.
    //
    //   2. Le geste doit être ANNONCÉ, c'est-à-dire au début du message. Un
    //      « merci » ou un « bonjour » perdu au milieu d'une longue demande
    //      ne transforme pas cette demande en politesse.
    const gesteSimple = GESTES_SIMPLES.find((g) => texte.includes(g));
    const annonce = gesteSimple && texte.indexOf(gesteSimple) <= 24;
    if (gesteSimple && annonce && !trouves.length) {
        return {
            score: 0, raisons: [`geste simple (${gesteSimple})`],
            domaine: dom, gesteSimple,
        };
    }

    return { score, raisons, domaine: dom, gesteSimple: null };
}

// ── DU SCORE AU NIVEAU ───────────────────────────────────────────────────
//
// ── POURQUOI AUTO NE DESCEND À « RAPIDE » QUE SUR UN GESTE RECONNU ───────
//
// Trouvé en faisant tourner le classement sur de vraies phrases : « combien
// coûte une livraison Alger → Oran ? » tombait sur Rapide. Or Rapide ne
// porte AUCUN outil. SAMII aurait donc répondu un prix de mémoire, avec
// aplomb, sans rien vérifier — et un prix inventé sur une question de prix
// est exactement ce qui fait perdre confiance en un assistant.
//
// Donc : Auto ne choisit Rapide que lorsqu'un geste simple a été RECONNU
// (« traduis », « bonjour », « reformule »). Partout ailleurs le plancher
// est Expert, qui porte les outils de lecture et peut donc aller voir.
//
// Le surcoût est presque nul — Expert tourne sur le même moteur que Rapide.
// Rapide reste disponible pour qui le choisit explicitement : quelqu'un qui
// demande la vitesse sait ce qu'il échange.
function niveauDuScore(score, { gesteSimple = null } = {}) {
    if (score >= SEUIL_MAITRE) return "maitre";
    if (score >= SEUIL_PRO) return "pro";
    if (gesteSimple) return "rapide";
    return "expert";
}

// ── LE CHOIX, POUR UN TOUR ───────────────────────────────────────────────
//
// Rend TOUJOURS un niveau réel — jamais « auto », qui est une façon de
// choisir et pas un niveau. C'est ce niveau-là qu'on facturera et qu'on
// tracera.
//
// `demande` est ce que la personne a choisi dans son sélecteur. S'il vaut
// « auto » ou rien, on pèse. S'il nomme un niveau, on le respecte — mais on
// le borne quand même : le plafond est une question d'argent, pas de goût.
function choisir({ message, demande = null, palier = "free", piece = null } = {}) {
    const auto = !demande || demande === NIVEAUX.AUTO;

    if (!auto) {
        const retenu = NIVEAUX.borner(demande, palier);
        return {
            niveau: retenu.id,
            auto: false,
            borne: retenu.id !== NIVEAUX.niveau(demande).id,
            score: null,
            raisons: ["choisi par la personne"],
        };
    }

    const { score, raisons, domaine, gesteSimple } = peser(message, { piece });
    const vise = niveauDuScore(score, { gesteSimple });
    const retenu = NIVEAUX.borner(vise, palier);

    return {
        niveau: retenu.id,
        auto: true,
        // `borne` dit que le plafond a mordu : la personne aurait eu droit à
        // mieux avec un abonnement. C'est l'endroit honnête pour le lui dire.
        borne: retenu.id !== vise,
        score,
        domaine,
        raisons,
    };
}

// ── L'ESCALADE EN COURS DE TOUR ──────────────────────────────────────────
//
// SAMII démarre léger, et découvre qu'il lui faut un outil qu'il n'a pas, ou
// qu'il lui manque des données. Plutôt que de rendre une réponse creuse, on
// monte d'un cran et on relance UNE fois.
//
// UNE SEULE FOIS. Une escalade qui peut se répéter est une facture qui peut
// s'emballer — et le mode de panne le plus coûteux d'un agent est la boucle
// qui se rappelle elle-même.
//
// On ne monte que depuis un choix AUTOMATIQUE : quelqu'un qui a explicitement
// demandé « Rapide » veut une réponse rapide, pas qu'on décide à sa place de
// dépenser plus.
function doitMonter({ choix, reponse, dejaMonte = false }) {
    if (dejaMonte) return false;
    if (!choix?.auto) return false;
    if (choix.borne) return false;              // le plafond a déjà mordu
    if (NIVEAUX.comparer(choix.niveau, "maitre") >= 0) return false;

    const texte = normaliser(reponse);
    if (!texte) return false;

    // Les aveux d'insuffisance. Ce sont des formulations que le modèle
    // produit quand il sait qu'il ne peut pas répondre correctement avec ce
    // qu'on lui a donné.
    return [
        "je n'ai pas acces", "je n ai pas acces", "je ne peux pas acceder",
        "il me faudrait", "j'aurais besoin de", "j aurais besoin de",
        "je ne peux pas consulter", "sans acces a",
    ].some((aveu) => texte.includes(aveu));
}

module.exports = {
    choisir, peser, niveauDuScore, doitMonter, normaliser,
    SEUIL_EXPERT, SEUIL_PRO, SEUIL_MAITRE,
    VERBES_DE_TRAVAIL, GESTES_SIMPLES, DOMAINES_LOURDS,
};
