// ==========================================================================
// SAMII OS — PAR OÙ COMMENCER, QUAND SAMII SAIT DÉJÀ QUI VOUS ÊTES
// ==========================================================================
//
// La page d'accueil proposait quatre amorces, les mêmes pour tout le monde :
//
//     « Développer mon activité »   « Organiser ma journée »
//     « Trouver les bons mots »     « Juste parler »
//
// Elles sont justes pour un visiteur anonyme — on ne sait rien de lui, et
// « juste parler » est une vraie porte d'entrée. Elles sont tièdes pour un
// marchand connecté dont on connaît le métier, le QG et les chiffres : il
// ouvre un assistant qui a son secteur en mémoire, et la première chose
// qu'il lit pourrait être écrite pour n'importe qui.
//
// Ce fichier écrit les amorces d'un marchand connecté. L'anonyme garde
// EXACTEMENT les quatre siennes — voir plus bas, c'est une règle, pas un
// oubli.
//
// ══════════════════════════════════════════════════════════════════════════
// CE QUI A ÉTÉ MESURÉ AVANT D'ÉCRIRE UNE LIGNE
// ══════════════════════════════════════════════════════════════════════════
//
// ── 1. LE NIVEAU PRÉSÉLECTIONNÉ NE PORTE AUCUN OUTIL ─────────────────────
//
// `config/niveaux.js` présélectionne « Rapide » dans la barre de saisie
// (`PRESELECTION`), et c'est un choix de produit assumé : le cran le plus
// léger, qui ne surprend personne sur son solde. Mesuré au vrai joint,
// `geminiService.buildToolsPayload(true, { audience: "souverain",
// niveau: "rapide", tourDeConversation: true })` :
//
//     rapide  → null   (aucun outil)
//     expert  → 10 outils
//     pro     → 16
//     maitre  → 17
//
// Conséquence : une amorce qui promet « je vais chercher tes chiffres »,
// cliquée à la première visite, part sur un tour SANS OUTIL. SAMII répond
// alors de mémoire, avec aplomb, sur des chiffres qu'il n'a pas lus. C'est
// exactement la panne que `config/niveaux.js` décrit déjà pour les questions
// de prix — « un prix inventé sur une question de prix est exactement ce qui
// fait perdre confiance en un assistant ».
//
// Donc : une amorce qui a besoin d'un outil PORTE le niveau minimal de cet
// outil (`niveau`), et la barre monte à ce cran au clic. Jamais au-dessus du
// besoin, jamais en descendant ce que la personne a choisi.
//
// Le surcoût est nul là où ça compte : Rapide et Expert tournent sur LE MÊME
// moteur (`moteur: "flash"` pour les deux dans la table). Monter à Expert
// pour pouvoir aller lire, c'est ce que le mode Auto fait déjà de lui-même
// (`services/niveauAuto.js`, plancher Expert) — on ne crée aucune règle, on
// applique la même à un clic.
//
// ── 2. LE REGISTRE DES SECTEURS NE PEUT PAS FOURNIR CES AMORCES ──────────
//
// L'idée évidente était de lire `SECTEURS[metier].actions` — le registre
// porte 182 actions sur 36 secteurs, dont 136 avec un outil nommé. Mesuré,
// action par action, ce que le marchand tient vraiment chez lui :
//
//     resume_journee          expert   →  1 seule phrase distincte,
//                                         identique dans les 36 secteurs
//     preparer_publication    pro      → 20 phrases distinctes
//     envoyer_email           pro      →  3
//     creer_evenement_agenda  pro      →  3
//     envoyer_facture         pro      →  2
//     creer_rapport_sheets    pro      →  1
//     confirmer_commande,  annuler_commande,
//     prendre_rendez_vous, proposer_creneaux_rdv
//                             → famille `commerce`, JAMAIS au marchand
//                               (config/audiences.js, chantier A)
//
// Autrement dit : pour un marchand au palier gratuit (plafond Expert), le
// registre des secteurs rend UNE amorce, la même pour les trente-six
// métiers. « Adapté au métier » y valait zéro. Sept métiers sur trente-six
// n'en tiraient rien du tout (avocat, comptable, photographe, événementiel,
// éducation, hôtel, agence de voyage).
//
// La matière vivante du registre n'est pas dans `actions` : elle est dans
// `problemes`. Cinq phrases par secteur, écrites une par une, qui nomment ce
// qui coûte de l'argent dans CE métier — « les colis qui reviennent non
// payés », « les créneaux perdus par les patients qui ne viennent pas »,
// « les délais de recours qui courent pendant qu'on attend une pièce ».
//
// ── 3. UNE AMORCE N'A PAS BESOIN D'UN OUTIL POUR ÊTRE HONNÊTE ────────────
//
// La règle du chantier est : ne jamais proposer un geste que l'audience ou
// le niveau ne peut pas exécuter. Répondre à « comment je règle ça ? » avec
// l'expertise du secteur EST une capacité réellement disponible, à tous les
// niveaux, sans outil et sans crédit d'action — le prompt reçoit déjà le bloc
// du secteur (`services/competences.js`).
//
// Les amorces se répartissent donc en deux familles, et la différence est
// explicite dans la donnée :
//
//     `fait` non nul  → un OUTIL part. On vérifie qu'il partira vraiment.
//     `fait` nul      → une CONVERSATION. Rien à vérifier, rien à promettre.
//
// ══════════════════════════════════════════════════════════════════════════
// CE QU'ON N'INVENTE PAS
// ══════════════════════════════════════════════════════════════════════════
//
// Aucun chiffre. Aucune amorce ne dit « tu as 3 commandes en attente » : il
// faudrait l'avoir lu, et la page ne lit pas la base pour ça. Les amorces
// qui touchent aux chiffres du marchand les font LIRE par l'outil, au clic.
//
// Aucune phrase de secteur réécrite, ni tronquée. Le libellé d'une amorce de
// douleur est la phrase du registre, verbatim, première lettre en capitale.
// La tronquer pour la faire tenir sur une ligne changerait ce qu'elle dit
// (« les commandes non confirmées expédiées quand même » n'est pas « les
// commandes non confirmées ») : c'est la puce qui s'adapte, pas le texte.
// ==========================================================================

