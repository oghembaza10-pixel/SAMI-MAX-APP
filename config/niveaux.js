// ==========================================================================
// SAMII OS — LES NIVEAUX DE RÉFLEXION
// ==========================================================================
//
// UN SEUL SAMII. Une seule mémoire, une seule identité. Ce qui change d'un
// niveau à l'autre, c'est l'EFFORT : quel moteur, combien de réflexion,
// quels outils, combien d'étapes. Jamais la personne, jamais ce dont il se
// souvient.
//
// ── POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST SEUL ───────────────────
//
// SAMII portait déjà QUATRE échelles avant celle-ci : les paliers
// d'abonnement, les grades (Soldat → Général), les cinq postures d'autonomie
// et l'audience. Une cinquième écrite à côté aurait divergé des autres au
// premier changement — c'est exactement ce qui est arrivé trois fois dans ce
// projet (la configuration Cloudinary en trois exemplaires, la liste des
// métiers morte dans le Hub, le pays lu dans la mauvaise table).
//
// Donc : tout ce qui distingue un niveau d'un autre est ICI, dans une seule
// table. Le moteur, la réflexion, les outils, les étapes, le prix. Un
// appelant qui a besoin d'une de ces valeurs la demande ; il ne la redéclare
// jamais.
//
// ── LE NIVEAU N'EST PAS UNE PERMISSION ────────────────────────────────────
//
// C'est la règle la plus importante du fichier. Le niveau dit COMBIEN
// D'EFFORT, jamais QUEL DROIT. Le droit d'agir seul est un axe séparé — les
// cinq postures de routes/samii-mode.js, croisées avec le palier payé. Les
// mélanger reviendrait à vendre un droit d'agir en vendant de la réflexion.
//
// Un « Maître » peut réfléchir très profondément sans avoir le droit de
// toucher à quoi que ce soit. Un « Souverain » peut agir seul sur une
// question triviale. Les deux cadrans tournent indépendamment.
// ==========================================================================

