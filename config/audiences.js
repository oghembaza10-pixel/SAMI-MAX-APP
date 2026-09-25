// ==========================================================================
// SAMII OS — À QUI PARLE-T-ON, ET DONC QUE PEUT-IL JAMAIS TENIR
// ==========================================================================
//
// ── CE QUI A ÉTÉ MESURÉ AVANT D'ÉCRIRE UNE LIGNE ─────────────────────────
//
// Un client de boutique, sur WhatsApp ou Telegram, recevait QUATORZE outils :
//
//   confirmer_commande, annuler_commande, proposer_creneaux_rdv,
//   prendre_rendez_vous, passer_commande,          ← les siens, normaux
//   rechercher_prospects, resume_journee,
//   consulter_gmail, envoyer_email, consulter_agenda,
//   creer_evenement_agenda, lister_fichiers_drive,
//   creer_rapport_sheets, envoyer_facture          ← CEUX DU MARCHAND
//
// Ce n'est pas une injection : aucun attaquant n'est nécessaire. Un client
// qui écrit « regarde mes mails » à la boutique d'un marchand demandait à
// SAMII d'ouvrir la boîte Gmail DU MARCHAND, avec le connecteur du marchand.
// Un membre d'une communauté Telegram avait exactement les mêmes quatorze.
//
// ── POURQUOI C'EST ARRIVÉ ────────────────────────────────────────────────
//
// Le chemin sans niveau filtrait par LISTE NOIRE : « prends tous les outils,
// retire les familles agents et code ». Une liste noire ne protège que de ce
// qu'on a pensé à y écrire. Au chantier 8 il a fallu y ajouter « agents », au
// chantier 10 « code » — et à chaque fois la garde a crié APRÈS coup. Les
// familles lecture et écriture, elles, n'ont jamais été retirées : personne
// ne s'est demandé ce qu'un client faisait avec la boîte mail du marchand.
//
// Une liste blanche se trompe dans l'autre sens : elle oublie d'accorder,
// ce qui se voit tout de suite, au lieu d'oublier d'interdire, ce qui ne se
// voit jamais.
//
// ── POURQUOI AUCUN NOUVEL AXE ────────────────────────────────────────────
//
// La règle du projet est déjà : NIVEAU ∩ AUDIENCE ∩ MOTEUR.
//
// Le niveau avait sa table (config/niveaux.js). Le moteur avait la sienne
// (config/moteurs.js). L'AUDIENCE, elle, n'en avait pas : elle voyageait
// dans un booléen, `useTools`, calculé en une ligne dans brain/planner.js —
//
//     const useTools = context.allowActions !== false
//                   && context.audience !== "souverain";
//
// — qui ne sait dire que « souverain ou pas ». Trois audiences réelles
// (client, communauté, souverain) écrasées en deux valeurs : voilà la
// source du quatorze.
//
// Ce fichier n'ajoute donc pas une quatrième dimension. Il donne à la
// troisième, qui existait déjà, la table qu'elle n'avait jamais eue.
//
// ── ET MARCHAND / FONDATEUR ? PAS UN AXE NON PLUS ────────────────────────
//
// Les deux sont « souverain » : chacun est chez lui, dans son propre QG, et
// tient les outils de SON compte — jamais ceux d'un autre. Ce qui les
// sépare, c'est ce qu'ils peuvent PAYER, et ça s'appelle déjà le niveau,
// lui-même plafonné par le palier (voir config/niveaux.js). Ajouter un axe
// « grade » recopierait cette règle à un second endroit, et le jour où les
// deux ne diraient plus la même chose, personne ne saurait laquelle vaut.
// ==========================================================================

const NIVEAUX = require("./niveaux");