const NIVEAUX = require("../config/niveaux");
const AUDIENCES = require("../config/audiences");
const niveauAuto = require("./niveauAuto");
const metiers = require("./metiers");

// ── L'AUDIENCE DE CETTE PAGE ──────────────────────────────────────────────
//
// « / » connecté, c'est le marchand chez lui : `souverain`. Écrit une fois
// ici plutôt que répété à chaque vérification — et surtout pas devinable :
// `config/audiences.js` ferme tout ce qu'il ne reconnaît pas, donc une
// faute de frappe rendrait zéro amorce au lieu d'en rendre trop.
const AUDIENCE = "souverain";

// ── LE NIVEAU MINIMAL D'UN OUTIL, LU DANS LA TABLE ───────────────────────
//
// Jamais écrit à la main. `config/niveaux.js` dit déjà quel niveau porte
// quelle famille ; le cran le plus bas qui contient l'outil est donc une
// LECTURE, pas une déclaration. Le jour où `marche_du_moment` passe de
// `lecture` à `ecriture`, l'amorce demande Pro toute seule.
function niveauMinimal(outil) {
    return NIVEAUX.ORDRE.find((id) => NIVEAUX.outilsDe(id).includes(outil)) || null;
}

// ── LE PLAFOND LE PLUS BAS DE TOUS LES PALIERS ───────────────────────────
//
// ⚠️ POURQUOI ON NE LIT PAS LE PALIER DU MARCHAND.
//
// Le palier vit en base (`services/samiiQuota.js` → `abonnementService`), et
// la page d'accueil ne le lit pas. On pourrait l'ajouter à sa lecture ; ce
// chantier ne le fait pas, et le choix est délibéré : une amorce dont le
// niveau tient chez le palier le PLUS CONTRAINT tient chez tous les autres.
// Une seule liste, vraie pour tout le monde, qui ne dépend d'aucune lecture
// supplémentaire et ne peut donc pas se tromper si la lecture échoue.
//
// Ce plafond est CALCULÉ sur la table des paliers, jamais nommé. Écrire
// « free » ici aurait cassé au premier palier moins cher ajouté demain.
//
// Ce que ça coûte : les amorces de niveau Pro (préparer une publication, une
// stratégie) ne sont pas proposées, même à qui les paie. C'est un manque
// assumé et réparable — il suffira de faire descendre le palier jusqu'ici.
const PALIER_LE_PLUS_CONTRAINT = Object.keys(NIVEAUX.PLAFOND_PAR_PALIER)
    .reduce((bas, palier) => (
        NIVEAUX.comparer(NIVEAUX.plafond(palier), NIVEAUX.plafond(bas)) < 0 ? palier : bas
    ));
