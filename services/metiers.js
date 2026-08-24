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

module.exports = { METIERS, IDS, IDS_RDV, estValide, estRdv, label, icone, parGroupe };