// ── LES FAMILLES D'OUTILS ────────────────────────────────────────────────
//
// On nomme des FAMILLES, pas des listes recopiées. services/geminiService.js
// déclare les outils une fois (leurs paramètres, leurs descriptions) ; ici on
// dit seulement lesquels un niveau a le droit de porter.
//
// LECTURE ne crée rien et n'envoie rien. Ces outils regardent des données qui
// appartiennent déjà à la personne — son agenda, sa boîte mail, ses fichiers,
// son activité du jour. Les ouvrir tôt ne coûte que le temps de l'appel.
//
// ÉCRITURE fait exister quelque chose qui n'existait pas : un e-mail parti,
// un événement posé, un rapport créé, une facture envoyée. C'est là que le
// niveau commence à avoir des conséquences.
//
// COMMERCE agit sur les données commerciales d'un CLIENT de marchand. Cette
// famille n'est jamais accordée par le niveau : elle dépend de l'audience, et
// c'est un garde-fou existant qu'on ne touche pas (voir plus bas).
const FAMILLES = {
    lecture: [
        "resume_journee",
        "consulter_gmail",
        "consulter_agenda",
        "lister_fichiers_drive",
        "rechercher_prospects",

        // ── LES CINQ OUTILS REPRIS DES ANCIENNES PAGES ───────────────────
        //
        // Douze pages vivaient sous /samii — un formulaire, un prompt, un
        // résultat qu'on lisait puis qu'on fermait. Le marchand devait
        // connaître douze adresses pour s'en servir. Elles deviennent des
        // questions qu'on pose dans la conversation.
        //
        // ⚠️ FAMILLE « LECTURE », ET PAS AUTRE CHOSE. Ces cinq-là LISENT :
        // le web pour les trois premiers, les propres données du marchand
        // pour les deux derniers. Aucun ne crée ni n'envoie quoi que ce
        // soit — rien n'existe après qui n'existait avant. C'est la règle
        // de config/credits.js : ce qui lit est compris dans le message,
        // ce qui crée se paie.
        //
        // Conséquence voulue : accordés dès le niveau Expert, et JAMAIS à
        // un client de boutique — l'audience `client` ne porte que la
        // famille `commerce` (config/audiences.js). Un client qui
        // demanderait l'historique d'un autre client ne tient pas l'outil
        // qui le lui donnerait.
        "marche_du_moment",
        "prix_du_marche",
        "trouver_fournisseur",
        "etat_de_mon_business",
        "historique_client",
    ],
    ecriture: [
        "envoyer_email",
        "creer_evenement_agenda",
        "creer_rapport_sheets",
        "envoyer_facture",
    ],
    commerce: [
        "confirmer_commande",
        "annuler_commande",
        "passer_commande",
        "prendre_rendez_vous",
        "proposer_creneaux_rdv",
    ],

    // AGENTS ouvre une chaîne de spécialistes internes au lieu d'exécuter un
    // geste unique. C'est une famille à part pour trois raisons, et chacune
    // compte :
    //
    //   • LE COÛT. Un outil ordinaire, c'est un appel. Une mission, c'est
    //     autant d'appels que de maillons. Mélangée à « lecture », elle
    //     serait accordée dès le niveau Expert et un « bonjour » mal
    //     interprété ferait tourner cinq agents.
    //
    //   • L'EFFET. Ces chaînes fabriquent quelque chose qui reste — un
    //     brouillon enregistré, des variantes en attente. Ce n'est pas une
    //     lecture, et ce n'est pas encore un envoi.
    //
    //   • LES RELAIS. `config/moteurs.js` ne concède aux relais que la
    //     famille « commerce ». Isoler les agents ici suffit à ce qu'une
    //     panne de Gemini ne les remette jamais entre leurs mains.
    agents: [
        "preparer_publication",
        // Une mission longue est une façon d'exécuter, pas une capacité à
        // part : elle reste dans la famille « agents », avec les mêmes
        // permissions et le même plancher de niveau. Créer une cinquième
        // famille aurait laissé croire que « long » est un droit séparé.
        "preparer_strategie",
    ],

    // ── CODE : une famille à elle seule, et c'est voulu ──────────────────
    //
    // Exécuter du code écrit par un modèle est la capacité la plus dangereuse
    // du projet. Un outil qui se trompe envoie un mauvais e-mail ; du code qui
    // s'échappe lit la base, les clés, les commandes de tout le monde.
    //
    // Elle n'est donc PAS rangée avec « agents » : une famille commune aurait
    // voulu dire qu'ouvrir la préparation de publications ouvre aussi
    // l'exécution de code. Deux capacités qui n'ont rien à voir se seraient
    // accordées d'un seul geste, et personne ne l'aurait vu venir.
    //
    // Accordée au seul niveau Maître, et `config/bacs.js` refuse en plus
    // d'exécuter tant qu'aucun bac ne ferme le système de fichiers. Deux
    // verrous indépendants : le droit de la personne, et la sûreté de la
    // machine. Aucun des deux ne suffit seul.
    code: [
        "executer_code",
    ],
};

// ── LE PRIX, AUJOURD'HUI ─────────────────────────────────────────────────
//
// TOUS LES NIVEAUX SONT AU MÊME TARIF POUR L'INSTANT. C'est délibéré et
// temporaire : la passe tarifaire vient après, une fois l'ensemble construit.
//
// Le champ existe dès maintenant pour que la structure n'ait pas à être
// refaite — et pour que la question reste visible au lieu d'être oubliée.
//
// ⚠️ CE QU'IL FAUDRA TRANCHER. Un tour « Maître » coûte réellement plus cher
// chez le fournisseur qu'un tour « Rapide ». Tant que les deux sont au même
// prix de vente, plus SAMII devient bon, moins la marge est bonne. Mettre
// Pro et Maître à la disposition du public AVANT d'avoir tranché ce point,
// c'est ouvrir un robinet qu'on ne mesure pas.
const CREDITS = require("./credits");
const PRIX_PROVISOIRE = CREDITS.PRIX_MESSAGE_USD;

