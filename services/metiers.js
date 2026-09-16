// ==========================================================================
// SAMII OS — MÉTIERS (source unique)
//
// La liste vivait en double (routes/workspace.js et routes/agence.js) avec
// des valeurs qui commençaient à diverger. Elle est maintenant définie ici,
// une seule fois, et consommée partout.
//
// Règle de sélection : un métier n'entre dans cette liste que si SAMII sait
// dire quelque chose de SPÉCIFIQUE à ce métier (vocabulaire, rythme de
// rendez-vous, type de client). Sinon c'est du décor qui allonge un menu
// déroulant sans rien apporter.
//
// Ce qui a été retiré : agriculture, industrie, technologie, finance —
// aucune de ces activités ne correspond au marché réellement visé
// (Maghreb et Afrique de l'Ouest, commerces et professions de proximité).
// Ce qui a été ajouté : le détail du médical et de la beauté, deux secteurs
// entièrement organisés autour du rendez-vous, où SAMII apporte le plus.
//
// Un métier absent de la liste n'est jamais un blocage : l'onboarding
// conversationnel (routes/workspace.js, POST /onboarding-chat) enregistre
// le métier libre saisi par le marchand.
// ==========================================================================

// parcours "rdv"     → l'activité tourne autour de rendez-vous à honorer
// parcours "produit" → l'activité tourne autour de commandes à livrer
const METIERS = [
    // ── Santé ────────────────────────────────────────────────────────────
    { id: "dentiste",    label: "Dentiste",              groupe: "Santé",           icone: "🦷", parcours: "rdv" },
    { id: "medecin",     label: "Médecin",               groupe: "Santé",           icone: "🩺", parcours: "rdv" },
    { id: "kine",        label: "Kinésithérapeute",      groupe: "Santé",           icone: "💆", parcours: "rdv" },
    { id: "laboratoire", label: "Laboratoire d'analyses", groupe: "Santé",          icone: "🔬", parcours: "rdv" },
    { id: "opticien",    label: "Opticien",              groupe: "Santé",           icone: "👓", parcours: "rdv" },
    { id: "pharmacie",   label: "Pharmacie",             groupe: "Santé",           icone: "💊", parcours: "produit" },
    { id: "veterinaire", label: "Vétérinaire",           groupe: "Santé",           icone: "🐾", parcours: "rdv" },

    // ── Beauté & bien-être ───────────────────────────────────────────────
    { id: "coiffeur",    label: "Coiffeur",              groupe: "Beauté & bien-être", icone: "💇", parcours: "rdv" },
    { id: "barbier",     label: "Barbier",               groupe: "Beauté & bien-être", icone: "💈", parcours: "rdv" },
    { id: "esthetique",  label: "Institut de beauté",    groupe: "Beauté & bien-être", icone: "💅", parcours: "rdv" },
    { id: "spa",         label: "Spa / Hammam",          groupe: "Beauté & bien-être", icone: "🧖", parcours: "rdv" },
    { id: "salle_sport", label: "Salle de sport",        groupe: "Beauté & bien-être", icone: "🏋️", parcours: "rdv" },

    // ── Restauration ─────────────────────────────────────────────────────
    { id: "restaurant",  label: "Restaurant",            groupe: "Restauration",    icone: "🍽️", parcours: "produit" },
    { id: "fastfood",    label: "Fast-food",             groupe: "Restauration",    icone: "🍔", parcours: "produit" },
    { id: "patisserie",  label: "Pâtisserie",            groupe: "Restauration",    icone: "🧁", parcours: "produit" },
    { id: "cafe",        label: "Café / Salon de thé",   groupe: "Restauration",    icone: "☕", parcours: "produit" },
    { id: "traiteur",    label: "Traiteur",              groupe: "Restauration",    icone: "🍱", parcours: "rdv" },

    // ── Commerce ─────────────────────────────────────────────────────────
    { id: "ecommerce",   label: "Boutique en ligne",     groupe: "Commerce",        icone: "🛍️", parcours: "produit" },
    { id: "boutique",    label: "Boutique physique",     groupe: "Commerce",        icone: "🏪", parcours: "produit" },
    { id: "pretaporter", label: "Prêt-à-porter",         groupe: "Commerce",        icone: "👗", parcours: "produit" },
    { id: "electronique", label: "Électronique / Téléphonie", groupe: "Commerce",   icone: "📱", parcours: "produit" },
    { id: "ameublement", label: "Ameublement / Déco",    groupe: "Commerce",        icone: "🛋️", parcours: "produit" },
    // Ajouté au chantier 9c : c'est l'un des six secteurs approfondis, et il
    // n'existait pas. On ne peut pas spécialiser un métier absent, et le
    // créer ailleurs aurait fabriqué le registre parallèle qu'on refuse.
    { id: "grossiste",   label: "Grossiste",             groupe: "Commerce",        icone: "📦", parcours: "produit" },

    // ── Services ─────────────────────────────────────────────────────────
    { id: "immobilier",  label: "Agence immobilière",    groupe: "Services",        icone: "🏘️", parcours: "rdv" },
    { id: "autoecole",   label: "Auto-école",            groupe: "Services",        icone: "🚗", parcours: "rdv" },
    { id: "garage",      label: "Garage / Mécanique",    groupe: "Services",        icone: "🔧", parcours: "rdv" },
    // Ajouté au chantier 9c, même raison que « grossiste ». Parcours « rdv » :
    // ce qui se vend est une PÉRIODE pendant laquelle un véhicule précis est
    // bloqué. Traité en « produit », son QG afficherait des commandes à
    // livrer au lieu du planning qui fait tout le métier.
    { id: "location_voitures", label: "Location de voitures", groupe: "Services",   icone: "🚙", parcours: "rdv" },
    { id: "avocat",      label: "Avocat",                groupe: "Services",        icone: "⚖️", parcours: "rdv" },
    { id: "comptable",   label: "Comptable",             groupe: "Services",        icone: "📊", parcours: "rdv" },
    { id: "photographe", label: "Photographe",           groupe: "Services",        icone: "📷", parcours: "rdv" },
    { id: "evenementiel", label: "Événementiel",         groupe: "Services",        icone: "🎉", parcours: "rdv" },
    { id: "livreur",     label: "Livraison / Coursier",  groupe: "Services",        icone: "🚚", parcours: "produit" },

    // ── Formation & tourisme ─────────────────────────────────────────────
    { id: "education",   label: "École / Formation",     groupe: "Formation & tourisme", icone: "🎓", parcours: "rdv" },
    { id: "hotel",       label: "Hôtel / Maison d'hôtes", groupe: "Formation & tourisme", icone: "🏨", parcours: "rdv" },
    { id: "agence_voyage", label: "Agence de voyage",    groupe: "Formation & tourisme", icone: "✈️", parcours: "rdv" },

    // Filet de sécurité : quelqu'un dont le métier n'est pas listé n'est
    // jamais bloqué, et SAMII lui demande de préciser.
    { id: "autre",       label: "Autre activité",        groupe: "Autre",           icone: "🏢", parcours: "produit" },
];

