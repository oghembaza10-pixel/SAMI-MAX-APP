// ==========================================================================
// SAMII OS — LE REGISTRE DES MOTEURS
// ==========================================================================
//
// CE QUE CE FICHIER REMPLACE.
//
// Jusqu'ici, le choix du moteur tenait en deux faits épars :
//
//   1. `const MODEL = "gemini-3.6-flash"` — une constante en tête de
//      geminiService.js. Un seul moteur, jamais choisi, jamais discuté.
//   2. Une cascade de `try { … } catch { relais suivant }` — Groq, puis
//      OpenRouter, puis DeepSeek. Trois niveaux d'imbrication, écrits deux
//      fois (dans `chat()` et dans `chatWithSearch()`), et déclenchés
//      UNIQUEMENT par une panne.
//
// Le second point est le vrai défaut, et il est plus grave qu'il n'en a
// l'air : basculer sur un relais parce que Gemini est tombé, c'est basculer
// sur un moteur QUI NE SAIT PAS FAIRE LA MÊME CHOSE, sans que rien ne
// l'ajuste. Le corps de la requête est identique. Les mêmes outils partent.
//
// ── CE QUE ÇA DONNAIT CONCRÈTEMENT ───────────────────────────────────────
//
// Trois conséquences, toutes lisibles dans le code d'avant :
//
//   • LES DONNÉES GOOGLE. `chat()` passait `consulter_gmail` à Groq. Groq
//     l'appelait. Et `chatWithFunctionResult` refusait ensuite de lui
//     transmettre le résultat — à juste titre : la politique Limited Use de
//     Google l'interdit. Le tour finissait sur « J'ai bien récupéré
//     l'information, mais je ne peux pas la reformuler ». On avait donc
//     offert un outil dont on savait d'avance que le résultat ne
//     reviendrait jamais. Une impasse, servie comme une capacité.
//
//   • LES IMAGES. `chatLibre` dit lui-même aux relais, en toutes lettres
//     dans son prompt : « une image accompagnait ce message mais tu ne peux
//     pas la voir ». La capacité manquante était déjà connue — elle était
//     rattrapée par une phrase au lieu d'être déclarée.
//
//   • LES OUTILS D'ÉCRITURE. Le commentaire du relais OpenRouter le dit :
//     les relais sont moins disciplinés que Gemini sur l'appel de fonction.
//     Un modèle qui invente ses arguments et qui tient `envoyer_email` ou
//     `envoyer_facture` envoie un vrai e-mail, sous le nom du marchand, à
//     un vrai client. Ça ne se rattrape pas.
//
// ── LA RÈGLE ─────────────────────────────────────────────────────────────
//
//   UNE BASCULE DE SECOURS NE RÉACTIVE JAMAIS UN OUTIL QUE LE MOTEUR DE
//   SECOURS NE SAIT PAS PORTER, NI UN OUTIL QU'ON LUI A VOLONTAIREMENT
//   RETIRÉ.
//
// D'où `outilsFiables`, déclaré MOTEUR PAR MOTEUR. Ce n'est pas une
// permission de l'utilisateur (ça, c'est le niveau et l'audience) : c'est ce
// que CE moteur-là est jugé capable de tenir sans faire de dégâts.
//
// L'intersection finale est donc à trois termes, et chacun peut refuser :
//
//     outils du NIVEAU   ∩   outils de l'AUDIENCE   ∩   outilsFiables du MOTEUR
//     (combien d'effort)     (à qui il parle)           (ce qu'il sait tenir)
//
// ── CE QU'ON N'A PAS SUPPRIMÉ ────────────────────────────────────────────
//
// La famille `commerce` reste chez les relais. C'est la raison d'être écrite
// du repli : « SAMII continue de répondre aux clients et de confirmer/créer
// leurs commandes plutôt que de rester silencieux ». Un client qui commande
// un samedi soir pendant une panne Google doit toujours être servi. On ne
// retire pas cette capacité — on retire celles qui menaient à une impasse
// (lecture Workspace) ou à un dégât irréversible (écriture).
// ==========================================================================