// ── LA RÉFLEXION ─────────────────────────────────────────────────────────
//
// `generationConfig` ne porte QUE des champs universellement acceptés par
// l'API : température et plafond de jetons. Rien d'autre.
//
// Le budget de réflexion (thinkingConfig) existe sur les modèles récents et
// serait le bon levier — mais un champ que le modèle ne connaît pas fait
// échouer l'appel ENTIER avec un 400, pas un avertissement. Tant qu'il n'est
// pas vérifié contre l'API réelle, il reste derrière `reflexionEtendue`, qui
// vaut false partout. On l'allumera quand on aura mesuré, pas avant.
const NIVEAUX = {
    rapide: {
        id: "rapide",
        libelle: "Rapide",
        icone: "⚡",
        // Ce à quoi il sert, en langue de marchand — sert au sélecteur et à
        // l'aide, pour qu'aucune page ne réécrive sa propre description.
        pourQuoi: "Traduire, reformuler, répondre tout de suite",
        moteur: "flash",
        generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
        reflexionEtendue: false,
        // Aucun outil. Un tour « Rapide » qui déclencherait un appel réseau
        // ne serait plus rapide, et paierait pour une capacité qu'on ne lui
        // a pas demandée.
        familles: [],
        etapesMax: 1,
        prixUSD: PRIX_PROVISOIRE,
    },

    expert: {
        id: "expert",
        libelle: "Expert",
        icone: "🧠",
        pourQuoi: "Analyser, rédiger, lire tes propres données",
        moteur: "flash",
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        reflexionEtendue: false,
        familles: ["lecture"],
        etapesMax: 2,
        prixUSD: PRIX_PROVISOIRE,
    },

    pro: {
        id: "pro",
        libelle: "Pro",
        icone: "🔥",
        pourQuoi: "Un plan, une stratégie, plusieurs étapes",
        moteur: "pro",
        generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
        reflexionEtendue: false,
        // « Un plan, une stratégie, plusieurs étapes » : c'est exactement ce
        // qu'une chaîne de spécialistes sait faire. Pro est le premier
        // niveau où mobiliser plusieurs agents pour un seul message est une
        // dépense honnête.
        familles: ["lecture", "ecriture", "agents"],
        etapesMax: 4,
        prixUSD: PRIX_PROVISOIRE,
    },

    maitre: {
        id: "maitre",
        libelle: "Maître",
        icone: "👑",
        pourQuoi: "Problème complexe, plusieurs agents, travail en profondeur",
        moteur: "pro",
        generationConfig: { temperature: 0.9, maxOutputTokens: 8192 },
        reflexionEtendue: false,
        familles: ["lecture", "ecriture", "agents", "code"],
        etapesMax: 8,
        prixUSD: PRIX_PROVISOIRE,
    },
};

// L'ordre du plus léger au plus lourd. Sert à comparer deux niveaux, à
// plafonner, et à monter d'un cran — jamais à deviner un ordre par le nom.
const ORDRE = ["rapide", "expert", "pro", "maitre"];

// Le niveau par défaut quand personne n'a choisi. « Auto » n'est PAS un
// niveau : c'est la façon de le choisir. Un tour finit toujours sur un
// niveau réel, et c'est celui-là qu'on facture et qu'on trace.
const AUTO = "auto";
const DEFAUT = "expert";

// ── CE QUE LA BARRE DE SAISIE PROPOSE AVANT QU'ON CHOISISSE ──────────────
//
// À NE PAS CONFONDRE AVEC `DEFAUT` CI-DESSUS. `DEFAUT` est le filet de
// `niveau()` : ce qu'on rend quand un identifiant est illisible, côté
// serveur, pour ne jamais renvoyer `null`. `PRESELECTION` est un choix de
// PRODUIT : le cran affiché dans le sélecteur à la première visite.
//
// Les mélanger changerait la facturation en croyant changer un libellé.
// Ils sont donc déclarés séparément et n'ont pas à être égaux.
//
// « Rapide » plutôt qu'« Auto » : Auto laisse SAMII monter d'un cran quand
// il juge la demande lourde, et ce cran coûte plus cher — décidé par la
// machine, pas par la personne. En préselection, on préfère le cran le plus
// léger : il répond tout de suite, il ne surprend personne sur son solde, et
// celui qui veut plus le demande d'un clic. Auto reste proposé dans le menu,
// inchangé et intact — c'est seulement le point de départ qui bouge.
const PRESELECTION = "rapide";