const PLAFOND_COMMUN = NIVEAUX.plafond(PALIER_LE_PLUS_CONTRAINT);

// ── LES GESTES, UNE FOIS ─────────────────────────────────────────────────
//
// Un registre, pas du code recopié. Chaque entrée nomme l'outil qui
// l'exécute VRAIMENT — le même nom que `services/geminiService.js` déclare et
// que `config/niveaux.js` classe. Un nom inventé ici ne rendrait pas une
// amorce cassée : il ne rendrait aucune amorce, parce que `niveauMinimal`
// répondrait `null`. Fermé par défaut, comme le reste du projet.
//
// ── POURQUOI CES QUATRE-LÀ, ET PAS LES DIX ───────────────────────────────
//
// Expert en porte dix. Six sont écartés, chacun pour une raison mesurée :
//
//   consulter_gmail, consulter_agenda, lister_fichiers_drive
//     Ils exigent un connecteur Google branché. La page ne sait pas s'il
//     l'est. Proposer « regarde mon agenda » à qui n'a rien branché, c'est
//     promettre pour rien — et c'est la panne que ce chantier corrige.
//
//   historique_client
//     Il lui faut un nom de client. Une amorce ne peut pas en fournir un
//     sans l'inventer.
//
//   rechercher_prospects, trouver_fournisseur
//     Utiles, mais moins universels : un dentiste ne cherche pas des
//     prospects sur le web, et un avocat ne s'approvisionne pas. Ils
//     restent atteignables en une phrase ; ils ne prennent pas une des six
//     places de la page.
//
// `besoinDunQG` : ces deux-là lisent l'espace de travail du marchand. Sans
// QG, l'outil part et revient vide — l'amorce n'est donc pas proposée. Un
// outil qui répond « rien » est pire qu'une amorce absente : la personne
// conclut que son activité est vide, pas qu'elle n'a pas encore d'espace.
const GESTES = [
    {
        fait: "etat_de_mon_business",
        libelle: "Où en est mon activité ?",
        demande: "Fais le point sur mon activité : mes chiffres réels, ce qui monte, ce qui bloque.",
        besoinDunQG: true,
    },
    {
        fait: "resume_journee",
        libelle: "Ce qui s'est passé aujourd'hui",
        demande: "Qu'est-ce qui s'est passé dans mon activité ces dernières 24 heures ?",
        besoinDunQG: true,
    },
    {
        fait: "prix_du_marche",
        libelle: "Mes prix sont-ils bien placés ?",
        demande: "Compare mes prix à ceux pratiqués ailleurs : est-ce que je suis bas, bien placé ou trop haut ?",
        besoinDunQG: false,
    },
    {
        fait: "marche_du_moment",
        libelle: "Ce qui marche en ce moment",
        demande: "Qu'est-ce qui se vend bien en ce moment dans mon secteur, et qu'est-ce que je pourrais saisir ?",
        besoinDunQG: false,
    },
];

