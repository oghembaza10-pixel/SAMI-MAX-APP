// ==========================================================================
// SAMII OS — LA VITRINE DE L'ACADÉMIE
//
// LE PROBLÈME QU'ELLE RÉSOUT. Un restaurateur qui perd deux heures par jour au
// téléphone ne sait pas s'il lui faut une application ou quelqu'un. Lui
// demander de choisir entre « le catalogue d'apps » et « l'annuaire de
// prestataires », c'est lui demander de trancher une question qu'il ne sait pas
// trancher. Une seule grille, donc, filtrée par SON métier — pas par la nature
// du fournisseur. À lui de choisir entre « installer maintenant » et « parler à
// quelqu'un », côte à côte.
//
// LA SALLE VIDE, ET COMMENT ON L'ÉVITE. C'est ce qui tue les places de marché :
// jour 1, zéro prestataire ; le marchand voit du vide et ne revient pas ; le
// développeur voit du vide et ne s'inscrit pas. Notre avantage est que les
// marchands sont DÉJÀ là — le côté manquant, ce sont les développeurs. Donc la
// grille s'ouvre remplie par ce qui existe déjà : les outils que SAMII fournit
// lui-même, présentés comme des solutions. Le premier développeur qui arrive
// pose son travail dans un lieu habité, pas dans un hangar.
//
// TROIS SOURCES, UNE SEULE FORME DE CARTE. Applications publiées par des tiers,
// outils SAMII, prestataires. Le reste du code ne manipule qu'une seule forme,
// ce qui laisse la liberté d'ajouter une quatrième source sans toucher à la vue.
// ==========================================================================
const db = require("./db");
const { CARTES } = require("../config/cartes-catalog");
const metiers = require("./metiers");

// Les natures d'une carte de vitrine. L'ordre compte : à pertinence égale, une
// solution qu'on peut installer tout de suite passe devant une prise de
// contact — le marchand est venu régler un problème, pas engager une relation.
const NATURES = {
    outil:       { id: "outil",       label: "Outil SAMII",   action: "Ouvrir",              rang: 0 },
    application: { id: "application", label: "Application",   action: "Installer",           rang: 1 },
    prestataire: { id: "prestataire", label: "Prestataire",   action: "Prendre contact",     rang: 2 },
};

// À quels métiers un outil SAMII parle vraiment. Tout ne sert pas à tout le
// monde : proposer « Chasseur de Stock » à un dentiste décrédibilise la grille
// entière. Une carte absente d'ici est proposée à tous — c'est le cas des
// outils réellement universels.
const OUTILS_PAR_METIER = {
    messagereclair:  ["ecommerce", "boutique", "restaurant", "fastfood", "patisserie", "traiteur"],
    topproduits:     ["ecommerce", "boutique", "pharmacie", "restaurant", "fastfood"],
    chasseurstock:   ["ecommerce", "boutique", "pharmacie"],
    oeilconcurrentiel: ["ecommerce", "boutique", "restaurant", "salle_sport"],
    memoireclient:   ["dentiste", "medecin", "kine", "coiffeur", "barbier", "esthetique", "spa", "salle_sport", "veterinaire"],
    diplomate:       ["dentiste", "medecin", "laboratoire", "opticien", "veterinaire", "coiffeur", "esthetique"],
};

// Les mots qu'un marchand tape vraiment. Il ne cherche pas « Diplomate », il
// cherche « répondre aux clients » ; pas « Messager Éclair », mais « suivi
// colis ». Sans ce pont entre son vocabulaire et nos noms de produits, la
// recherche ne trouve jamais rien et la vitrine paraît vide alors qu'elle est
// pleine — le pire des deux mondes.
// Les mots qui ne discriminent rien. Sans cette liste, « les » ou « pour »
// font correspondre presque toutes les cartes et la recherche devient du bruit.
const MOTS_VIDES = new Set([
    "les", "des", "mes", "ton", "tes", "mon", "ma", "sa", "ses", "nos", "vos",
    "pour", "avec", "dans", "une", "un", "le", "la", "de", "du", "et", "ou",
    "que", "qui", "sur", "aux", "par", "est", "son", "leur", "chez", "plus",
]);

const MOTS_CLES = {
    "samii-mode":      "autonomie automatique seul valider contrôle",
    messagereclair:    "livraison colis suivi tracking transporteur retard notification",
    missions:          "tâches todo priorités quoi faire aujourd'hui",
    coffre:            "bonus objets forteresse boost",
    griot:             "contenu photo vidéo script publication réseaux sociaux visuel création",
    automatisations:   "automatiser relance panier abandonné règles",
    diplomate:         "répondre message client réponse sav service client",
    memoireclient:     "crm historique client fidélité vip mémoire rendez-vous récurrent",
    topproduits:       "quoi vendre tendance produit gagnant marché",
    oeilconcurrentiel: "concurrent prix marché veille comparer",
    opportunites:      "opportunité niche idée marché prospect recherche",
    oraclefinancier:   "revenus prévision chiffre affaires trésorerie gagner combien argent",
    miroir:            "diagnostic audit points faibles analyse",
    chasseurstock:     "fournisseur sourcing importer stock grossiste",
    arsenal:           "marketing publicité outils campagne",
};