// ── CE QU'UN MOTEUR DÉCLARE ──────────────────────────────────────────────
//
// `capacites` — ce que le moteur SAIT faire. Chaque champ ci-dessous a été
// relevé dans le code existant, pas supposé :
//
//   texte        rendre du texte.
//   outils       recevoir des déclarations de fonctions et en appeler une.
//   suiteDOutil  reprendre la main APRÈS le résultat d'un outil pour
//                formuler la réponse (chatWithFunctionResult).
//   flux         écrire au fil. Mesuré : `chatLibreFlux` ne streame que chez
//                Gemini ; son repli appelle `chatLibre`, qui rend un bloc.
//   recherche    le grounding web natif (`google_search`). Mesuré : aucun
//                relais n'a d'équivalent, le repli de `chatWithSearch` rend
//                `sources: []`.
//   vision       regarder une image. Mesuré : seul Gemini reçoit
//                `inlineData` ; `chatLibre` prévient les relais qu'ils ne
//                voient rien.
//
// `donneesGoogle` — ce moteur a-t-il le droit de RECEVOIR le contenu d'une
// boîte mail, d'un agenda ou d'un Drive. Non négociable, ce n'est pas une
// question de qualité de modèle mais de politique Google (Limited Use).
//
// `outilsFiables` — les FAMILLES de config/niveaux.js que ce moteur peut
// porter. La liste vide est un état normal, pas une panne.
//
// `rang` — l'ordre d'essai, du plus capable au dernier recours. Il reprend
// exactement l'ordre déjà en place (Gemini → Groq → OpenRouter → DeepSeek) :
// on ne change pas un comportement éprouvé en passant à un registre.
const MOTEURS = {
    // ── GEMINI FLASH : le moteur de tous les jours ───────────────────────
    "gemini-flash": {
        id: "gemini-flash",
        libelle: "Gemini Flash",
        fournisseur: "gemini",
        modele: "gemini-3.6-flash",
        disponible: true,
        capacites: {
            texte: true, outils: true, suiteDOutil: true,
            flux: true, recherche: true, vision: true,
        },
        donneesGoogle: true,
        outilsFiables: ["lecture", "ecriture", "commerce"],
        rang: 0,
        // Repère relatif, PAS un prix. La passe tarifaire vient après ; on
        // ne met pas de chiffre en dinars ici pour qu'aucun code ne se mette
        // à facturer depuis ce fichier avant que la question soit tranchée.
        cout: 2,
    },

    // ── GEMINI PRO : déclaré, pas encore nommé ───────────────────────────
    //
    // config/niveaux.js demande `moteur: "pro"` pour les niveaux Pro et
    // Maître. Ce champ n'était lu par personne — l'aiguilleur le lit
    // désormais, et tombe donc sur cette entrée.
    //
    // ⚠️ `modele` VAUT null, ET C'EST VOLONTAIRE. Aucun identifiant de
    // modèle Gemini « pro » n'existe nulle part dans ce dépôt, et il n'y a
    // pas de clé dans cet environnement pour interroger l'API et en obtenir
    // un. Écrire ici un nom plausible serait un 404 en production, sur le
    // niveau le plus cher, découvert par un client.
    //
    // Un moteur `disponible: false` n'est pas une panne : l'aiguilleur
    // l'écarte avec sa raison, et redescend sur Flash. Le jour où un nom est
    // VÉRIFIÉ contre l'API réelle, deux valeurs changent ici et rien
    // d'autre dans le projet.
    "gemini-pro": {
        id: "gemini-pro",
        libelle: "Gemini Pro",
        fournisseur: "gemini",
        modele: null,
        disponible: false,
        indisponibilite: "aucun identifiant de modèle Gemini « pro » n'a été vérifié contre l'API",
        capacites: {
            texte: true, outils: true, suiteDOutil: true,
            flux: true, recherche: true, vision: true,
        },
        donneesGoogle: true,
        outilsFiables: ["lecture", "ecriture", "commerce"],
        rang: 1,
        cout: 5,
    },

    // ── GROQ : le premier relais ─────────────────────────────────────────
    //
    // llama-3.3-70b-versatile. Gratuit, très rapide, format OpenAI.
    // Pas de vision, pas de grounding web, pas de flux chez nous.
    //
    // `outilsFiables: ["commerce"]` — il garde ce pour quoi le relais
    // existe (confirmer une commande, poser un rendez-vous) et rien
    // d'autre. La lecture Workspace lui est retirée parce que son résultat
    // ne lui reviendra pas (`donneesGoogle: false`) : la lui offrir serait
    // lui tendre une impasse. L'écriture lui est retirée parce qu'un
    // argument inventé y devient un e-mail ou une facture réellement
    // partie.
    groq: {
        id: "groq",
        libelle: "Groq (Llama 3.3 70B)",
        fournisseur: "groq",
        modele: "llama-3.3-70b-versatile",
        disponible: true,
        capacites: {
            texte: true, outils: true, suiteDOutil: true,
            flux: false, recherche: false, vision: false,
        },
        donneesGoogle: false,
        outilsFiables: ["commerce"],
        rang: 2,
        cout: 0,
    },

    // ── OPENROUTER : le deuxième relais ──────────────────────────────────
    //
    // Modèle gratuit de 20 milliards de paramètres — le plus petit de la
    // chaîne. Il tient `commerce` parce que c'est la raison du repli, mais
    // c'est celui dont la discipline sur l'appel de fonction est la moins
    // sûre. Si une commande mal confirmée est un jour constatée en
    // production, la correction est UNE LIGNE ici : `outilsFiables: []`. Le
    // relais continuerait alors de répondre en texte, sans jamais agir.
    openrouter: {
        id: "openrouter",
        libelle: "OpenRouter (gpt-oss-20b)",
        fournisseur: "openrouter",
        modele: "openai/gpt-oss-20b:free",
        disponible: true,
        capacites: {
            texte: true, outils: true, suiteDOutil: true,
            flux: false, recherche: false, vision: false,
        },
        donneesGoogle: false,
        outilsFiables: ["commerce"],
        rang: 3,
        cout: 0,
    },

    // ── DEEPSEEK : le dernier recours ────────────────────────────────────
    //
    // Payant mais très économique. Il n'est atteint que si les trois autres
    // ont échoué — un cas rare, et c'est précisément pourquoi il doit
    // exister : ce jour-là, il n'y a plus rien derrière.
    deepseek: {
        id: "deepseek",
        libelle: "DeepSeek Chat",
        fournisseur: "deepseek",
        modele: "deepseek-chat",
        disponible: true,
        capacites: {
            texte: true, outils: true, suiteDOutil: true,
            flux: false, recherche: false, vision: false,
        },
        donneesGoogle: false,
        outilsFiables: ["commerce"],
        rang: 4,
        cout: 1,
    },
};

