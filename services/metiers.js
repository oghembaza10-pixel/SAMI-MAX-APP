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

    // ── Services ─────────────────────────────────────────────────────────
    { id: "immobilier",  label: "Agence immobilière",    groupe: "Services",        icone: "🏘️", parcours: "rdv" },
    { id: "autoecole",   label: "Auto-école",            groupe: "Services",        icone: "🚗", parcours: "rdv" },
    { id: "garage",      label: "Garage / Mécanique",    groupe: "Services",        icone: "🔧", parcours: "rdv" },
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

    // ── Services ─────────────────────────────────────────────────────────
    immobilier:  { perte: "Les visites qui ne mènent nulle part mangent les journées.", defaut: "Tout le monde visite, y compris ceux qui ne peuvent pas acheter.", reponse: "SAMII qualifie budget et financement avant de poser une visite au calendrier." },
    autoecole:   { perte: "Une heure de conduite annulée le matin même est une heure perdue.", defaut: "Les annulations arrivent par appel, trop tard pour remplacer.", reponse: "Annulation en ligne et créneau reproposé automatiquement aux élèves en attente." },
    garage:      { perte: "Les clients rappellent dix fois pour savoir si la voiture est prête.", defaut: "L'avancement ne se sait qu'en appelant l'atelier.", reponse: "Le client suit l'état de sa réparation et reçoit le devis à valider." },
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

// Le contenu d'un métier, prêt pour sa page. `null` quand le métier n'existe
// pas — l'appelant doit répondre 404 plutôt que de servir une page à moitié
// vide, qui serait indexée par Google telle quelle.
function fiche(id) {
    const m = METIERS.find(x => x.id === id);
    if (!m) return null;
    const d = DOULEURS[id];
    if (!d) return null;   // un métier sans contenu propre n'a pas de page
    return { ...m, ...d };
}

// Les métiers qui ont une page publique. Sert au plan du site et au hub : un
// métier listé quelque part doit répondre partout ailleurs, sinon on envoie
// Google — et les visiteurs — sur des pages absentes.
function avecFiche() {
    return METIERS.filter(m => DOULEURS[m.id]);
}

module.exports = { METIERS, IDS, IDS_RDV, DOULEURS, estValide, estRdv, label, icone, parGroupe, fiche, avecFiche };