// ── LA TABLE ─────────────────────────────────────────────────────────────
//
// `familles`  ce que cette audience peut TENIR AU MAXIMUM, quoi qu'il
//             arrive. C'est un plafond, pas une dotation : le niveau et le
//             moteur retranchent encore.
//
// `niveauSApplique`  est-ce que la personne a un niveau de réflexion ?
//             Le fondateur en a un (il le choisit, il le paie). Un client de
//             boutique n'en a pas — il n'a pas de compte chez nous. Dire
//             « son niveau est rapide » lui retirerait tout, dire « maître »
//             lui donnerait tout : les deux sont faux, parce que la question
//             ne se pose pas pour lui.
//
// `famillesSansNiveau`  ce qui s'applique à une audience À niveau quand
//             aucun niveau n'est déclaré — l'entraînement du Centre de
//             contrôle, une leçon d'Academy. Cette valeur EXISTAIT déjà,
//             mais en dur, dans une liste de neuf noms au milieu de
//             services/geminiService.js. Elle est nommée ici pour qu'on
//             puisse la lire, la tester et la discuter.
const AUDIENCES = {
    // ── LE VISITEUR ANONYME ──────────────────────────────────────────────
    //
    // La page publique. Il n'a aucun compte, aucune boutique, rien à lui.
    // Le chat public ne pose déjà jamais `body.tools` (voir `chatLibre`) :
    // cette ligne ne change donc rien aujourd'hui. Elle est là pour que
    // l'audience existe dans la table — sinon un futur chemin public
    // tomberait dans « audience inconnue » et on croirait à un oubli.
    public: {
        nom: "Visiteur de la page publique",
        familles: [],
        niveauSApplique: false,
    },

    // ── LE CLIENT D'UN MARCHAND ──────────────────────────────────────────
    //
    // WhatsApp, Telegram, Messenger, Instagram, un commentaire sous une
    // publication. Il parle à UNE boutique et il doit pouvoir y commander,
    // y prendre rendez-vous, confirmer ou annuler. C'est le produit.
    //
    // Et rien d'autre. La boîte mail, l'agenda, le Drive, les factures, le
    // résumé de la journée : ce sont les affaires du marchand. Un client
    // dans une boutique ne passe pas derrière le comptoir.
    client: {
        nom: "Client d'un marchand",
        familles: ["commerce"],
        niveauSApplique: false,
    },

    // ── LE MEMBRE D'UNE COMMUNAUTÉ ───────────────────────────────────────
    //
    // Un groupe Telegram, une discussion générale. Même posture que le
    // client : il parle à SAMII, il n'administre rien.
    //
    // On lui laisse `commerce`, exactement ce qu'il avait déjà, plutôt que
    // de couper large « au cas où ». Ce chantier retire les neuf outils du
    // marchand ; il ne profite pas du passage pour changer autre chose.
    // Si la communauté ne doit finalement rien pouvoir commander, ce sera
    // une décision à prendre pour elle-même, pas un effet de bord.
    community: {
        nom: "Membre d'une communauté",
        familles: ["commerce"],
        niveauSApplique: false,
    },

    // ── LE MARCHAND / LE FONDATEUR, CHEZ LUI ─────────────────────────────
    //
    // Son QG, son entraînement, ses leçons. Il tient les outils de SON
    // compte : sa boîte, son agenda, ses fichiers, ses publications, et
    // l'exécution de code s'il atteint ce niveau-là.
    //
    // Jamais la famille `commerce` : ces outils-là agissent sur le carnet
    // d'un CLIENT (confirmer sa commande, poser son rendez-vous). C'est un
    // garde-fou qui existait déjà, sous la forme du `!== "souverain"` de
    // `useTools`, et il est simplement écrit ici en clair.
    souverain: {
        nom: "Marchand ou fondateur, dans son propre espace",
        familles: ["lecture", "ecriture", "agents", "code"],
        niveauSApplique: true,
        famillesSansNiveau: ["lecture", "ecriture"],
    },
};

function existe(id) {
    return Object.prototype.hasOwnProperty.call(AUDIENCES, String(id || ""));
}

function audience(id) {
    return AUDIENCES[String(id || "")] || null;
}

// ── FERMÉ PAR DÉFAUT, ET BRUYAMMENT ──────────────────────────────────────
//
// Mesuré avant correction : un contexte SANS audience recevait DIX-SEPT
// outils — tout le projet, `executer_code` compris. Le calcul lisait
// `context.audience !== "souverain"`, et « absent » n'est pas « souverain ».
// Un oubli dans une route donnait donc le maximum de pouvoir, en silence.
//
// C'est exactement l'inverse de ce qu'il faut. Une audience qu'on ne
// reconnaît pas ne tient rien, et on le dit fort : un refus muet se
// découvre trop tard, et toujours par la mauvaise personne.
function famillesDe(id) {
    const a = audience(id);
    if (!a) {
        if (id) console.error(`❌ audiences : « ${id} » n'est pas une audience connue — aucun outil accordé.`);
        return [];
    }
    return a.familles;
}