// L'ordre d'essai, dérivé du `rang` déclaré — jamais de l'ordre des clés
// d'un objet, qui n'est pas un contrat.
const ORDRE = Object.values(MOTEURS).sort((a, b) => a.rang - b.rang).map((m) => m.id);

// Ce que `config/niveaux.js` appelle `moteur` : "flash" ou "pro". La table
// vit ICI, pas là-bas — niveaux.js dit l'EFFORT voulu, moteurs.js dit quelle
// machine le rend.
const PAR_PALIER_DE_MOTEUR = { flash: "gemini-flash", pro: "gemini-pro" };

// ── LIRE UN MOTEUR ───────────────────────────────────────────────────────
//
// Accepte un identifiant de moteur ("gemini-flash") OU un nom de
// fournisseur ("gemini"). Les deux circulent déjà dans le code : `provider`
// vaut "gemini" / "groq" / "openrouter" / "deepseek" dans tout
// geminiService.js, et on ne va pas réécrire quinze endroits pour un nom.
//
// Rend `null` sur un inconnu — un appelant doit pouvoir distinguer « ce
// moteur n'existe pas » de « ce moteur ne porte aucun outil ».
function moteur(id) {
    const cle = String(id || "").toLowerCase();
    if (MOTEURS[cle]) return MOTEURS[cle];
    // Un fournisseur : on rend son moteur le mieux classé.
    const parFournisseur = ORDRE.map((x) => MOTEURS[x]).filter((m) => m.fournisseur === cle);
    return parFournisseur[0] || null;
}