const PAR_ID = new Map(METIERS.map(m => [m.id, m]));

const IDS = new Set(METIERS.map(m => m.id));

// Valeurs déjà enregistrées en base par d'anciens marchands, qui ne sont
// plus proposées à l'inscription mais dont le QG doit continuer à afficher
// les rendez-vous et non des commandes. Sans ce filet, un notaire ou un
// architecte déjà inscrit basculerait du jour au lendemain sur un parcours
// "produit" et perdrait son calendrier.
const RDV_HISTORIQUES = [
    "sante", "notaire", "courtier", "lavage", "mecanicien",
    "tatoueur", "formateur", "architecte", "agence", "service",
    "services", "tourisme", "finance",
];

/** Métiers dont l'activité tourne autour des rendez-vous. */
const IDS_RDV = new Set([
    ...METIERS.filter(m => m.parcours === "rdv").map(m => m.id),
    ...RDV_HISTORIQUES,
]);

function estValide(id) {
    return IDS.has(String(id || "").toLowerCase());
}

function estRdv(id) {
    return IDS_RDV.has(String(id || "").toLowerCase());
}

function label(id) {
    const m = PAR_ID.get(String(id || "").toLowerCase());
    // Un métier libre (saisi à l'onboarding) n'est pas dans la liste : on
    // l'affiche tel quel, capitalisé, plutôt que de perdre l'information.
    if (m) return m.label;
    const brut = String(id || "").trim();
    return brut ? brut.charAt(0).toUpperCase() + brut.slice(1) : "Activité";
}

function icone(id) {
    return PAR_ID.get(String(id || "").toLowerCase())?.icone || "🏢";
}

/** Groupés pour l'affichage (menus déroulants avec <optgroup>). */
function parGroupe() {
    const groupes = [];
    for (const m of METIERS) {
        let g = groupes.find(x => x.nom === m.groupe);
        if (!g) { g = { nom: m.groupe, metiers: [] }; groupes.push(g); }
        g.metiers.push(m);
    }
    return groupes;
}