function carteDepuisOutil(carte) {
    return {
        nature: "outil",
        id: `outil:${carte.id}`,
        titre: carte.nom,
        description: carte.description,
        icone: carte.icone,
        auteur: "SAMII OS",
        auteurType: "maison",
        lien: carte.route,
        metiers: OUTILS_PAR_METIER[carte.id] || null, // null = tous
        prix: null,
        palier: carte.palier,
        motsCles: MOTS_CLES[carte.id] || "",
    };
}

function carteDepuisApp(app) {
    return {
        nature: "application",
        id: `app:${app.slug}`,
        titre: app.nom,
        description: app.description || "",
        icone: "🧩",
        auteur: app.developpeur_nom || "Développeur de l'Académie",
        auteurType: "tiers",
        lien: `/apps/${app.slug}/installer`,
        metiers: null,
        prix: null,
        palier: "pro",
        motsCles: "",
    };
}

// Les applications tierces publiées. Une erreur de lecture ne doit pas vider
// la vitrine : on renvoie une liste vide et les autres sources tiennent la
// page. Une page à moitié pleine vaut mieux qu'une page en erreur.
async function applicationsPubliees() {
    try {
        return await db.query(
            `SELECT a.slug, a.nom, a.description,
                    COALESCE(NULLIF(TRIM(CONCAT(u.prenom, ' ', u.nom)), ''), 'Développeur') AS developpeur_nom
               FROM apps a
               LEFT JOIN utilisateurs u ON u.id = a.developpeur_id
              WHERE a.statut = 'publiee'
              ORDER BY a.created_at DESC LIMIT 60`,
        );
    } catch (err) {
        console.warn("⚠️ vitrine.applicationsPubliees :", err.message);
        return [];
    }
}

// Un mot tapé n'est presque jamais la forme exacte du mot indexé : on cherche
// « relancer », le mot-clé dit « relance ». On compare donc les racines, sans
// aller jusqu'à une vraie lemmatisation — inutilement lourde ici, et source de
// faux positifs sur des mots courts.
function racine(mot) {
    return mot.length > 5 ? mot.slice(0, 5) : mot;
}

// Un mot trouvé dans le titre vaut plus qu'un mot croisé au hasard dans une
// description. Sans cette pondération, « faire des vidéos » remonte l'outil
// dont la description contient « faire » avant celui qui fabrique les vidéos.
function pertinence(carte, mots) {
    const titre = carte.titre.toLowerCase();
    const cles = String(carte.motsCles || "").toLowerCase();
    const desc = String(carte.description || "").toLowerCase();
    let score = 0;
    for (const mot of mots) {
        const r = racine(mot);
        if (titre.includes(r)) score += 4;
        else if (cles.includes(r)) score += 2;
        else if (desc.includes(r)) score += 1;
    }
    return score;
}

// Assemble la grille. `metier` est le filtre principal — celui du marchand ;
// `nature` et `recherche` affinent.
async function grille({ metier = "", nature = "", recherche = "" } = {}) {
    const apps = await applicationsPubliees();

    let cartes = [
        ...CARTES.map(carteDepuisOutil),
        ...apps.map(carteDepuisApp),
    ];

    if (metier) {
        // Une carte sans métier déclaré parle à tout le monde : on la garde.
        cartes = cartes.filter((c) => !c.metiers || c.metiers.includes(metier));
    }
    if (nature && NATURES[nature]) {
        cartes = cartes.filter((c) => c.nature === nature);
    }
    if (recherche) {
        // « prendre les rendez-vous » doit trouver ce qui parle de rendez-vous,
        // sans exiger la phrase exacte. Deux précautions :
        //  • les mots vides sont écartés — « les » apparaît dans presque toutes
        //    les descriptions et ferait remonter la grille entière ;
        //  • on classe par nombre de mots trouvés, pour que la carte qui
        //    répond vraiment passe devant celle qui contient un mot au hasard.
        const mots = recherche.toLowerCase().split(/[^\p{L}\p{N}-]+/u)
            .filter((m) => m.length > 1 && !MOTS_VIDES.has(m));
        if (mots.length) {
            cartes = cartes
                .map((c) => ({ c, score: pertinence(c, mots) }))
                .filter((x) => x.score > 0)
                .sort((a, b) => b.score - a.score || a.c.titre.localeCompare(b.c.titre, "fr"))
                .map((x) => x.c);
            return cartes;
        }
    }

    cartes.sort((a, b) => (NATURES[a.nature].rang - NATURES[b.nature].rang)
        || a.titre.localeCompare(b.titre, "fr"));

    return cartes;
}

// Les métiers proposés en filtre, groupés comme dans services/metiers.js —
// un marchand cherche « Restauration » puis « Fast-food », jamais l'inverse.
function metiersGroupes() {
    const groupes = new Map();
    for (const m of metiers.METIERS || []) {
        if (!groupes.has(m.groupe)) groupes.set(m.groupe, []);
        groupes.get(m.groupe).push({ id: m.id, label: m.label, icone: m.icone });
    }
    return [...groupes.entries()].map(([groupe, items]) => ({ groupe, items }));
}

// Combien de prestataires humains sont visibles aujourd'hui. Sert à décider si
// on affiche l'appel aux développeurs plutôt qu'une section vide — on ne
// montre jamais une rubrique « Prestataires (0) ».
async function nombrePrestataires() {
    return 0; // Les profils arrivent avec la prochaine pierre.
}

module.exports = { NATURES, grille, metiersGroupes, nombrePrestataires };