function existe(id) {
    return moteur(id) !== null;
}

// ── LES OUTILS QU'UN MOTEUR A LE DROIT DE PORTER ─────────────────────────
//
// Rend les NOMS d'outils, à partir des familles déclarées. Les noms vivent
// dans config/niveaux.js, comme pour les niveaux : une seule table de
// familles dans tout le projet.
//
// UN MOTEUR INCONNU NE PORTE RIEN. C'est le bon défaut : si demain un
// cinquième relais est branché et que quelqu'un oublie de le déclarer ici,
// il répondra en texte au lieu de porter des outils sans surveillance.
// L'oubli dégrade, il n'ouvre pas.
function outilsFiablesDe(id) {
    const m = moteur(id);
    if (!m) return [];
    const { FAMILLES } = require("./niveaux");
    return m.outilsFiables.flatMap((f) => FAMILLES[f] || []);
}

function porteLaFamille(id, famille) {
    const m = moteur(id);
    return Boolean(m && m.outilsFiables.includes(famille));
}

function sait(id, capacite) {
    const m = moteur(id);
    return Boolean(m && m.capacites[capacite]);
}

function recoitDonneesGoogle(id) {
    const m = moteur(id);
    return Boolean(m && m.donneesGoogle);
}

// ══════════════════════════════════════════════════════════════════════════
// L'AIGUILLEUR
// ══════════════════════════════════════════════════════════════════════════
//
// Il ne choisit pas UN moteur. Il rend une CHAÎNE : le moteur préféré, puis
// ceux qui peuvent honnêtement prendre la suite s'il tombe.
//
// C'est la différence avec le code d'avant. Avant, la chaîne était fixe et
// écrite en dur dans un try/catch : Gemini → Groq → OpenRouter → DeepSeek,
// quelle que soit la demande. Un moteur incapable de servir le tour restait
// dans la chaîne et y répondait quand même, à sa façon.
//
// Ici, un moteur qui ne peut pas servir CE tour-là n'est pas dans la
// chaîne du tout — et la raison est rendue avec, pour que ça se voie dans
// un test et dans un journal au lieu de se deviner.
//
// ── CE QUE « BESOINS » VEUT DIRE ─────────────────────────────────────────
//
// L'INTENTION, traduite en capacités. Pas un mot-clé, pas une devinette :
// chaque besoin correspond à un fait constatable au moment du tour.
//
//   vision       une image est jointe (context.piece)
//   recherche    le tour passe par chatWithSearch (grounding web)
//   flux         la réponse doit s'écrire au fil (route /chat/flux)
//   outils       le tour peut appeler une fonction
//   donneesGoogle un outil qui rapporte du contenu Workspace est en jeu
//
// Un besoin absent n'écarte personne. Un besoin présent écarte tous ceux
// qui ne savent pas le rendre — SANS EXCEPTION, y compris le moteur
// préféré, et y compris le tout dernier recours. Mieux vaut une chaîne
// vide, honnête, qu'un moteur qui répond à côté.
function choisir({ niveau = null, besoins = {} } = {}) {
    const NIVEAUX = require("./niveaux");
    const n = niveau ? NIVEAUX.niveau(niveau) : null;

    // Le moteur que l'EFFORT demande. C'est ici, et seulement ici, que le
    // champ `moteur` de config/niveaux.js sert enfin à quelque chose.
    const prefere = n ? (PAR_PALIER_DE_MOTEUR[n.moteur] || "gemini-flash") : "gemini-flash";

    const chaine = [];
    const ecartes = [];

    // On part du préféré, puis de tous les autres dans l'ordre des rangs.
    // Le préféré ne double pas : il est retiré de la suite.
    const candidats = [prefere, ...ORDRE.filter((id) => id !== prefere)];

    for (const id of candidats) {
        const m = MOTEURS[id];
        if (!m) continue;

        if (!m.disponible) {
            ecartes.push({ id, raison: m.indisponibilite || "moteur indisponible" });
            continue;
        }

        // ── LES CAPACITÉS ────────────────────────────────────────────────
        let manque = null;
        for (const [besoin, requis] of Object.entries(besoins)) {
            if (!requis) continue;
            if (besoin === "donneesGoogle") {
                if (!m.donneesGoogle) { manque = "ne peut pas recevoir de données Google Workspace"; break; }
                continue;
            }
            if (besoin === "outils") {
                // « Il faut des outils » ne veut pas dire « il faut TOUS les
                // outils ». Un moteur qui n'en porte aucun ne sert pas un
                // tour qui en exige un — mais on ne l'écarte que là.
                if (!m.capacites.outils || !m.outilsFiables.length) {
                    manque = "ne porte aucun outil de confiance"; break;
                }
                continue;
            }
            if (Object.prototype.hasOwnProperty.call(m.capacites, besoin) && !m.capacites[besoin]) {
                manque = `ne sait pas : ${besoin}`; break;
            }
        }

        // ── LA FAMILLE D'OUTILS EXIGÉE ───────────────────────────────────
        //
        // Le cas qui donne son nom au chantier. Un tour qui doit envoyer une
        // facture exige la famille `ecriture` ; un relais qui ne la porte
        // pas ne prend PAS la suite. Sans ça, la bascule de secours
        // réactiverait un outil volontairement retiré.
        if (!manque && besoins.famille && !m.outilsFiables.includes(besoins.famille)) {
            manque = `ne porte pas la famille « ${besoins.famille} »`;
        }

        if (manque) { ecartes.push({ id, raison: manque }); continue; }
        chaine.push(id);
    }

    return { prefere, moteur: chaine[0] || null, chaine, ecartes };
}