// ══════════════════════════════════════════════════════════════════════════
// CE QUE CHAQUE MÉTIER PERD VRAIMENT, DANS SES PROPRES MOTS
// ══════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE BLOC EXISTE, ET POURQUOI IL EST ÉCRIT À LA MAIN.
//
// Chaque métier a une page publique — c'est par là que Google amène les gens.
// La tentation est de générer ces pages depuis un gabarit : « SAMII aide les
// {métier} à gagner du temps ». Trente-quatre pages qui ne diffèrent que par
// un mot, c'est du contenu dupliqué : Google en indexe une, ignore les
// trente-trois autres, et le travail n'aura servi à rien. Pire, un visiteur
// qui lit « gagner du temps » n'apprend rien et repart.
//
// Une page ne mérite d'exister que si elle dit quelque chose que le
// professionnel reconnaît immédiatement comme SON problème. D'où ces trois
// phrases par métier, écrites une par une :
//   - `perte`   : l'argent ou le temps qui s'en va, nommé concrètement ;
//   - `defaut`  : l'habitude actuelle qui cause cette perte ;
//   - `reponse` : ce que SAMII fait précisément à la place.
//
// La règle de sélection reste celle de la liste : si on ne sait rien dire de
// spécifique à un métier, il n'a pas sa place ici — et sa page non plus.
// ══════════════════════════════════════════════════════════════════════════
// LE VOCABULAIRE — comment un marchand NOMME son activité
// ══════════════════════════════════════════════════════════════════════════
//
// POURQUOI CE BLOC EXISTE, ET POURQUOI IL EST ICI.
//
// Personne n'écrit « je suis dans le prêt-à-porter ». On écrit « je vends des
// habits », « je fais du bazin », « j'ai une boutique de fringues ». Le
// libellé officiel d'un métier ne sert qu'aux menus déroulants ; il ne sert à
// rien pour reconnaître quelqu'un qui se présente avec ses propres mots.
//
// ── CE QUE LA MESURE A DONNÉ ─────────────────────────────────────────────
//
// Premier essai : déduire les mots des libellés et des groupes déjà écrits.
// Résultat mesuré sur de vraies phrases — « je suis coiffeur » et « j'ai un
// restaurant » passaient, « je vends des vêtements sur Instagram », « je
// répare des voitures » et « je fais des gâteaux » ne trouvaient rien.
//
// Deuxième essai : y ajouter le texte des fiches (perte/défaut/réponse).
// Ça rattrapait le garage et la pâtisserie — et ça inventait un métier à
// partir de n'importe quelle phrase. « J'ai 20 commandes en retard »
// ressortait en `restaurant` ou `patisserie`. SAMII aurait décidé que
// quelqu'un est pâtissier parce qu'il parle de commandes en retard. C'est
// pire que ne rien deviner.
//
// D'où ce bloc, et la garde qui va avec (services/competences.js) : un métier
// n'est reconnu QUE dans une phrase où la personne DÉCLARE son activité.
// Un mot croisé ailleurs ne compte pas.
//
// ── POURQUOI DANS CE FICHIER ─────────────────────────────────────────────
//
// Parce que c'est la source unique des métiers. Un deuxième fichier de
// vocabulaire aurait divergé de la liste au premier métier ajouté — c'est
// exactement ce qui est arrivé trois fois dans ce projet. Un métier sans
// vocabulaire est un cas normal : il ne sera simplement pas reconnu dans une
// phrase libre, il reste choisissable dans le menu.
// ── POURQUOI CES MOTS SONT MAINTENANT ÉCRITS EN FRANÇAIS CORRECT ─────────
//
// Ils étaient sans accents et sans apostrophes — « medecin », « patisserie »,
// « cabinet d avocat » — parce qu'ils ne servaient qu'à RECONNAÎTRE ce qu'on
// tape, jamais à être lus.
//
// Ils sont maintenant lus : la fiche publique de chaque métier les affiche,
// puisque ce sont les mots sous lesquels ses clients le cherchent. Et
// « salon de thé » écrit « salon de the » sur une page de vente ne se lit pas
// comme un choix technique, il se lit comme une faute.
//
// ── CE QUE ÇA NE CHANGE PAS, ET POURQUOI C'EST SÛR ───────────────────────
//
// services/competences.js est le SEUL consommateur de cette table, et il
// passe chaque mot par sa fonction `normaliser()` avant de l'indexer — elle
// met en minuscules, retire les accents (NFD) et remplace les apostrophes par
// une espace, des deux côtés de la comparaison. « médecin » et « medecin » y
// deviennent donc la même clé.
//
// L'équivalence a été VÉRIFIÉE au moment du changement, mot par mot : les 177
// entrées normalisent exactement comme avant, aucune exception. Ce que
// tests/competences.test.js garde ensuite, c'est ce qui pourrait la rompre —
// voir le piège du trait d'union juste en dessous — et les 211 vérifications
// de reconnaissance qui passaient déjà passent toujours.
//
// ⚠️ DEUX PIÈGES, ÉVITÉS EXPRÈS :
//   - le TRAIT D'UNION n'est pas une apostrophe. `normaliser` ne le touche
//     pas : « bien-être » donnerait « bien-etre » au lieu de « bien etre »,
//     et le mot ne serait plus reconnu. On écrit donc « bien être »,
//     « prêt à porter », « auto école » — avec des espaces.
//   - « ecommerce » et « e commerce » restent tels quels : ce sont deux
//     graphies de saisie, pas une faute à corriger.
const VOCABULAIRE = {
    dentiste:    ["dentiste", "dentaire", "cabinet dentaire", "orthodontiste"],
    medecin:     ["médecin", "docteur", "cabinet médical", "généraliste", "consultation"],
    kine:        ["kiné", "kinésithérapeute", "physiothérapie", "rééducation"],
    laboratoire: ["laboratoire", "labo", "analyses", "prélèvement"],
    opticien:    ["opticien", "lunettes", "optique", "verres"],
    pharmacie:   ["pharmacie", "pharmacien", "parapharmacie", "médicaments"],
    veterinaire: ["vétérinaire", "véto", "clinique animale"],

    // « salon » seul est retiré : mesuré, « mon salon de thé » ressortait aussi
    // en coiffeur. Un mot trop général range les gens dans le mauvais métier.
    coiffeur:    ["coiffeur", "coiffeuse", "coiffure", "salon de coiffure", "tresses", "nattes"],
    barbier:     ["barbier", "barbe", "barber"],
    esthetique:  ["esthétique", "institut de beauté", "esthéticienne", "soin visage", "onglerie", "manucure"],
    spa:         ["spa", "hammam", "massage", "bien être"],
    salle_sport: ["salle de sport", "musculation", "fitness", "coach sportif", "gym"],

    restaurant:  ["restaurant", "restauration", "resto", "maquis", "plats", "cuisine"],
    fastfood:    ["fast food", "fastfood", "burger", "sandwich", "shawarma", "tacos", "pizzeria", "pizza"],
    patisserie:  ["pâtisserie", "gâteaux", "gâteau", "pâtissier", "boulangerie", "viennoiserie"],
    cafe:        ["café", "salon de thé", "cafétéria", "coffee"],
    traiteur:    ["traiteur", "buffet", "réception", "mariage"],

    ecommerce:   ["ecommerce", "e commerce", "vente en ligne", "boutique en ligne", "vends en ligne", "shopify", "dropshipping"],
    boutique:    ["boutique", "magasin", "commerce de détail", "épicerie", "supérette"],
    pretaporter: ["prêt à porter", "vêtements", "vêtement", "habits", "fringues", "mode", "bazin", "tissu", "tissus", "wax", "pagne", "abaya", "hijab", "chaussures"],
    electronique: ["électronique", "téléphones", "smartphones", "informatique", "ordinateurs", "électroménager"],
    ameublement: ["ameublement", "meubles", "meuble", "canapé", "salon marocain", "décoration", "literie"],
    // « gros » seul est écarté, pour la même raison que « salon » plus haut :
    // un mot trop général range les gens dans le mauvais métier.
    grossiste:   ["grossiste", "vente en gros", "demi gros", "revendeur", "revendeurs", "dépôt de marchandise", "importateur"],

    immobilier:  ["immobilier", "agence immobilière", "location appartement", "vente terrain", "agent immobilier"],
    autoecole:   ["auto école", "autoécole", "permis de conduire", "moniteur"],
    garage:      ["garage", "mécanicien", "mécanique", "répare des voitures", "réparation auto", "carrosserie", "tôlerie", "vidange"],
    // Aucun mot ne contient « voiture » tout court : « répare des voitures »
    // appartient au garage, et les deux métiers se confondraient.
    location_voitures: ["location de voiture", "location de voitures", "louer une voiture", "loue des voitures", "agence de location", "rent a car", "location auto"],
    avocat:      ["avocat", "cabinet d'avocat", "juridique", "notaire"],
    comptable:   ["comptable", "comptabilité", "expert comptable", "fiscaliste", "bilan"],
    photographe: ["photographe", "photographie", "photo", "studio photo", "vidéaste"],
    evenementiel: ["événementiel", "organisation d'événements", "wedding planner", "décoration mariage"],
    livreur:     ["livreur", "livraison", "coursier", "transporteur", "logistique"],

    education:   ["école", "formation", "cours", "professeur", "enseignant", "soutien scolaire", "centre de formation"],
    hotel:       ["hôtel", "auberge", "maison d'hôte", "riad", "hébergement", "chambres"],
    agence_voyage: ["agence de voyage", "voyages", "omra", "billets d'avion", "tourisme"],
};

