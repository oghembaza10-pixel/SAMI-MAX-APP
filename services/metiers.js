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

    // ══════════════════════════════════════════════════════════════════════
    // 9c-bis — LES TRENTE AUTRES : LA MÊME FONDATION, MOINS PROFONDE
    // ══════════════════════════════════════════════════════════════════════
    //
    // Même structure, même contrat, même chemin jusqu'au cerveau. Ce qui
    // change est la PROFONDEUR : les six au-dessus portent cinq problèmes et
    // trois chaînes de travail chacun, ceux d'ici en portent deux ou trois.
    //
    // Ce n'est pas de la paresse, c'est la limite de ce qu'on sait vraiment.
    // Trente listes de cinq problèmes auraient donné trois listes vraies et
    // vingt-sept remplissages — et un remplissage coûte des jetons à chaque
    // message pour apprendre quelque chose de faux à SAMII.
    //
    // Les QUATRE dimensions qui atteignent réellement la consigne — objets,
    // donnees, actions, expertise — sont au même niveau d'exigence partout :
    // c'est là que se joue la différence entre un contexte et une case
    // cochée.
    //
    // ⚠️ `fait` et `integrations` obéissent à la règle de 9c sans exception :
    // un outil de config/niveaux.js, un connecteur de routes/connector.js, ou
    // rien. Un métier où SAMII ne sait rien exécuter le dit en `null`.

    // ── SANTÉ ───────────────────────────────────────────────────────────
    dentiste: {
        description: "Cabinet dentaire : soins programmés, souvent en plusieurs séances, sur un fauteuil qui ne se dédouble pas.",
        contexte: "Le fauteuil est la ressource rare : une heure vide ne se rattrape pas, et un plan de traitement interrompu au milieu ne rapporte ni ne soigne.",
        objets: ["patient", "fauteuil", "soin", "plan de traitement", "devis", "radio", "prothèse", "rendez-vous"],
        donnees: ["durée du soin", "séances restantes du plan", "montant du devis accepté", "délai du laboratoire de prothèse", "taux de rendez-vous non honorés"],
        problemes: ["les créneaux perdus par les patients qui ne viennent pas", "les plans de traitement abandonnés en cours de route", "les devis envoyés et jamais relancés"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "mets ça à mon agenda", fait: "creer_evenement_agenda" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quels plans de traitement sont en attente ?", fait: null },
        ],
        workflows: [
            "consultation → devis → acceptation → séances programmées → fin du plan",
            "annulation → créneau libéré → proposé à la liste d'attente",
        ],
        outilsDuSecteur: ["logiciel de cabinet dentaire", "agenda du fauteuil", "radiologie numérique"],
        integrations: ["whatsapp", "google", "gmail", "facebook", "instagram"],
        memoire: ["la durée qu'il donne à chaque type de soin", "son laboratoire de prothèse", "ses horaires de fauteuil"],
        expertise: "Compte en FAUTEUIL et en séances, jamais en patients : deux patients sur le même créneau, c'est un créneau. Avant de parler de remplir l'agenda, regarde les plans de traitement commencés et pas finis — c'est là que l'argent est déjà à moitié gagné.",
    },
    medecin: {
        description: "Cabinet médical : consultations courtes, à la chaîne, avec une part d'urgence qu'on ne programme pas.",
        contexte: "Le motif de consultation décide de tout : de la durée, de l'urgence, et de ce qu'il faut préparer. Une journée se joue sur la capacité à absorber ce qui n'était pas prévu.",
        objets: ["patient", "consultation", "motif", "ordonnance", "carnet de vaccination", "rendez-vous", "urgence"],
        donnees: ["motif de la consultation", "durée habituelle par motif", "créneaux gardés pour l'urgence", "rappels de vaccin à venir", "patients qui ne viennent pas"],
        problemes: ["les patients qui ne viennent pas et bloquent un créneau", "les urgences qui décalent toute la journée", "le carnet papier qui ne sait pas prévenir la veille"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "mets ça à mon agenda", fait: "creer_evenement_agenda" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "qui doit être rappelé pour un vaccin ?", fait: null },
        ],
        workflows: [
            "demande → motif qualifié → durée adaptée → rendez-vous → rappel la veille",
            "annulation → créneau rendu disponible → reproposé",
        ],
        outilsDuSecteur: ["logiciel de cabinet médical", "agenda de consultations", "dossier patient"],
        integrations: ["whatsapp", "google", "gmail"],
        memoire: ["ses durées de consultation par motif", "ses jours et horaires", "sa part de créneaux d'urgence"],
        expertise: "Demande toujours le MOTIF avant la date : c'est lui qui donne la durée et l'urgence, et une consultation mal calibrée décale toutes les suivantes. Ne conseille jamais sur le plan médical — organise le cabinet, pas le soin.",
    },
    kine: {
        description: "Kinésithérapie : des séries de séances prescrites, qui n'ont de valeur que menées jusqu'au bout.",
        contexte: "Ce qui se vend n'est pas une séance mais une SÉRIE. Une séance manquée au milieu casse le protocole et la facturation, et le patient décroche souvent sans prévenir.",
        objets: ["patient", "séance", "série de séances", "protocole", "prescription", "bilan", "rendez-vous"],
        donnees: ["nombre de séances prescrites", "séances déjà faites", "séances restantes", "régularité du patient", "date du bilan"],
        problemes: ["les séries abandonnées au milieu", "les séances manquées qui cassent le protocole", "les prescriptions qui expirent avant la fin de la série"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "mets ça à mon agenda", fait: "creer_evenement_agenda" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quels patients ont décroché en cours de série ?", fait: null },
        ],
        workflows: [
            "prescription → série programmée → séances suivies → bilan → renouvellement ou fin",
            "séance manquée → replacée dans la série → série qui tient",
        ],
        outilsDuSecteur: ["logiciel de cabinet", "planning de séances", "suivi de protocole"],
        integrations: ["whatsapp", "google", "gmail"],
        memoire: ["ses protocoles habituels", "la longueur moyenne de ses séries", "ses horaires"],
        expertise: "Raisonne en SÉRIE, jamais en séance isolée : la question utile est « où en est-on sur les dix » et « qui a décroché ». Repère les séries qui s'arrêtent avant la fin — c'est la perte principale du métier, et elle est silencieuse.",
    },
    laboratoire: {
        description: "Laboratoire d'analyses : des prélèvements qui entrent, des résultats qui sortent, avec un délai que tout le monde surveille.",
        contexte: "Le métier tient au DÉLAI DE RENDU. Entre le prélèvement et le résultat, le patient appelle — et chaque appel interrompt le travail de paillasse.",
        objets: ["patient", "prélèvement", "analyse", "résultat", "délai de rendu", "coursier", "prescription"],
        donnees: ["heure du prélèvement", "délai annoncé par type d'analyse", "résultats prêts non retirés", "volume de la matinée", "tournées du coursier"],
        problemes: ["les appels pour savoir si les résultats sont prêts", "les pics de prélèvement du matin", "les résultats prêts que personne ne vient chercher"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quels résultats sont prêts et pas retirés ?", fait: null },
        ],
        workflows: [
            "prélèvement → analyse → résultat disponible → patient prévenu → retrait",
            "pic du matin → créneaux étalés → paillasse lissée",
        ],
        outilsDuSecteur: ["logiciel de laboratoire", "planning de prélèvements", "remise de résultats en ligne"],
        integrations: ["whatsapp", "gmail", "google"],
        memoire: ["ses délais par type d'analyse", "ses heures de pointe", "ses tournées de coursier"],
        expertise: "Le délai de rendu est la seule promesse du métier : parles-en avant tout le reste. Prévenir dès que c'est prêt supprime la quasi-totalité des appels — c'est le geste qui change la journée, pas une organisation plus fine des prélèvements.",
    },
    opticien: {
        description: "Optique : une vente qui dépend d'une correction, et une commande de verres qui met des jours à revenir.",
        contexte: "Entre l'essayage et la livraison, il y a un atelier extérieur et un délai. Le client repart sans rien, et revient — ou pas, si personne ne l'a prévenu.",
        objets: ["client", "monture", "verre", "correction", "ordonnance", "commande de verres", "essayage"],
        donnees: ["correction prescrite", "délai de l'atelier", "commandes de verres en cours", "montures en stock", "date de la dernière ordonnance"],
        problemes: ["les commandes de verres oubliées, et le client qui revient pour rien", "le suivi qui vit sur des bons papier", "les ordonnances périmées découvertes à la caisse"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "prépare un post pour cette monture", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quelles commandes de verres sont arrivées ?", fait: null },
        ],
        workflows: [
            "ordonnance → essayage → commande de verres → réception → client prévenu → retrait",
            "verre en retard → client informé avant qu'il se déplace",
        ],
        outilsDuSecteur: ["logiciel d'optique", "catalogue de montures", "suivi des commandes d'atelier"],
        integrations: ["whatsapp", "instagram", "facebook", "gmail"],
        memoire: ["ses fournisseurs de verres et leurs délais", "ses marques de montures", "ses habitudes de renouvellement"],
        expertise: "Chaque commande de verres doit avoir un état visible : c'est le seul point où le client se déplace pour rien, et un déplacement pour rien coûte un client. Parle délai d'atelier avant de parler choix de monture.",
    },
    pharmacie: {
        description: "Officine : de la vente au comptoir, une part d'ordonnance, et des traitements qu'on ne peut pas être en rupture de fournir.",
        contexte: "Une rupture sur un traitement chronique n'est pas une vente perdue, c'est un patient perdu : il ira en face, et il y restera.",
        objets: ["patient", "ordonnance", "médicament", "référence", "rupture", "garde", "commande fournisseur"],
        donnees: ["références qui tournent le plus", "seuil d'alerte avant rupture", "traitements chroniques suivis", "jours de garde", "délai du grossiste répartiteur"],
        problemes: ["les ruptures sur les traitements chroniques", "le stock qui ne se vérifie qu'au moment où on le demande", "les patients qui ne savent pas quand vous êtes de garde"],
        actions: [
            { dire: "confirme cette commande", fait: "confirmer_commande" },
            { dire: "prépare un post pour annoncer la garde", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "qu'est-ce qui va bientôt manquer ?", fait: null },
        ],
        workflows: [
            "ordonnance → délivrance → suivi du traitement → renouvellement prévu",
            "seuil atteint → commande au répartiteur → réception → rayon reconstitué",
        ],
        outilsDuSecteur: ["logiciel d'officine", "commande au répartiteur", "planning de garde"],
        integrations: ["whatsapp", "facebook", "instagram", "gmail"],
        memoire: ["ses références qui tournent", "son répartiteur et ses délais", "ses jours de garde", "ses patients chroniques réguliers"],
        expertise: "Pense TRAITEMENT CHRONIQUE avant volume : ce sont ces patients-là qui font le chiffre régulier, et une seule rupture les envoie ailleurs pour de bon. Annoncer les gardes vaut n'importe quelle publicité dans ce métier.",
    },
    veterinaire: {
        description: "Clinique vétérinaire : des soins pour des animaux, décidés et payés par leurs propriétaires.",
        contexte: "Le suivi repose sur des RAPPELS que le propriétaire oublie — vaccins, vermifuges, contrôles. Un rappel manqué, c'est un animal qu'on ne revoit plus.",
        objets: ["animal", "espèce", "propriétaire", "vaccin", "rappel", "consultation", "carnet de santé"],
        donnees: ["espèce et âge de l'animal", "date du dernier vaccin", "prochain rappel dû", "historique des soins", "coordonnées du propriétaire"],
        problemes: ["les rappels de vaccin oubliés par le propriétaire", "les animaux qu'on ne revoit plus après une visite", "l'historique qui vit dans un carnet papier chez le client"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "écris-lui pour le rappel de vaccin", fait: "envoyer_email" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quels rappels tombent ce mois-ci ?", fait: null },
        ],
        workflows: [
            "consultation → soins → prochain rappel fixé → propriétaire prévenu au bon mois",
            "rappel envoyé → rendez-vous pris → suivi qui continue",
        ],
        outilsDuSecteur: ["logiciel vétérinaire", "carnet de santé animal", "agenda de rappels"],
        integrations: ["whatsapp", "gmail", "google", "facebook"],
        memoire: ["les espèces qu'il soigne", "ses protocoles de rappel", "ses horaires et ses urgences"],
        expertise: "Le métier se joue sur le RAPPEL, pas sur la consultation : c'est lui qui ramène l'animal et qui fait le suivi. Parle toujours de l'animal par son nom et son espèce — un propriétaire n'entend pas « votre dossier », il entend « Rex ».",
    },

    // ── BEAUTÉ & BIEN-ÊTRE ──────────────────────────────────────────────
    coiffeur: {
        description: "Salon de coiffure : des prestations de durées très différentes, sur un nombre de fauteuils fixe.",
        contexte: "Le stock, c'est l'agenda : une heure vide ne se revend pas le lendemain. Et une couleur mal calibrée en durée fait déborder tout l'après-midi.",
        objets: ["cliente", "prestation", "coloration", "fauteuil", "créneau", "liste d'attente", "produit"],
        donnees: ["durée réelle par prestation", "heures creuses de la semaine", "clientes qui ne reviennent plus", "fréquence de passage habituelle", "produits consommés par coloration"],
        problemes: ["les rendez-vous qui arrivent en message privé et se notent de tête", "les heures creuses en semaine pendant que le samedi refuse du monde", "les clientes qui espacent sans qu'on s'en aperçoive"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "prépare un post pour le salon", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quelles clientes ne sont pas revenues ?", fait: null },
        ],
        workflows: [
            "demande en message → créneau proposé selon la durée de la prestation → rappel la veille",
            "annulation → liste d'attente prévenue → trou rempli",
        ],
        outilsDuSecteur: ["agenda du salon", "Instagram", "cahier de rendez-vous", "caisse"],
        integrations: ["instagram", "whatsapp", "facebook", "telegram"],
        memoire: ["ses prestations et leurs durées réelles", "ses heures creuses", "la fréquence de passage de ses habituées"],
        expertise: "La DURÉE de la prestation commande le créneau : une couleur et une coupe ne se placent pas pareil, et c'est là que les journées débordent. Traite les heures creuses comme un stock qui périme — elles ne se revendent jamais.",
    },
    barbier: {
        description: "Salon de barbier : des passages courts, souvent sans rendez-vous, et une file qui se voit seulement de l'intérieur.",
        contexte: "Contrairement au salon de coiffure, l'essentiel se joue SANS rendez-vous : le client passe, regarde la file, et repart si elle est trop longue.",
        objets: ["client", "passage", "file d'attente", "coupe", "entretien de barbe", "tour"],
        donnees: ["temps d'attente actuel", "durée moyenne d'un passage", "heures de forte affluence", "nombre de postes actifs", "clients partis sans être servis"],
        problemes: ["les clients qui repartent quand ça déborde", "la file qu'on ne peut pas annoncer de l'extérieur", "les heures creuses qui alternent avec des bouchons"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "prépare un post pour le salon", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "combien de temps d'attente en ce moment ?", fait: null },
        ],
        workflows: [
            "client arrivé → placé dans la file → prévenu de son tour → servi",
            "affluence annoncée en ligne → le client vient au bon moment",
        ],
        outilsDuSecteur: ["file d'attente en ligne", "Instagram", "caisse"],
        integrations: ["instagram", "whatsapp", "facebook", "tiktok"],
        memoire: ["ses heures d'affluence", "la durée moyenne de ses passages", "son nombre de postes"],
        expertise: "Raisonne en FILE et en temps d'attente, pas en agenda : ici le client ne réserve pas, il évalue. Rendre l'attente visible de l'extérieur vaut plus que n'importe quelle promotion — c'est ce qui empêche un client de repartir sans entrer.",
    },
    esthetique: {
        description: "Institut de beauté : des soins vendus à l'unité mais qui ne donnent de résultat qu'en cure.",
        contexte: "La valeur est dans la CURE : une cliente qui s'arrête à la troisième séance sur six n'a ni son résultat ni fini de payer, et elle ne revient pas.",
        objets: ["cliente", "soin", "cure", "séance", "cabine", "forfait", "produit de soin"],
        donnees: ["nombre de séances de la cure", "séances déjà faites", "durée par soin", "cabines disponibles", "cures interrompues"],
        problemes: ["les cures abandonnées au milieu", "la cliente à qui personne ne propose la séance suivante avant qu'elle parte", "les cabines vides en semaine"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "prépare un post pour ce soin", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quelles cures sont restées en plan ?", fait: null },
        ],
        workflows: [
            "premier soin → cure proposée → séances programmées d'avance → cure terminée",
            "séance faite → suivante prise avant de partir → cure qui tient",
        ],
        outilsDuSecteur: ["agenda de l'institut", "Instagram", "fiches de soin", "caisse"],
        integrations: ["instagram", "whatsapp", "facebook", "tiktok"],
        memoire: ["ses soins et la longueur de ses cures", "ses cabines", "ses produits habituels"],
        expertise: "Compte en CURES, pas en séances : la question utile est « combien de cures commencées, combien finies ». La séance suivante se prend pendant que la cliente est encore là — après, il faut la rappeler, et on la rappelle rarement.",
    },
    spa: {
        description: "Spa ou hammam : des créneaux de soin en cabine, avec une demande très concentrée sur le week-end.",
        contexte: "La semaine est vide, le samedi refuse du monde. Le métier consiste à déplacer une partie de la demande vers les heures creuses, parce qu'une cabine vide ne se rattrape pas.",
        objets: ["client", "cabine", "créneau", "soin", "abonnement", "heure creuse", "forfait duo"],
        donnees: ["taux de remplissage par jour", "cabines disponibles par créneau", "durée du soin", "clients habitués", "écart semaine / week-end"],
        problemes: ["les créneaux de semaine qui restent vides", "le week-end saturé qui refuse des clients", "les abonnements qui ne se consomment pas"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "prépare une offre pour les heures creuses", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quel est mon taux de remplissage cette semaine ?", fait: null },
        ],
        workflows: [
            "demande → cabine libre sur le créneau → réservation → rappel la veille",
            "heures creuses identifiées → offre envoyée aux habitués → cabines remplies",
        ],
        outilsDuSecteur: ["planning des cabines", "Instagram", "caisse", "cartes d'abonnement"],
        integrations: ["instagram", "whatsapp", "facebook"],
        memoire: ["ses cabines et ses soins", "ses heures creuses réelles", "ses habitués et leur rythme"],
        expertise: "Regarde d'abord l'écart entre la semaine et le week-end : c'est le seul chiffre qui dit où est l'argent perdu. Remplir une cabine creuse à prix réduit rapporte plus qu'une cabine vide à plein tarif — mais jamais l'inverse le samedi.",
    },
    salle_sport: {
        description: "Salle de sport : un revenu d'abonnements, qui tient à la fréquentation et pas à l'inscription.",
        contexte: "Ce qui compte n'est pas de vendre l'abonnement mais de le faire renouveler. Un abonné qui cesse de venir ne se réabonne pas, et son absence ne se remarque qu'au non-renouvellement.",
        objets: ["abonné", "abonnement", "fréquentation", "cours collectif", "coach", "échéance de renouvellement"],
        donnees: ["date de fin d'abonnement", "dernière venue de l'abonné", "fréquence de passage", "remplissage des cours collectifs", "taux de renouvellement"],
        problemes: ["les abonnés qui décrochent sans qu'on s'en aperçoive", "les renouvellements perdus faute de relance", "les cours collectifs à moitié vides"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "prépare un post pour la salle", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "qui n'est pas venu depuis trois semaines ?", fait: null },
        ],
        workflows: [
            "inscription → venues régulières → relance avant l'échéance → renouvellement",
            "absence repérée → relance → retour ou abonnement perdu",
        ],
        outilsDuSecteur: ["logiciel d'abonnements", "badgeuse ou registre d'entrée", "Instagram", "planning des cours"],
        integrations: ["instagram", "whatsapp", "facebook", "tiktok", "youtube"],
        memoire: ["ses formules d'abonnement", "ses cours et leurs horaires", "sa fréquentation type"],
        expertise: "Surveille la FRÉQUENTATION, pas les ventes : le chiffre qui prédit le mois prochain est « qui n'est plus venu depuis trois semaines ». Relancer avant l'échéance, pas après — après, la décision est déjà prise.",
    },

    // ── RESTAURATION ────────────────────────────────────────────────────
    fastfood: {
        description: "Restauration rapide : un volume de commandes concentré sur deux pics par jour, où la vitesse fait le chiffre.",
        contexte: "Le goulot n'est pas la cuisine, c'est la PRISE DE COMMANDE. Une file qui s'allonge fait partir des clients qui étaient déjà devant la porte.",
        objets: ["commande", "menu", "file", "temps de préparation", "heure de pointe", "livreur"],
        donnees: ["temps d'attente au comptoir", "durée de préparation par menu", "heures de pointe réelles", "commandes en simultané", "commandes à emporter contre sur place"],
        problemes: ["la file qui fait partir un client sur trois", "la prise de commande qui bloque tout au pic", "les erreurs de commande au coup de feu"],
        actions: [
            { dire: "confirme cette commande", fait: "confirmer_commande" },
            { dire: "annule cette commande", fait: "annuler_commande" },
            { dire: "prépare un post pour le menu du jour", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quel est mon temps d'attente au pic ?", fait: null },
        ],
        workflows: [
            "commande passée à l'avance → préparée pour l'heure choisie → retrait sans attente",
            "pic identifié → préparation anticipée → file qui ne s'allonge pas",
        ],
        outilsDuSecteur: ["caisse", "écran de cuisine", "Instagram", "plateformes de livraison"],
        integrations: ["instagram", "whatsapp", "facebook", "telegram", "tiktok"],
        memoire: ["son menu et ses temps de préparation", "ses heures de pointe", "ses plats qui partent le plus"],
        expertise: "Tout se mesure en MINUTES D'ATTENTE : c'est la seule variable qui fait entrer ou repartir un client. Avant de parler de nouveaux plats, regarde combien de commandes passent au pic et où ça bouchonne.",
    },
    patisserie: {
        description: "Pâtisserie : une vitrine qui tourne au quotidien, et des commandes sur mesure pour une date précise.",
        contexte: "Deux métiers en un. La vitrine se vend au jour le jour ; la commande sur mesure engage une DATE — et un gâteau d'anniversaire oublié est une fête gâchée qu'on ne rattrape pas.",
        objets: ["commande sur mesure", "vitrine", "date de retrait", "parfum", "acompte", "gâteau", "ingrédient"],
        donnees: ["date et heure du retrait", "parfum et taille demandés", "acompte versé", "commandes du week-end", "invendus de la vitrine"],
        problemes: ["les commandes spéciales notées sur des bouts de papier", "les retraits oubliés ou décalés", "les invendus de vitrine en fin de journée"],
        actions: [
            { dire: "confirme cette commande", fait: "confirmer_commande" },
            { dire: "annule cette commande", fait: "annuler_commande" },
            { dire: "prépare un post pour la vitrine", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quelles commandes sont à retirer demain ?", fait: null },
        ],
        workflows: [
            "commande sur mesure → parfum, taille, date → acompte → rappel la veille → retrait",
            "production du jour → vitrine → invendus mesurés → quantités ajustées",
        ],
        outilsDuSecteur: ["cahier de commandes", "Instagram", "caisse", "planning de production"],
        integrations: ["instagram", "whatsapp", "facebook", "tiktok"],
        memoire: ["ses parfums et ses tailles", "ses délais de commande", "ses pics de saison et de week-end"],
        expertise: "Une commande sur mesure n'existe que si la DATE, le parfum et l'acompte sont notés ensemble : il en manque un, et la commande se perd. Sépare toujours ce qui relève de la vitrine du sur-mesure — ce ne sont pas les mêmes marges ni les mêmes risques.",
    },
    cafe: {
        description: "Café ou salon de thé : de petits tickets, répétés, portés par des habitués.",
        contexte: "Le chiffre se fait sur la RÉPÉTITION, pas sur le ticket. Un habitué qui passe trois fois par semaine vaut vingt clients de passage, et il ne revient que s'il y pense.",
        objets: ["habitué", "consommation", "terrasse", "fidélité", "rotation des tables", "carte"],
        donnees: ["fréquence de passage des habitués", "heures creuses de la journée", "rotation des tables", "ticket moyen", "consommations les plus vendues"],
        problemes: ["les habitués qui ne reviennent que s'ils y pensent", "aucune raison de revenir jamais envoyée", "les heures creuses entre les services"],
        actions: [
            { dire: "confirme cette commande", fait: "confirmer_commande" },
            { dire: "prépare un post pour le salon", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "qui sont mes habitués ?", fait: null },
        ],
        workflows: [
            "passage → consommation → fidélité enregistrée → raison de revenir envoyée",
            "heure creuse identifiée → offre envoyée aux habitués → salle qui se remplit",
        ],
        outilsDuSecteur: ["caisse", "carte de fidélité", "Instagram", "affichage de la carte"],
        integrations: ["instagram", "whatsapp", "facebook", "tiktok"],
        memoire: ["sa carte", "ses heures creuses", "ses habitués et leur rythme"],
        expertise: "Parle FRÉQUENCE avant ticket moyen : dans ce métier on ne fait pas payer plus cher, on fait revenir plus souvent. Une carte de fidélité qui ne s'imprime pas et ne se perd pas vaut mieux qu'une promotion.",
    },
    traiteur: {
        description: "Traiteur : des événements engagés longtemps à l'avance, chacun bloquant une journée entière de production.",
        contexte: "On ne vend pas un plat mais une DATE. Deux événements le même jour et il faut refuser, ou mal servir les deux — et la décision se prend souvent à l'aveugle, des mois avant.",
        objets: ["événement", "devis", "date", "nombre de couverts", "acompte", "prestation", "menu"],
        donnees: ["date de l'événement", "nombre de couverts", "montant du devis", "acompte versé", "capacité de production par jour"],
        problemes: ["les devis et les dates qui vivent dans la messagerie", "deux événements acceptés le même jour", "les devis envoyés et jamais relancés"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "envoie la facture à ce client", fait: "envoyer_facture" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quelles dates sont encore libres ?", fait: null },
        ],
        workflows: [
            "demande → date et couverts → devis → acompte → date bloquée → prestation",
            "devis sans réponse → relance au bon moment → accepté ou date libérée",
        ],
        outilsDuSecteur: ["calendrier des événements", "modèles de devis", "WhatsApp", "fiches techniques de menu"],
        integrations: ["whatsapp", "instagram", "facebook", "gmail"],
        memoire: ["sa capacité par jour", "ses menus et leurs prix par couvert", "ses périodes de forte demande"],
        expertise: "La DATE et le nombre de COUVERTS avant tout le reste : ensemble ils disent si c'est faisable, séparément ils ne disent rien. Un devis sans acompte ne bloque rien — ne laisse jamais croire qu'une date est prise tant qu'elle n'est pas payée.",
    },

    // ── COMMERCE ────────────────────────────────────────────────────────
    boutique: {
        description: "Boutique physique : un stock qui ne se vend qu'aux gens qui passent devant.",
        contexte: "Tout ce qui est en rayon est invisible depuis l'extérieur. Le métier consiste à faire exister ce stock en ligne sans cesser de vendre en magasin.",
        objets: ["article", "rayon", "vitrine", "passage", "retrait en boutique", "client"],
        donnees: ["articles en rayon", "articles qui ne tournent pas", "heures de passage", "panier moyen en magasin", "demandes reçues en message"],
        problemes: ["le stock qui n'existe nulle part en dehors du magasin", "les articles qui dorment en rayon", "les questions de disponibilité posées en message privé"],
        actions: [
            { dire: "confirme cette commande", fait: "confirmer_commande" },
            { dire: "annule cette commande", fait: "annuler_commande" },
            { dire: "prépare un post pour cet article", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "qu'est-ce qui dort en rayon ?", fait: null },
        ],
        workflows: [
            "article en rayon → visible en ligne → réservé → retrait en boutique",
            "demande en message → disponibilité confirmée → client qui se déplace pour rien évité",
        ],
        outilsDuSecteur: ["caisse", "Instagram", "Facebook", "inventaire papier ou tableur"],
        integrations: ["instagram", "facebook", "whatsapp", "shopify", "woocommerce"],
        memoire: ["ce qu'elle vend", "ses heures de passage", "ses articles qui tournent"],
        expertise: "Le retrait en boutique est le bon premier pas, pas la livraison : il fait exister le stock en ligne sans ajouter de logistique. Traite les questions de disponibilité comme des ventes en attente — ce sont les plus faciles à gagner.",
    },
    pretaporter: {
        description: "Prêt-à-porter : de la vente de vêtements, où la TAILLE décide de presque tout.",
        contexte: "Les retours pour taille sont l'essentiel des colis qui reviennent. Une cliente qui hésite sur sa taille commande, renvoie, et ne recommande plus.",
        objets: ["article", "taille", "coupe", "collection", "saison", "retour pour taille", "cliente"],
        donnees: ["tailles disponibles par article", "guide des tailles de la marque", "taux de retour par taille", "articles de fin de saison", "coupes les plus demandées"],
        problemes: ["les retours pour taille qui mangent la marge", "la cliente qui commande sans savoir si ça lui ira", "les fins de saison qui restent sur les bras"],
        actions: [
            { dire: "confirme cette commande", fait: "confirmer_commande" },
            { dire: "annule cette commande", fait: "annuler_commande" },
            { dire: "prépare un post pour cet article", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quelles tailles me manquent ?", fait: null },
        ],
        workflows: [
            "article → guide des tailles attaché → question de taille répondue avant la commande → moins de retours",
            "fin de saison → articles identifiés → écoulés avant la collection suivante",
        ],
        outilsDuSecteur: ["Instagram", "guide des tailles", "catalogue photo", "caisse"],
        integrations: ["instagram", "facebook", "whatsapp", "tiktok", "shopify", "woocommerce", "yalidine"],
        memoire: ["ses marques et leurs coupes", "son guide des tailles", "ses saisons et ses collections"],
        expertise: "Réponds à la question de TAILLE avant que la commande parte : c'est le seul moment où un retour se prévient. Une fin de saison se traite en semaines, pas en mois — après, l'article ne vaut plus son prix d'achat.",
    },
    electronique: {
        description: "Électronique et téléphonie : des produits techniques, avec garantie et service après-vente.",
        contexte: "Avant d'acheter, le client pose des questions techniques — compatibilité, mémoire, garantie — et les mêmes reviennent en boucle en message privé. Après l'achat, il y a le SAV.",
        objets: ["modèle", "fiche technique", "garantie", "compatibilité", "SAV", "accessoire", "client"],
        donnees: ["caractéristiques du modèle", "durée et conditions de garantie", "compatibilité avec l'existant", "stock par modèle", "délai de réparation en SAV"],
        problemes: ["les mêmes questions techniques reposées par chaque client", "les litiges de garantie après la vente", "les modèles qui se démodent en stock"],
        actions: [
            { dire: "confirme cette commande", fait: "confirmer_commande" },
            { dire: "annule cette commande", fait: "annuler_commande" },
            { dire: "prépare un post pour ce modèle", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "ce modèle est-il compatible avec…", fait: null },
        ],
        workflows: [
            "question technique → fiche produit → réponse → commande",
            "vente → garantie enregistrée → SAV éventuel → réparation ou échange",
        ],
        outilsDuSecteur: ["fiches produit constructeur", "suivi de garantie", "Instagram", "caisse"],
        integrations: ["instagram", "facebook", "whatsapp", "telegram", "shopify", "woocommerce", "yalidine"],
        memoire: ["ses marques et ses modèles", "ses conditions de garantie", "ses délais de SAV"],
        expertise: "Les fiches techniques répondent à quatre-vingts pour cent des messages avant achat : c'est le gain le plus direct du métier. Ne promets jamais une compatibilité sans la caractéristique exacte — une erreur ici devient un retour et un litige.",
    },
    ameublement: {
        description: "Ameublement et décoration : des produits volumineux, dont la livraison fait partie du prix et du risque.",
        contexte: "Ce n'est pas un colis, c'est un camion, deux personnes et un étage. Une livraison ratée se repaie en entier — et elle rate presque toujours pour une raison qu'on aurait pu demander avant.",
        objets: ["meuble", "volume", "livraison", "étage", "délai", "sur-mesure", "client"],
        donnees: ["dimensions et volume", "adresse et étage", "ascenseur ou non", "créneau de livraison convenu", "délai de fabrication du sur-mesure"],
        problemes: ["les livraisons volumineuses ratées qui se repaient en entier", "les créneaux convenus au téléphone et oubliés", "les délais de sur-mesure annoncés trop courts"],
        actions: [
            { dire: "confirme cette commande", fait: "confirmer_commande" },
            { dire: "annule cette commande", fait: "annuler_commande" },
            { dire: "prépare un post pour ce meuble", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quelles livraisons sont prévues cette semaine ?", fait: null },
        ],
        workflows: [
            "commande → dimensions, adresse, étage, ascenseur → créneau choisi → confirmé la veille → livré",
            "sur-mesure → délai de fabrication annoncé → suivi → livraison",
        ],
        outilsDuSecteur: ["catalogue photo", "planning de livraison", "Instagram", "fiches de dimensions"],
        integrations: ["instagram", "facebook", "whatsapp", "shopify", "woocommerce"],
        memoire: ["ses gammes et ses dimensions", "ses délais de sur-mesure", "sa zone et ses moyens de livraison"],
        expertise: "Demande l'ÉTAGE et l'ascenseur avant de confirmer une livraison : c'est la question qui évite le camion qui repart plein. Un créneau confirmé la veille vaut mieux qu'un créneau promis trois semaines avant.",
    },

    // ── SERVICES ────────────────────────────────────────────────────────
    immobilier: {
        description: "Agence immobilière : des visites qui coûtent du temps, pour des acheteurs dont beaucoup ne peuvent pas acheter.",
        contexte: "Tout le monde veut visiter ; peu peuvent financer. Une journée de visites sans qualification préalable est une journée perdue, et elle ne se voit qu'après.",
        objets: ["bien", "visite", "budget", "financement", "mandat", "acquéreur", "propriétaire"],
        donnees: ["budget réel de l'acquéreur", "financement obtenu ou non", "type de bien recherché", "biens sous mandat", "visites par bien"],
        problemes: ["les visites qui ne mènent nulle part", "les acquéreurs non finançables qui occupent l'agenda", "les biens qui restent en portefeuille sans visite"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "prépare un post pour ce bien", fait: "preparer_publication" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quels biens n'ont eu aucune visite ?", fait: null },
        ],
        workflows: [
            "demande → budget et financement qualifiés → visite programmée → suite ou non",
            "mandat signé → bien publié → visites → offre",
        ],
        outilsDuSecteur: ["logiciel de gestion immobilière", "portails d'annonces", "Instagram", "Facebook"],
        integrations: ["instagram", "facebook", "whatsapp", "gmail", "google"],
        memoire: ["son secteur géographique", "ses types de biens", "ses fourchettes de prix"],
        expertise: "Qualifie le BUDGET et le FINANCEMENT avant de poser une visite au calendrier : c'est la seule chose qui distingue une journée utile d'une journée de promenade. Un bien sans visite depuis trois semaines a un problème de prix, pas de photo.",
    },
    autoecole: {
        description: "Auto-école : des heures de conduite vendues à l'unité, sur un nombre de véhicules et de moniteurs fixe.",
        contexte: "Une heure de conduite annulée le matin même est une heure perdue : le moniteur est là, la voiture aussi, et il est trop tard pour la remplacer.",
        objets: ["élève", "heure de conduite", "code", "examen", "forfait", "moniteur", "véhicule"],
        donnees: ["heures effectuées et restantes du forfait", "date d'examen prévue", "taux d'annulation de dernière minute", "disponibilité des moniteurs", "élèves en attente d'un créneau"],
        problemes: ["les heures annulées le matin même", "les élèves qui s'arrêtent avant l'examen", "les créneaux de conduite mal répartis entre moniteurs"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "mets ça à mon agenda", fait: "creer_evenement_agenda" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quels élèves n'ont pas repris d'heures ?", fait: null },
        ],
        workflows: [
            "inscription → forfait → heures programmées → examen → résultat",
            "annulation → créneau reproposé aux élèves en attente → heure sauvée",
        ],
        outilsDuSecteur: ["planning des moniteurs", "suivi des forfaits", "livret d'apprentissage"],
        integrations: ["whatsapp", "facebook", "instagram", "google"],
        memoire: ["ses forfaits et leurs volumes d'heures", "ses moniteurs et leurs disponibilités", "ses sessions d'examen"],
        expertise: "Une heure annulée le matin ne se remplace que s'il existe une liste d'attente prête : c'est la seule parade, et elle se prépare avant, pas le jour même. Surveille les élèves qui cessent de reprendre des heures — ils ne se désinscrivent jamais, ils disparaissent.",
    },
    garage: {
        description: "Garage : des véhicules immobilisés, des devis à faire accepter, et des clients qui appellent pour savoir où ça en est.",
        contexte: "Chaque véhicule occupe une place et du temps de mécanicien. Entre le diagnostic et la réparation, il y a un devis à valider — et tant qu'il n'est pas validé, la place est bloquée pour rien.",
        objets: ["véhicule", "panne", "diagnostic", "devis", "pièce", "immobilisation", "client"],
        donnees: ["nature de la panne", "montant du devis", "devis accepté ou en attente", "délai d'approvisionnement de la pièce", "durée d'immobilisation"],
        problemes: ["les clients qui rappellent dix fois pour savoir si la voiture est prête", "les devis en attente qui bloquent une place", "les pièces qui tardent et allongent l'immobilisation"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "envoie la facture à ce client", fait: "envoyer_facture" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quels devis attendent une réponse ?", fait: null },
        ],
        workflows: [
            "véhicule reçu → diagnostic → devis envoyé → accepté → pièce commandée → réparation → restitution",
            "avancement mis à jour → client informé sans appeler",
        ],
        outilsDuSecteur: ["logiciel de garage", "catalogue de pièces", "planning de l'atelier"],
        integrations: ["whatsapp", "facebook", "gmail", "google"],
        memoire: ["ses spécialités et ses marques", "ses fournisseurs de pièces et leurs délais", "sa capacité d'atelier"],
        expertise: "Un devis en attente immobilise une place : traite-le comme une réparation qui n'a pas commencé, pas comme une vente en cours. Donner l'avancement sans que le client appelle supprime la moitié des interruptions de l'atelier.",
    },
    photographe: {
        description: "Photographe : des dates réservées à l'avance, et un livrable qui arrive longtemps après la prise de vue.",
        contexte: "Une date bloquée sans acompte n'est pas réservée, elle est promise — et une promesse s'annule sans coût, souvent au pire moment. Après la séance, le travail de retouche continue pendant des jours.",
        objets: ["séance", "date", "acompte", "livrable", "retouche", "galerie", "client"],
        donnees: ["date et durée de la séance", "acompte versé", "délai de livraison annoncé", "nombre de photos livrées", "séances en retouche"],
        problemes: ["les dates réservées sans acompte et annulées sans coût", "les livrables qui prennent du retard", "les demandes de retouches sans fin"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "envoie la facture à ce client", fait: "envoyer_facture" },
            { dire: "prépare un post pour cette séance", fait: "preparer_publication" },
            { dire: "quelles séances sont encore en retouche ?", fait: null },
        ],
        workflows: [
            "demande → devis → acompte → date confirmée → séance → retouche → livraison",
            "livrable en retard → client prévenu avant qu'il demande",
        ],
        outilsDuSecteur: ["galerie de livraison en ligne", "Instagram", "logiciel de retouche", "contrats de séance"],
        integrations: ["instagram", "facebook", "whatsapp", "google", "gmail", "youtube"],
        memoire: ["ses formules de séance", "ses délais de livraison", "ses périodes chargées"],
        expertise: "Une date n'est bloquée qu'une fois l'acompte reçu : dis-le avant, jamais après. Annonce un délai de livraison et tiens-le — dans ce métier la réputation se fait autant sur le délai que sur les photos.",
    },
    evenementiel: {
        description: "Événementiel : de l'organisation à la date fixe, avec des prestataires à coordonner et des devis à relancer.",
        contexte: "Le devis est le cœur du métier : envoyé, il ne revient que si on le relance, et la relance dépend du temps qui reste en fin de semaine — c'est-à-dire d'aucun temps.",
        objets: ["événement", "devis", "prestataire", "planning", "relance", "budget", "client"],
        donnees: ["date de l'événement", "montant et date d'envoi du devis", "prestataires engagés", "budget du client", "devis sans réponse"],
        problemes: ["les devis envoyés et jamais relancés", "les prestataires à recoordonner à chaque changement", "les dates qui se chevauchent"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "écris-lui pour relancer le devis", fait: "envoyer_email" },
            { dire: "prépare un post pour cet événement", fait: "preparer_publication" },
            { dire: "quels devis n'ont pas eu de réponse ?", fait: null },
        ],
        workflows: [
            "demande → budget et date → devis → relance au bon moment → accepté ou perdu",
            "événement confirmé → prestataires engagés → planning tenu",
        ],
        outilsDuSecteur: ["modèles de devis", "planning d'événements", "Instagram", "carnet de prestataires"],
        integrations: ["instagram", "facebook", "whatsapp", "gmail", "google", "tiktok"],
        memoire: ["ses types d'événements", "ses prestataires habituels", "ses fourchettes de budget"],
        expertise: "Un devis non relancé est un devis perdu : la relance n'est pas une politesse, c'est le métier. Demande le budget tôt — un devis calibré au hasard se fait refuser sans qu'on sache jamais pourquoi.",
    },
    livreur: {
        description: "Livraison et coursier : des courses à effectuer, et des litiges qui se règlent contre celui qui n'a pas de preuve.",
        contexte: "Sans PREUVE DE LIVRAISON, un litige se règle toujours contre le livreur. La confirmation orale ne vaut rien le jour où quelqu'un conteste.",
        objets: ["course", "tournée", "preuve de livraison", "zone", "délai", "destinataire", "colis"],
        donnees: ["adresse et zone de livraison", "heure de dépôt", "preuve horodatée", "délai promis", "courses par tournée"],
        problemes: ["les litiges sans preuve de livraison", "les tournées mal ordonnées qui rallongent la journée", "les destinataires injoignables à l'arrivée"],
        actions: [
            { dire: "confirme cette commande", fait: "confirmer_commande" },
            { dire: "annule cette commande", fait: "annuler_commande" },
            { dire: "envoie la facture à ce client", fait: "envoyer_facture" },
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "quelles courses restent à livrer ?", fait: null },
        ],
        workflows: [
            "course confirmée → tournée → destinataire prévenu à l'approche → preuve horodatée au dépôt",
            "litige → preuve produite → dossier clos",
        ],
        outilsDuSecteur: ["application de tournée", "preuve photo horodatée", "WhatsApp", "suivi de colis"],
        integrations: ["whatsapp", "telegram", "yalidine", "dhl", "aramex", "amana", "ctm"],
        memoire: ["ses zones de livraison", "ses délais habituels", "ses donneurs d'ordre réguliers"],
        expertise: "La PREUVE avant tout : horodatée, à chaque dépôt, sans exception. Prévenir le destinataire à l'approche évite la course refaite le lendemain, qui est la perte la plus chère du métier.",
    },

    // ── FORMATION & TOURISME ────────────────────────────────────────────
    education: {
        description: "École ou centre de formation : des places limitées, réservées par des inscriptions dont beaucoup ne sont jamais payées.",
        contexte: "Une inscription non payée bloque une place sans rapporter : la place est perdue deux fois, pour l'école et pour l'élève qui aurait pu la prendre.",
        objets: ["élève", "inscription", "place", "cours", "session", "paiement", "formateur"],
        donnees: ["places disponibles par session", "inscriptions non payées", "dates de session", "assiduité des élèves", "tarif et modalités de paiement"],
        problemes: ["les inscriptions non payées qui bloquent des places", "l'inscription et le paiement traités comme deux démarches séparées", "les abandons en cours de session"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "envoie la facture à cet élève", fait: "envoyer_facture" },
            { dire: "prépare un post pour cette session", fait: "preparer_publication" },
            { dire: "quelles inscriptions ne sont pas payées ?", fait: null },
        ],
        workflows: [
            "inscription → paiement au même endroit → place réservée → session suivie",
            "place non payée après un délai → libérée → proposée à la liste d'attente",
        ],
        outilsDuSecteur: ["logiciel de gestion d'élèves", "planning des sessions", "Facebook", "Instagram"],
        integrations: ["facebook", "instagram", "whatsapp", "gmail", "google", "youtube"],
        memoire: ["ses formations et leurs durées", "ses tarifs", "ses sessions et leurs capacités"],
        expertise: "Une place n'est réservée qu'une fois payée : inscription et paiement doivent être le MÊME geste, sinon la moitié des places annoncées n'existe pas. Surveille l'assiduité tôt — un élève qui manque deux séances abandonne presque toujours.",
    },
    hotel: {
        description: "Hôtel ou maison d'hôtes : des nuitées vendues à l'avance, largement par des plateformes qui prennent leur part.",
        contexte: "Les commissions prennent une part de chaque nuit. Chaque réservation obtenue en direct vaut nettement plus que la même réservation venue d'une plateforme.",
        objets: ["chambre", "nuitée", "réservation", "taux d'occupation", "commission", "voyageur", "saison"],
        donnees: ["chambres disponibles par date", "taux d'occupation", "part des réservations en direct", "commission payée", "durée moyenne de séjour"],
        problemes: ["les commissions des plateformes sur chaque nuit", "les chambres vides en basse saison", "les réservations en direct qu'on ne sait pas encaisser"],
        actions: [
            { dire: "propose-lui des créneaux", fait: "proposer_creneaux_rdv" },
            { dire: "prends cette réservation", fait: "prendre_rendez_vous" },
            { dire: "envoie la facture à ce client", fait: "envoyer_facture" },
            { dire: "prépare un post pour l'établissement", fait: "preparer_publication" },
            { dire: "quel est mon taux d'occupation ce mois-ci ?", fait: null },
        ],
        workflows: [
            "demande → chambre disponible sur les dates → réservation en direct → séjour",
            "basse saison identifiée → offre envoyée → chambres remplies",
        ],
        outilsDuSecteur: ["planning des chambres", "plateformes de réservation", "Instagram", "Facebook"],
        integrations: ["instagram", "facebook", "whatsapp", "gmail", "google"],
        memoire: ["ses chambres et ses capacités", "ses saisons", "ses tarifs par période", "sa part de direct"],
        expertise: "Compare toujours le direct et la plateforme sur la MÊME nuit : la commission est le seul levier immédiat de ce métier. Raisonne en taux d'occupation, jamais en nombre de réservations — dix nuits à moitié vides valent moins que cinq pleines.",
    },
    agence_voyage: {
        description: "Agence de voyage : des dossiers de voyageurs à compléter avant une date de départ qui ne bouge pas.",
        contexte: "Un dossier incomplet fait rater un départ, et un départ raté se rembourse. Les pièces se réclament une par une, à des gens qui les envoient au dernier moment.",
        objets: ["dossier voyageur", "pièce", "départ", "visa", "billet", "voyageur", "réservation"],
        donnees: ["date de départ", "pièces reçues et manquantes", "délai d'obtention du visa", "acompte versé", "composition du groupe"],
        problemes: ["les dossiers incomplets découverts trop tard", "les pièces réclamées par messages successifs", "les délais de visa sous-estimés"],
        actions: [
            { dire: "écris-lui pour réclamer les pièces", fait: "envoyer_email" },
            { dire: "prends ce rendez-vous", fait: "prendre_rendez_vous" },
            { dire: "envoie la facture à ce client", fait: "envoyer_facture" },
            { dire: "prépare un post pour cette destination", fait: "preparer_publication" },
            { dire: "quels dossiers sont incomplets avant le départ ?", fait: null },
        ],
        workflows: [
            "dossier ouvert → pièces listées → réclamées → dossier complet avant la date butoir → départ",
            "visa demandé → délai suivi → obtenu avant le départ",
        ],
        outilsDuSecteur: ["logiciel d'agence", "checklists de pièces par destination", "WhatsApp", "portails de réservation"],
        integrations: ["whatsapp", "facebook", "instagram", "gmail", "google"],
        memoire: ["ses destinations", "ses listes de pièces par destination", "ses délais de visa", "ses périodes de départ"],
        expertise: "Travaille à REBOURS depuis la date de départ : chaque pièce a sa propre date butoir, et le visa a la plus longue. Une liste de pièces envoyée en une fois vaut dix relances dispersées.",
    },

    // ── AUTRE ───────────────────────────────────────────────────────────
    //
    // Le filet de sécurité du registre. Lui donner un univers précis serait
    // un mensonge : on ne sait justement PAS de quel métier il s'agit. Son
    // contexte dit donc la seule chose vraie — qu'il faut demander avant de
    // conseiller — et c'est un vrai changement de comportement, pas un
    // remplissage.
    autre: {
        description: "Activité non listée : SAMII ne connaît pas encore ce métier et doit le faire décrire avant de conseiller.",
        contexte: "C'est le seul cas où l'absence d'univers est l'information. Conseiller ici sans avoir demandé, c'est plaquer le métier du voisin sur quelqu'un qui n'a rien à voir.",
        objets: ["activité à découvrir", "interlocuteur", "demande", "échange"],
        donnees: ["ce que la personne vend ou propose", "à qui elle le vend", "comment ses clients la contactent", "ce qui lui prend le plus de temps"],
        problemes: ["le temps passé à répéter les mêmes réponses", "un conseil générique qui ne correspond à rien"],
        actions: [
            { dire: "fais-moi le point de la journée", fait: "resume_journee" },
            { dire: "prépare un post", fait: "preparer_publication" },
            { dire: "raconte-moi ce que tu fais", fait: null },
        ],
        workflows: [
            "activité décrite → vocabulaire repris → conseil adapté",
            "métier reconnu plus tard → contexte du métier appliqué",
        ],
        outilsDuSecteur: ["WhatsApp", "réseaux sociaux"],
        integrations: ["whatsapp", "instagram", "facebook", "telegram"],
        memoire: ["ce qu'elle vend", "à qui", "par quels canaux"],
        expertise: "Tu ne connais pas ce métier, et tu le sais : fais-le décrire avant de conseiller quoi que ce soit. Reprends ensuite EXACTEMENT ses mots à elle — c'est la seule façon d'être utile sans plaquer le métier de quelqu'un d'autre.",
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