// ── CE QUE LE TOUR DEMANDE, LU SUR LE TOUR LUI-MÊME ──────────────────────
//
// Traduit un contexte de chat en besoins. Une seule lecture, partagée : si
// deux appelants déduisaient les besoins chacun de leur côté, ils
// finiraient par ne plus router pareil, et personne ne le verrait.
function besoinsDuTour({ context = {}, useTools = false, flux = false, recherche = false } = {}) {
    const NIVEAUX = require("./niveaux");
    const besoins = {};
    if (context.piece?.base64 || context.piece?.mimeType) besoins.vision = true;
    if (flux) besoins.flux = true;
    if (recherche) besoins.recherche = true;

    // Le tour a-t-il besoin d'outils ? Oui si l'audience les autorise
    // (useTools), ou si le niveau en porte. Un niveau Rapide sans audience
    // marchande n'en demande aucun — et n'écarte donc aucun moteur.
    const niveauPorte = context.niveau ? NIVEAUX.porteDesOutils(context.niveau) : false;
    if (useTools || niveauPorte) besoins.outils = true;
    return besoins;
}

module.exports = {
    MOTEURS, ORDRE, PAR_PALIER_DE_MOTEUR,
    moteur, existe, sait, recoitDonneesGoogle,
    outilsFiablesDe, porteLaFamille,
    choisir, besoinsDuTour,
};