const DOULEURS = {
    // ── Santé ────────────────────────────────────────────────────────────
    dentiste:    { perte: "Un fauteuil vide à 14h ne se rattrape pas le soir.", defaut: "Les rendez-vous se prennent au téléphone, pendant que vous soignez.", reponse: "Prise de rendez-vous en ligne, rappel la veille, et la liste d'attente comble l'annulation sans que vous décrochiez." },
    medecin:     { perte: "Les patients qui ne viennent pas coûtent une consultation pleine.", defaut: "Le carnet papier ne sait pas prévenir la veille.", reponse: "Rappel automatique, confirmation demandée, créneau libéré et reproposé aussitôt." },
    kine:        { perte: "Une séance manquée dans une série casse le protocole et la facturation.", defaut: "Les séries de séances se suivent de tête ou sur un tableau.", reponse: "SAMII suit la série entière, rappelle chaque séance et signale celles qui décrochent." },
    laboratoire: { perte: "Les patients rappellent pour savoir si les résultats sont prêts.", defaut: "Chaque appel interrompt le travail de paillasse.", reponse: "Le patient est prévenu dès que c'est prêt, et récupère par lui-même." },
    opticien:    { perte: "Une commande de verres oubliée, c'est un client qui revient pour rien.", defaut: "Le suivi vit sur des bons papier dans un tiroir.", reponse: "Chaque commande a son état, le client est prévenu à l'arrivée." },
    pharmacie:   { perte: "Une rupture sur un traitement chronique envoie le patient à la pharmacie d'en face.", defaut: "Le stock se vérifie quand quelqu'un le demande.", reponse: "Alerte avant la rupture sur les références qui tournent, et commande préparée." },
    veterinaire: { perte: "Les rappels de vaccin oubliés, c'est votre suivi qui s'arrête.", defaut: "Les rappels dépendent de la mémoire du propriétaire.", reponse: "Rappel automatique par WhatsApp au bon mois, avec l'historique de l'animal." },

    // ── Beauté & bien-être ───────────────────────────────────────────────
    coiffeur:    { perte: "Une heure vide ne se revend pas le lendemain : votre stock, c'est votre agenda.", defaut: "Les rendez-vous arrivent en DM et se notent de tête.", reponse: "La cliente choisit son créneau, reçoit un rappel la veille, et la liste d'attente remplit les trous." },
    barbier:     { perte: "Les clients qui passent sans rendez-vous repartent quand ça déborde.", defaut: "La file d'attente ne se voit que depuis l'intérieur du salon.", reponse: "File d'attente en ligne : le client voit son tour et arrive au bon moment." },
    esthetique:  { perte: "Les soins en cure s'arrêtent au milieu et ne se terminent jamais.", defaut: "C'est à la cliente de penser à reprendre son rendez-vous.", reponse: "SAMII propose la séance suivante pendant que la cliente est encore là, puis relance." },
    spa:         { perte: "Les créneaux de semaine restent vides pendant que le samedi refuse du monde.", defaut: "Aucun moyen simple de remplir les heures creuses.", reponse: "Offre automatique sur les heures creuses, envoyée aux clientes habituées." },
    salle_sport: { perte: "Un abonné qui ne vient plus ne se réabonne pas.", defaut: "L'absence ne se remarque qu'au non-renouvellement.", reponse: "SAMII repère qui a décroché et relance avant la fin de l'abonnement." },

    // ── Restauration ─────────────────────────────────────────────────────
    restaurant:  { perte: "Les commandes prises au téléphone pendant le coup de feu partent avec des erreurs.", defaut: "Le téléphone sonne au pire moment du service.", reponse: "Menu et commande en ligne, la cuisine reçoit une commande écrite et lisible." },
    fastfood:    { perte: "Une file qui s'allonge fait partir un client sur trois.", defaut: "La prise de commande est le goulot d'étranglement.", reponse: "Commande à l'avance, préparée pour l'heure choisie." },
    patisserie:  { perte: "Une commande de gâteau notée sur un carnet et perdue, c'est une fête gâchée.", defaut: "Les commandes spéciales vivent sur des bouts de papier.", reponse: "Chaque commande a sa date, son parfum, son acompte, et un rappel la veille." },
    cafe:        { perte: "Les habitués ne reviennent que s'ils y pensent.", defaut: "Aucune raison de revenir n'est jamais envoyée.", reponse: "Carte de fidélité et offres envoyées aux habitués, sans imprimer une carte." },
    traiteur:    { perte: "Deux événements le même jour, et vous acceptez à l'aveugle.", defaut: "Les devis et les dates vivent dans la messagerie.", reponse: "Devis, acompte et calendrier au même endroit, avec ce que vous pouvez encore accepter." },

    // ── Commerce ─────────────────────────────────────────────────────────
    ecommerce:   { perte: "En paiement à la livraison, le colis qui revient invendu emporte la marge de trois ventes.", defaut: "La commande arrive en DM, l'adresse est recopiée à la main, rien n'est confirmé avant l'expédition.", reponse: "Page de commande, confirmation automatique avant l'envoi, suivi du colis : un colis non confirmé ne part pas." },
    boutique:    { perte: "Ce qui est en rayon ne se vend qu'aux gens qui passent devant.", defaut: "Le stock n'existe nulle part en dehors du magasin.", reponse: "Le même stock devient une vitrine en ligne, avec retrait en boutique." },
    pretaporter: { perte: "Les retours pour taille représentent l'essentiel des colis qui reviennent.", defaut: "La cliente commande sans savoir si ça lui ira.", reponse: "Guide des tailles rattaché à chaque article, et SAMII répond aux questions de taille avant la commande." },
    electronique:{ perte: "Les questions techniques avant achat partent en discussions sans fin.", defaut: "Chaque client repose les mêmes questions en message privé.", reponse: "SAMII connaît vos fiches produit et répond, avec le stock et la garantie." },
    ameublement: { perte: "Une livraison volumineuse ratée se repaie en entier.", defaut: "Les créneaux de livraison se conviennent au téléphone.", reponse: "Créneau choisi par le client, confirmé la veille, avec l'adresse et l'étage." },
    grossiste:   { perte: "Un prix accordé de tête sur un gros volume mange la marge de tout le lot.", defaut: "Les tarifs par quantité vivent dans la tête du patron et dans d'anciens bons.", reponse: "Chaque client professionnel a sa grille, et le bon prix s'applique au bon volume." },

    // ── Services ─────────────────────────────────────────────────────────
    immobilier:  { perte: "Les visites qui ne mènent nulle part mangent les journées.", defaut: "Tout le monde visite, y compris ceux qui ne peuvent pas acheter.", reponse: "SAMII qualifie budget et financement avant de poser une visite au calendrier." },
    autoecole:   { perte: "Une heure de conduite annulée le matin même est une heure perdue.", defaut: "Les annulations arrivent par appel, trop tard pour remplacer.", reponse: "Annulation en ligne et créneau reproposé automatiquement aux élèves en attente." },
    garage:      { perte: "Les clients rappellent dix fois pour savoir si la voiture est prête.", defaut: "L'avancement ne se sait qu'en appelant l'atelier.", reponse: "Le client suit l'état de sa réparation et reçoit le devis à valider." },
    location_voitures: { perte: "Une voiture promise deux fois le même week-end, c'est un client perdu et une réputation avec.", defaut: "Les réservations se notent sur un cahier, et personne ne voit le planning des autres véhicules.", reponse: "Le planning de chaque véhicule est à jour en direct, et une date déjà prise ne peut plus être promise." },
    avocat:      { perte: "Les premiers rendez-vous sans dossier sérieux occupent les créneaux utiles.", defaut: "Toute demande devient un rendez-vous.", reponse: "SAMII recueille la nature du litige et les pièces avant de proposer un créneau." },
    comptable:   { perte: "Courir après les pièces de chaque client coûte plus que la saisie.", defaut: "Les relances se font une par une, à la main.", reponse: "Relance automatique par client, avec la liste de ce qui manque." },
    photographe: { perte: "Les dates se réservent sans acompte et s'annulent sans coût.", defaut: "La date est bloquée sur une simple promesse.", reponse: "Devis, acompte en ligne et date confirmée seulement une fois payée." },
    evenementiel:{ perte: "Un devis envoyé et jamais relancé est un devis perdu.", defaut: "La relance dépend du temps qu'il reste en fin de semaine.", reponse: "SAMII relance chaque devis au bon moment et vous dit lesquels bougent." },
    livreur:     { perte: "Sans preuve de livraison, un litige se règle toujours contre vous.", defaut: "La livraison se confirme oralement.", reponse: "Preuve horodatée à chaque dépôt, et le client est prévenu à l'approche." },

    // ── Formation & tourisme ─────────────────────────────────────────────
    education:   { perte: "Les inscriptions non payées bloquent des places sans rapporter.", defaut: "L'inscription et le paiement sont deux démarches séparées.", reponse: "Inscription et paiement au même endroit, place réservée seulement une fois réglée." },
    hotel:       { perte: "Les commissions des plateformes prennent une part de chaque nuit.", defaut: "Toutes les réservations passent par un intermédiaire.", reponse: "Réservation en direct depuis votre page, sans commission." },
    agence_voyage:{ perte: "Un dossier incomplet fait rater un départ et rembourser.", defaut: "Les pièces des voyageurs se réclament par messages successifs.", reponse: "SAMII réclame chaque pièce manquante et vous prévient quand le dossier est complet." },

    // ── Autre ────────────────────────────────────────────────────────────
    autre:       { perte: "Le temps passé à répéter les mêmes réponses ne se facture jamais.", defaut: "Chaque client pose les mêmes questions, une par une.", reponse: "SAMII apprend votre activité et répond à votre place, avec vos mots." },
};