// Les noms d'outils, et non les familles. `config/niveaux.js` reste la seule
// table qui dit quels outils composent une famille : on la lit, on ne la
// recopie pas.
function outilsDe(id) {
    return famillesDe(id).flatMap((f) => NIVEAUX.FAMILLES[f] || []);
}

function niveauSApplique(id) {
    return audience(id)?.niveauSApplique === true;
}

// Ce qu'une audience à niveau tient quand aucun niveau n'est déclaré. Borné
// par `familles` : on ne peut pas accorder par défaut plus que le plafond de
// l'audience, même en se trompant en écrivant la table.
function outilsSansNiveau(id) {
    const a = audience(id);
    if (!a) return [];
    const plafond = new Set(outilsDe(id));
    return (a.famillesSansNiveau || [])
        .flatMap((f) => NIVEAUX.FAMILLES[f] || [])
        .filter((nom) => plafond.has(nom));
}

// ── CE QUI SERA RÉELLEMENT PORTÉ, POUR UN TOUR DONNÉ ─────────────────────
//
// Les deux axes croisés, en une seule expression : le plafond de l'audience,
// puis le niveau quand il s'applique. C'est exactement ce que
// `geminiService.buildToolsPayload` calcule à ses étapes 1 et 2 — et c'est
// pour ça que cette fonction existe ici plutôt qu'ailleurs : les deux tables
// vivent déjà dans ce fichier, et personne d'autre n'a à les recroiser.
//
// ── POURQUOI ELLE A ÉTÉ ÉCRITE ───────────────────────────────────────────
//
// `services/competences.js` annonçait au marchand, dans son prompt, les
// gestes de son secteur — en les lisant dans `config/niveaux.js` SANS passer
// par cette table. Mesuré sur les 36 secteurs : 63 gestes annoncés sur 136
// (46 %) appartenaient à la famille `commerce`, que le marchand ne tient
// JAMAIS chez lui. Trente-quatre secteurs sur trente-six promettaient un
// geste qui ne partirait pas.
//
// Le défaut n'était pas dans les permissions — elles sont justes. Il était
// dans la PHRASE : le prompt disait « tu sais faire confirmer_commande »
// juste avant d'ajouter « ne promets aucun geste que tu ne peux pas
// exécuter ».
//
// ⚠️ ELLE NE DIT PAS TOUT. Le troisième axe — le moteur, `config/moteurs.js`
// — n'est pas croisé ici : il dépend du relais retenu au moment de l'appel,
// que personne ne connaît à la construction du prompt. Sur Gemini les deux
// ensembles coïncident ; sur un relais de secours, cette fonction peut donc
// annoncer un outil de plus que ce qui partira. C'est le seul écart connu,
// et il est du bon côté : deux axes valent mieux qu'aucun.
function outilsDuTour(id, niveau = null) {
    const plafond = outilsDe(id);
    if (!niveauSApplique(id)) return plafond;
    // `outilsSansNiveau` est déjà borné par le plafond — inutile de le
    // reborner ici, et le reborner cacherait une erreur dans cette table.
    const permis = new Set(niveau ? NIVEAUX.outilsDe(niveau) : outilsSansNiveau(id));
    return plafond.filter((nom) => permis.has(nom));
}

// Pour les journaux et les pages de diagnostic : ce que chaque audience peut
// tenir au maximum, lisible d'un coup d'œil.
function etat() {
    return Object.entries(AUDIENCES).map(([id, a]) => ({
        id,
        nom: a.nom,
        familles: a.familles,
        niveauSApplique: a.niveauSApplique === true,
        outils: outilsDe(id).length,
    }));
}

module.exports = {
    AUDIENCES,
    existe, audience, famillesDe, outilsDe, niveauSApplique, outilsSansNiveau,
    outilsDuTour, etat,
};