// ── LIRE UN NIVEAU ───────────────────────────────────────────────────────
//
// Rend TOUJOURS un niveau utilisable, jamais null ni undefined. Un appelant
// qui reçoit null finirait par inventer son propre repli, et il divergerait.
function niveau(id) {
    return NIVEAUX[String(id || "").toLowerCase()] || NIVEAUX[DEFAUT];
}

function existe(id) {
    return Object.prototype.hasOwnProperty.call(NIVEAUX, String(id || "").toLowerCase());
}

// Comparer deux niveaux. -1 / 0 / 1, comme toute comparaison.
function comparer(a, b) {
    const ia = ORDRE.indexOf(niveau(a).id);
    const ib = ORDRE.indexOf(niveau(b).id);
    return ia === ib ? 0 : (ia < ib ? -1 : 1);
}

// ── LE PLAFOND ───────────────────────────────────────────────────────────
//
// Ce qu'un compte a le droit d'atteindre. Sans plafond, « fais-moi un plan
// complet » devient une façon pour n'importe qui de faire tourner le moteur
// le plus cher autant de fois qu'il le souhaite.
//
// Le plafond suit le palier payé, PAS le niveau demandé : c'est une question
// d'argent, pas d'effort. Un compte gratuit monte jusqu'à Expert ; dès qu'il
// y a un abonnement, tout est ouvert.
const PLAFOND_PAR_PALIER = {
    free: "expert",
    standard: "pro",
    pro: "maitre",
    societe: "maitre",
};

function plafond(palier) {
    return PLAFOND_PAR_PALIER[String(palier || "").toLowerCase()] || PLAFOND_PAR_PALIER.free;
}

// Ramener un niveau sous le plafond d'un compte. On ne refuse pas, on
// redescend : quelqu'un qui demande Maître sans y avoir droit doit obtenir
// une réponse au niveau le plus élevé auquel il a droit, pas une erreur.
function borner(idDemande, palier) {
    const max = plafond(palier);
    return comparer(idDemande, max) > 0 ? niveau(max) : niveau(idDemande);
}

// Monter d'un cran, sans jamais dépasser le plafond. Sert à l'escalade en
// cours de tour : SAMII démarre léger, découvre qu'il lui faut un outil, et
// on relance une fois plus haut.
function monter(idActuel, palier) {
    const i = ORDRE.indexOf(niveau(idActuel).id);
    const suivant = ORDRE[Math.min(i + 1, ORDRE.length - 1)];
    return borner(suivant, palier);
}

// ── LES OUTILS D'UN NIVEAU ───────────────────────────────────────────────
//
// Rend les NOMS que ce niveau a le droit de porter. La famille « commerce »
// n'est jamais incluse : elle ne dépend pas de l'effort mais de l'audience,
// et c'est geminiService qui l'arbitre — voir le commentaire de son
// buildToolsPayload.
function outilsDe(id) {
    const n = niveau(id);
    return n.familles.flatMap((f) => FAMILLES[f] || []);
}

// Ce niveau porte-t-il au moins un outil ? Sert à savoir s'il faut seulement
// envoyer une charge d'outils au modèle — un appel sans outil est plus court
// et moins cher.
function porteDesOutils(id) {
    return outilsDe(id).length > 0;
}

// La liste pour une page ou un sélecteur, dans l'ordre, « Auto » en tête
// parce que c'est le défaut et le bon choix pour presque tout le monde.
function pourAffichage() {
    return [
        { id: AUTO, libelle: "Auto", icone: "⚙️", pourQuoi: "SAMII choisit le niveau qu'il faut" },
        ...ORDRE.map((id) => {
            const n = NIVEAUX[id];
            return { id: n.id, libelle: n.libelle, icone: n.icone, pourQuoi: n.pourQuoi };
        }),
    ];
}

module.exports = {
    NIVEAUX, FAMILLES, ORDRE, AUTO, DEFAUT, PRESELECTION, PLAFOND_PAR_PALIER,
    niveau, existe, comparer, plafond, borner, monter,
    outilsDe, porteDesOutils, pourAffichage,
};