// ══════════════════════════════════════════════════════════════════════════
// LA SPÉCIALISATION — LE MÉTIER DEVIENT UN CONTEXTE OPÉRATIONNEL
// ══════════════════════════════════════════════════════════════════════════
//
// ── CE QUE LE MÉTIER FAISAIT, MESURÉ AVANT D'ÉCRIRE UNE LIGNE ────────────
//
//   • trois phrases (perte / défaut / réponse) poussées dans le prompt par
//     services/competences.js ;
//   • UN aiguillage à deux valeurs — `parcours`, rdv ou produit — et c'est
//     le seul usage comportemental du métier dans tout le projet ;
//   • une liste de mots, pour le reconnaître dans une phrase libre.
//
// C'est réel, et ça ne fait pas un contexte opérationnel. Un e-commerçant et
// un restaurateur recevaient le même SAMII à deux phrases près, alors que
// « stock » ne désigne pas la même chose chez eux : des références en rayon
// d'un côté, des matières premières périssables de l'autre. C'est CETTE
// différence-là que cette table porte.
//
// ── POURQUOI ICI, ET NULLE PART AILLEURS ─────────────────────────────────
//
// Parce que ce fichier est la source unique des métiers. Un second fichier
// de spécialisation aurait divergé de la liste au premier métier ajouté —
// c'est exactement ce qui est arrivé trois fois dans ce projet (la liste des
// métiers en double, le vocabulaire, les métiers du Hub).
//
// La table ne redéclare donc NI le libellé, NI le parcours, NI les mots :
// tout ça est déjà au-dessus, et `fiche()` assemble. Deux endroits qui
// portent le nom d'un métier, c'est un endroit qu'on oubliera de corriger.
//
// ── SIX SECTEURS, PAS TRENTE-QUATRE, ET C'EST VOULU ──────────────────────
//
// Six secteurs réellement approfondis valent mieux que trente-quatre
// remplis à moitié. Un métier sans spécialisation est un cas NORMAL :
// `fiche()` rend `secteur: null`, tout continue comme avant, et les
// vingt-huit autres s'industrialisent un par un sans big bang.
//
// ── LA DISTINCTION QUI COMPTE LE PLUS : COMPRENDRE ≠ FAIRE ───────────────
//
// Chaque action porte `fait` : le nom de l'outil qui l'exécute VRAIMENT
// (ceux de config/niveaux.js), ou `null`. « Vérifie mon stock » se comprend
// et se discute ; aucun outil ne le fait aujourd'hui, et l'écrire `null` est
// la seule façon honnête de le dire. Le jour où l'outil existera, une seule
// ligne changera ici.
//
// Même règle pour les outils : `outilsDuSecteur` sont ceux que le métier
// CONNAÎT (il peut nous en parler), `integrations` ceux que SAMII branche
// vraiment — les identifiants de routes/connector.js, et rien d'autre.
// Annoncer un branchement qu'on n'a pas est la promesse la plus chère du
// produit.
const SECTEURS = {
    // ── 1. E-COMMERCE ───────────────────────────────────────────────────
    ecommerce: {
        description: "Vente en ligne de produits physiques, expédiés au client, très souvent payés à la livraison.",
        contexte: "Le paiement à la livraison domine : la marge ne se joue pas à la vente mais au taux de colis qui reviennent. Un colis refusé coûte l'aller, le retour, et le produit immobilisé.",
        objets: ["produit", "variante", "référence", "commande", "client", "fournisseur", "colis", "paiement"],
        donnees: ["quantité disponible par variante", "prix d'achat et prix de vente", "marge unitaire", "frais de livraison par wilaya", "taux de colis retournés", "délai du transporteur", "source de la commande"],
        problemes: ["les colis qui reviennent non payés", "les commandes non confirmées expédiées quand même", "les ruptures sur les références qui tournent", "la marge mangée par les frais de retour", "les questions de taille et de disponibilité répétées en message privé"],
        actions: [
            { dire: "confirme cette commande", fait: "confirmer_commande" },
            { dire: "annule cette commande", fait: "annuler_commande" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "prépare un post pour ce produit", fait: "preparer_publication" },
            { dire: "vérifie mon stock sur cette référence", fait: null },
            { dire: "calcule ma marge réelle sur ce produit", fait: null },
            { dire: "relance les paniers abandonnés", fait: null },
        ],
        workflows: [
            "produit → commande reçue → confirmation du client → expédition → suivi du colis → encaissement",
            "colis retourné → motif → recontact du client → remise en stock",
            "rupture annoncée → commande fournisseur → réception → remise en ligne",
        ],
        outilsDuSecteur: ["Shopify", "WooCommerce", "Instagram", "Facebook", "WhatsApp", "Yalidine", "tableur de stock"],
        integrations: ["shopify", "woocommerce", "instagram", "facebook", "whatsapp", "telegram", "yalidine"],
        memoire: ["ce qu'il vend et à quel prix", "son transporteur habituel et ses délais", "les wilayas où il livre", "son taux de retour", "ses fournisseurs"],
        expertise: "Ramène toujours la conversation au colis qui revient : c'est là que part l'argent. Avant de parler publicité ou de nouveaux produits, demande le taux de confirmation et le taux de retour. Chiffre en dinars ou en francs CFA, jamais en pourcentages seuls.",
    },

    // ── 2. RESTAURANT ───────────────────────────────────────────────────
    restaurant: {
        description: "Préparation et vente de plats sur place, à emporter ou en livraison, à partir de matières premières périssables.",
        contexte: "Ici le stock est vivant : il se périme. Le coût d'un plat n'est pas son prix d'achat mais la somme de ses ingrédients, et il bouge chaque semaine avec le marché.",
        objets: ["plat", "carte", "recette", "ingrédient", "matière première", "fournisseur", "commande", "service", "perte"],
        donnees: ["coût matière par plat", "quantité d'ingrédients restante", "date de péremption", "prix d'achat au marché", "pertes de la semaine", "plats les plus vendus", "affluence par service"],
        problemes: ["les commandes prises au téléphone pendant le coup de feu", "les matières premières jetées en fin de semaine", "un plat vendu moins cher que ce qu'il coûte", "les ruptures en plein service", "les prix fournisseurs qui montent sans que la carte bouge"],
        actions: [
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "confirme cette commande", fait: "confirmer_commande" },
            { dire: "prépare un post pour le plat du jour", fait: "preparer_publication" },
            { dire: "combien me coûte ce plat ?", fait: null },
            { dire: "qu'est-ce qu'il me manque pour demain ?", fait: null },
            { dire: "combien j'ai perdu cette semaine ?", fait: null },
        ],
        workflows: [
            "recette → ingrédients → coût matière → prix de vente → marge du plat",
            "commande reçue → préparation → service ou livraison → encaissement",
            "achat au marché → entrée en matière première → consommation par les recettes → perte ou vente",
        ],
        outilsDuSecteur: ["carte papier ou QR", "cahier de marché", "caisse", "Instagram", "WhatsApp", "plateformes de livraison"],
        integrations: ["instagram", "facebook", "whatsapp", "telegram"],
        memoire: ["sa carte et ses plats", "ses fournisseurs et leurs jours de livraison", "ses heures de rush", "ce qu'il jette le plus souvent", "ses prix d'achat habituels"],
        expertise: "Quand il dit « stock », il parle d'ingrédients qui se périment, jamais de références en rayon. Raisonne en coût matière avant de parler de prix de vente, et en jours avant péremption avant de parler de quantité. Ne propose jamais d'augmenter le volume sans avoir regardé les pertes.",
    },

    // ── 3. GROSSISTE ────────────────────────────────────────────────────
    grossiste: {
        description: "Vente de marchandise en volume à des clients professionnels — revendeurs, boutiques, restaurants — à des tarifs qui dépendent de la quantité.",
        contexte: "Le client n'est pas un particulier mais un commerce, qui revend derrière. Le prix n'est pas un prix : c'est une grille par palier de quantité, souvent négociée client par client, et un point de marge se paie sur tout le lot.",
        objets: ["article", "lot", "palier de quantité", "client professionnel", "commande en volume", "fournisseur", "dépôt", "facture", "encours"],
        donnees: ["prix par palier de quantité", "quantité en dépôt", "minimum de commande", "encours et impayés par client", "délai de paiement accordé", "rotation par article", "prix d'achat à l'import"],
        problemes: ["un prix accordé de tête qui mange la marge du lot", "les clients qui paient en retard pendant qu'on avance la marchandise", "le dépôt qui dort sur des références qui ne tournent pas", "les commandes en dessous du minimum acceptées quand même", "les grilles de prix qui vivent dans la tête du patron"],
        actions: [
            { dire: "confirme cette commande", fait: "confirmer_commande" },
            { dire: "envoie la facture à ce client", fait: "envoyer_facture" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quel prix pour ce client à cette quantité ?", fait: null },
            { dire: "qui me doit de l'argent ?", fait: null },
            { dire: "qu'est-ce qui dort dans mon dépôt ?", fait: null },
        ],
        workflows: [
            "client professionnel → grille de prix → commande en volume → facture → livraison → encaissement",
            "palier de quantité franchi → prix unitaire qui baisse → marge à revérifier sur le lot entier",
            "encours qui monte → relance → blocage des nouvelles commandes",
        ],
        outilsDuSecteur: ["catalogue tarifaire", "bons de commande", "logiciel de facturation", "WhatsApp", "tableur d'encours"],
        integrations: ["whatsapp", "telegram", "gmail"],
        memoire: ["ses paliers de quantité", "les conditions accordées à chaque client professionnel", "ses délais de paiement", "ses articles qui tournent", "ses fournisseurs à l'import"],
        expertise: "Ne parle jamais d'un prix sans demander la quantité et le client : les deux ensemble donnent le prix, séparément ils ne veulent rien dire. Traite l'encours comme de l'argent déjà sorti. Un client professionnel se garde par la régularité des conditions, pas par une remise ponctuelle.",
    },

    // ── 4. LOCATION DE VOITURES ─────────────────────────────────────────
    location_voitures: {
        description: "Mise à disposition de véhicules sur une période — un départ, un retour, un état des lieux des deux côtés.",
        contexte: "Ce qui se vend n'est pas un objet mais une PÉRIODE pendant laquelle un véhicule précis est bloqué. Le même véhicule promis deux fois sur les mêmes dates est la faute qui coûte le plus cher, et elle ne se voit qu'au moment du départ.",
        objets: ["véhicule", "disponibilité", "réservation", "contrat", "caution", "état des lieux", "client", "entretien"],
        donnees: ["date de départ et date de retour", "tarif par jour et dégressif", "kilométrage au départ et au retour", "montant de la caution", "franchise d'assurance", "carburant au départ", "prochaine échéance d'entretien", "papiers du véhicule"],
        problemes: ["le même véhicule réservé deux fois sur les mêmes dates", "les retours en retard qui décalent la réservation suivante", "les dégâts constatés après coup, sans état des lieux au départ", "les cautions qu'on rend ou qu'on garde sans preuve", "l'entretien qui tombe pendant une location"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "bloque cette réservation", fait: "prendre_rendez_vous" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quelles voitures sont libres ce week-end ?", fait: null },
            { dire: "combien pour cinq jours sur ce modèle ?", fait: null },
            { dire: "quel véhicule doit passer à l'entretien ?", fait: null },
        ],
        workflows: [
            "demande → véhicule disponible sur la période → devis → réservation → contrat → état des lieux de départ → retour → état des lieux → caution rendue",
            "retour en retard → réservation suivante menacée → véhicule de remplacement ou décalage",
            "kilométrage franchi → entretien dû → véhicule retiré du planning",
        ],
        outilsDuSecteur: ["planning des véhicules", "contrat de location papier", "état des lieux photo", "WhatsApp", "Facebook"],
        integrations: ["whatsapp", "facebook", "instagram", "telegram", "google"],
        memoire: ["sa flotte et les modèles", "ses tarifs par jour et par durée", "ses cautions habituelles", "ses conditions de kilométrage", "ses périodes de forte demande"],
        expertise: "Pense toujours en PÉRIODE, jamais en quantité : la première question est « du quand au quand », la deuxième « quel véhicule ». Ne confirme jamais une date sans avoir vérifié le retour de la réservation précédente. Rappelle l'état des lieux et la caution avant le départ, pas après le retour.",
    },

    // ── 5. AVOCAT ───────────────────────────────────────────────────────
    avocat: {
        description: "Défense et conseil juridique, organisés autour de dossiers qui avancent au rythme d'échéances imposées de l'extérieur.",
        contexte: "Le temps n'appartient pas au cabinet : les dates viennent du tribunal et de la loi. Une échéance manquée n'est pas un retard, c'est un droit perdu — et elle ne se rattrape pas.",
        objets: ["client", "dossier", "affaire", "audience", "échéance", "acte", "pièce", "juridiction", "adversaire"],
        donnees: ["date d'audience", "délai de recours", "nature du litige", "pièces reçues et pièces manquantes", "juridiction saisie", "étape de la procédure", "honoraires convenus"],
        problemes: ["les premiers rendez-vous sans dossier sérieux qui occupent les créneaux utiles", "les pièces que le client n'envoie jamais", "deux audiences le même matin dans deux tribunaux", "les délais de recours qui courent pendant qu'on attend une pièce", "les clients qui appellent pour savoir où en est leur dossier"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "écris-lui pour réclamer les pièces", fait: "envoyer_email" },
            { dire: "mets cette audience à mon agenda", fait: "creer_evenement_agenda" },
            { dire: "quelles échéances tombent cette semaine ?", fait: null },
            { dire: "qu'est-ce qui manque dans ce dossier ?", fait: null },
        ],
        workflows: [
            "client → dossier ouvert → pièces réclamées → acte rédigé → juridiction saisie → audience → décision → suivi",
            "échéance identifiée → pièces manquantes → relance du client → dépôt avant la date",
            "demande entrante → nature du litige qualifiée → rendez-vous ou refus argumenté",
        ],
        outilsDuSecteur: ["logiciel de gestion de cabinet", "agenda des audiences", "dossier papier", "e-mail", "Gmail", "Google Agenda"],
        integrations: ["gmail", "google", "whatsapp"],
        memoire: ["ses domaines de droit", "les juridictions où il plaide", "ses échéances récurrentes", "ses honoraires habituels", "la liste de pièces qu'il demande à chaque type d'affaire"],
        expertise: "La date commande tout : avant de parler du fond, demande l'échéance et la juridiction. Distingue toujours ce qui manque au dossier de ce qui est en attente chez un tiers. Ne donne jamais d'avis juridique à la place de l'avocat — organise son dossier, ne le plaide pas.",
    },

    // ── 6. COMPTABLE ────────────────────────────────────────────────────
    comptable: {
        description: "Tenue de comptabilité et déclarations pour des clients professionnels, au rythme d'échéances fiscales fixes.",
        contexte: "Le calendrier est le même pour tous les clients en même temps : les échéances déclaratives tombent groupées, et c'est la course aux pièces qui coûte, pas la saisie.",
        objets: ["client", "dossier", "pièce comptable", "facture", "écriture", "échéance", "déclaration", "rapprochement", "bilan"],
        donnees: ["date limite de déclaration", "pièces reçues et pièces manquantes par client", "régime fiscal du client", "période comptable", "écarts de rapprochement bancaire", "chiffre d'affaires déclaré", "acomptes versés"],
        problemes: ["courir après les pièces de chaque client, une par une", "les échéances qui tombent toutes la même semaine", "les relevés bancaires qui ne tombent pas juste", "les clients qui envoient des photos illisibles à la dernière minute", "les régimes fiscaux différents d'un client à l'autre"],
        actions: [
            { dire: "écris-lui pour réclamer les pièces", fait: "envoyer_email" },
            { dire: "prépare-moi un tableau de suivi", fait: "creer_rapport_sheets" },
            { dire: "envoie la facture à ce client", fait: "envoyer_facture" },
            { dire: "mets cette échéance à mon agenda", fait: "creer_evenement_agenda" },
            { dire: "quels clients n'ont pas encore envoyé leurs pièces ?", fait: null },
            { dire: "quelles déclarations tombent ce mois-ci ?", fait: null },
        ],
        workflows: [
            "pièce reçue → dossier client → écriture → rapprochement → déclaration → dépôt → archivage",
            "échéance approchante → liste des pièces manquantes → relance par client → dépôt avant la date",
            "écart de rapprochement → pièce manquante ou double → correction → clôture de la période",
        ],
        outilsDuSecteur: ["logiciel comptable", "portail de déclaration", "relevés bancaires", "tableur de suivi", "Gmail", "Google Drive"],
        integrations: ["gmail", "google", "whatsapp"],
        memoire: ["ses clients et leur régime fiscal", "ses échéances récurrentes", "la liste de pièces attendue par type de client", "ses logiciels", "ses périodes de rush"],
        expertise: "Raisonne par ÉCHÉANCE et par CLIENT, dans cet ordre : une date qui approche, puis la liste de ce qui manque chez chacun. Ne parle jamais de saisie sans avoir d'abord réglé la collecte des pièces, qui est le vrai coût. Ne donne aucun conseil fiscal à la place du comptable.",
    },
};