// ⚠️ L'ORDRE DE CETTE LISTE EST UN ORDRE DE PRIORITÉ, PAS UN RANGEMENT.
//
// Mesuré : un métier qui porte trois douleurs ou plus remplit les six places
// avec trois gestes et trois douleurs — le QUATRIÈME geste ne s'affiche
// jamais. Trente-quatre secteurs sur trente-six sont dans ce cas.
//
// C'est donc le dernier de cette liste qui tombe, et il tombe pour presque
// tout le monde. `prix_du_marche` est passé devant `marche_du_moment` pour
// cette seule raison : « mes prix sont-ils bons ? » est une question qu'un
// marchand se pose sur SON activité, « qu'est-ce qui marche ? » une question
// qu'il se pose sur le marché. La première d'abord.

// ── LA DOULEUR DU MÉTIER, TELLE QUE LE REGISTRE L'ÉCRIT ──────────────────
//
// Le libellé est la phrase de `SECTEURS[metier].problemes`, verbatim.
//
// La demande, elle, l'encadre : « dans mon métier il y a souvent ce
// problème » — et pas « mon plus gros problème c'est ». La nuance n'est pas
// cosmétique. Le registre décrit ce qui coûte cher DANS LE SECTEUR ; il ne
// sait pas si c'est vrai chez cette personne-là. Faire dire au marchand une
// chose qu'on n'a pas vérifiée, c'est lui mettre un chiffre inventé dans la
// bouche, en plus poli.
const CADRE_DOULEUR = (probleme) =>
    `Dans mon métier il y a souvent ce problème : ${probleme}. Chez moi, concrètement, comment je le règle ?`;

// ── « CE QUE J'AI DÉJÀ SUFFIT-IL ? » — RÉPONDU ICI, PAS DANS LE NAVIGATEUR
//
// Le navigateur doit décider s'il faut monter la barre avant d'envoyer. Il
// pourrait comparer deux niveaux… s'il connaissait leur ordre. Il ne le
// connaît pas, et le lui faire deviner était un piège :
//
//   • recopier `ORDRE` dans le JavaScript, c'est une cinquième échelle qui
//     divergera (le défaut que `config/niveaux.js` documente en tête) ;
//   • lire l'ordre sur le menu du DOM, c'est se tromper sur « Auto » —
//     `pourAffichage()` le met EN PREMIER, donc il paraît le plus faible
//     alors qu'il monte jusqu'à Maître. On aurait remplacé Auto par Expert,
//     c'est-à-dire ABAISSÉ le plafond de quelqu'un pour « le protéger ».
//
// Donc on ne compare pas. Le serveur énumère les crans qui SUFFISENT déjà, et
// le navigateur ne fait plus qu'une appartenance — aucune table recopiée,
// aucun ordre supposé.
//
// « Auto » n'y est ajouté que s'il est MESURÉ suffisant : on fait tourner le
// vrai classement (`services/niveauAuto.js`) sur la phrase de cette amorce,
// au plafond le plus bas de tous les paliers, et on regarde si le niveau
// retenu porte l'outil. Auto plancherait sur « Rapide » si la phrase était
// prise pour un geste simple (« résume… », « traduis… ») — et Rapide ne porte
// rien. Le supposer aurait été le genre d'hypothèse qui tient jusqu'au jour
// où quelqu'un reformule un libellé.
function cransQuiSuffisent(outil, phrase) {
    const suffisent = NIVEAUX.ORDRE.filter((id) => NIVEAUX.outilsDe(id).includes(outil));

    const choix = niveauAuto.choisir({
        message: String(phrase || ""),
        demande: NIVEAUX.AUTO,
        palier: PALIER_LE_PLUS_CONTRAINT,
    });
    if (NIVEAUX.outilsDe(choix.niveau).includes(outil)) suffisent.push(NIVEAUX.AUTO);

    return suffisent;
}