// Le contenu d'un métier, prêt pour sa page. `null` quand le métier n'existe
// pas — l'appelant doit répondre 404 plutôt que de servir une page à moitié
// vide, qui serait indexée par Google telle quelle.
function fiche(id) {
    const m = METIERS.find(x => x.id === id);
    if (!m) return null;
    const d = DOULEURS[id];
    if (!d) return null;   // un métier sans contenu propre n'a pas de page
    // `mots` voyage AVEC la fiche : la couche de compétence n'a alors qu'une
    // seule chose à demander pour tout savoir d'un métier. Un métier sans
    // vocabulaire rend un tableau vide, jamais `undefined` — un appelant qui
    // reçoit `undefined` finit toujours par écrire sa propre valeur de repli,
    // et elle diverge.
    // `secteur` voyage AVEC la fiche, comme `mots` : un appelant qui a la
    // fiche a TOUT le métier, et n'a jamais à connaître une deuxième table.
    // `null` explicite plutôt qu'absent — un appelant qui reçoit `undefined`
    // finit toujours par écrire sa propre valeur de repli, et elle diverge.
    return { ...m, ...d, mots: VOCABULAIRE[id] || [], secteur: SECTEURS[id] || null };
}

// Les métiers qui ont une page publique. Sert au plan du site et au hub : un
// métier listé quelque part doit répondre partout ailleurs, sinon on envoie
// Google — et les visiteurs — sur des pages absentes.
function avecFiche() {
    return METIERS.filter(m => DOULEURS[m.id]);
}

module.exports = { METIERS, IDS, IDS_RDV, DOULEURS, VOCABULAIRE, SECTEURS, estValide, estRdv, label, icone, parGroupe, fiche, avecFiche };