// Première lettre en capitale, le reste intact. Les phrases du registre
// commencent en minuscule (« les colis qui reviennent non payés ») parce
// qu'elles y sont des éléments de liste ; sur une puce, elles commencent une
// phrase. On ne touche à rien d'autre.
function enTete(phrase) {
    const s = String(phrase || "").trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

// ── LES AMORCES D'UN MARCHAND ────────────────────────────────────────────
//
// Rend une liste ORDONNÉE, prête à peindre. L'ordre alterne : un geste qui
// lit ses données, puis une phrase qui nomme sa réalité, et ainsi de suite.
// Six maximum — c'est ce qui tient sur un écran de 390 px sans repousser la
// barre de saisie hors de vue, et une liste d'amorces qu'il faut lire n'est
// plus une amorce.
//
// ── QUAND ELLE REND `[]`, ET POURQUOI C'EST UN CAS NORMAL ────────────────
//
// Rend `[]` dès qu'il y a moins de `MINIMUM` amorces à proposer. Ça arrive
// vraiment : un compte sans QG et sans métier — inscription non terminée —
// ne garde que deux gestes (les deux qui ne lisent pas son espace).
//
// Deux puces au lieu de quatre, ce n'est pas « plus ciblé », c'est une page
// qui a l'air cassée. L'appelant retombe donc sur les quatre amorces
// génériques, qui sont JUSTES pour quelqu'un dont on ne sait rien — elles ne
// sont tièdes que quand on sait quelque chose.
//
// Le seuil est ici et pas dans le gabarit : une vue qui compte des éléments
// pour décider quoi afficher est une règle produit écrite là où personne ne
// la cherchera, et personne ne pourra la tester.
const MINIMUM = 3;

function pour({ metier = "", aUnQG = false, max = 6 } = {}) {
    const id = String(metier || "").trim().toLowerCase();
    const secteur = id ? metiers.SECTEURS[id] : null;

    // Ce que le marchand tient réellement au plafond commun à tous les
    // paliers. UNE seule expression, celle du projet : AUDIENCE ∩ NIVEAU.
    // On ne recopie ni la table des audiences ni celle des niveaux.
    const tenus = new Set(AUDIENCES.outilsDuTour(AUDIENCE, PLAFOND_COMMUN));

    const gestes = [];
    for (const g of GESTES) {
        if (g.besoinDunQG && !aUnQG) continue;
        if (!tenus.has(g.fait)) continue;          // l'outil ne partirait pas
        const niveau = niveauMinimal(g.fait);
        if (!niveau) continue;                     // outil inconnu de la table
        gestes.push({
            libelle: g.libelle, demande: g.demande, fait: g.fait, niveau,
            suffit: cransQuiSuffisent(g.fait, g.demande),
        });
    }

    const douleurs = (secteur?.problemes || []).map((p) => ({
        libelle: enTete(p),
        demande: CADRE_DOULEUR(p),
        fait: null,
        // Aucun outil, donc aucun niveau à demander : la barre garde le cran
        // que la personne a choisi. Monter le niveau pour une conversation
        // serait dépenser plus sans rien ajouter.
        niveau: null,
        // Tous les crans conviennent, donc aucun n'est à lister : le
        // navigateur ne monte que sur une amorce qui porte un `niveau`.
        suffit: [],
    }));

    // ── L'ALTERNANCE ─────────────────────────────────────────────────────
    //
    // Deux listes entrelacées plutôt que concaténées. Concaténées, les
    // quatre gestes — identiques pour les trente-six métiers — passaient
    // devant, et la première chose que le marchand lisait était encore une
    // fois générique. L'alternance met sa réalité en deuxième position.
    const sortie = [];
    for (let i = 0; sortie.length < max && (i < gestes.length || i < douleurs.length); i++) {
        if (gestes[i]) sortie.push(gestes[i]);
        if (sortie.length < max && douleurs[i]) sortie.push(douleurs[i]);
    }
    return sortie.length >= MINIMUM ? sortie : [];
}

module.exports = {
    pour, GESTES, AUDIENCE, PLAFOND_COMMUN, PALIER_LE_PLUS_CONTRAINT, MINIMUM,
    niveauMinimal, cransQuiSuffisent, enTete, CADRE_DOULEUR,
};
