// ==========================================================================
// SAMII OS — LES MOYENS DE PAIEMENT
//
// L'IDÉE. « Les gens ils auront une liste et qui peuvent choisir avec quoi
// ils payent. » Un acheteur à Douala paie en MTN MoMo, un acheteur à Alger
// paie en Edahabia, un acheteur à Paris paie par carte. Aucun des trois ne
// veut voir les moyens des deux autres.
//
// LA TENTATION À NE PAS SUIVRE. Trois boutons écrits en dur dans la page de
// paiement, chacun avec son `if`. Au quatrième prestataire — et il y en aura
// un, il en arrive tous les ans en Afrique — la page devient illisible et
// chaque correction est à faire quatre fois.
//
// CE QU'ON FAIT À LA PLACE. Un prestataire est une ENTRÉE DE DONNÉES : un
// nom, une devise, une liste de pays, de quoi il a besoin pour fonctionner.
// La page de paiement ne connaît aucun prestataire par son nom ; elle affiche
// ce que ce fichier lui donne. Ajouter un moyen de paiement = ajouter une
// entrée ici + un adaptateur dans services/paiements.js.
//
// ─────────────────────────────────────────────────────────────────────────
// POURQUOI LES PAYS COMPTENT AUTANT QUE LES CLÉS
//
// Un prestataire dont on a les clés mais qui ne couvre pas le pays de
// l'acheteur est pire qu'un prestataire absent : l'acheteur le choisit, y
// croit, et échoue au dernier écran — celui où il avait déjà décidé
// d'acheter. C'est là qu'on perd une vente, pas avant.
//
// Un moyen de paiement ne s'affiche donc que si DEUX conditions tiennent :
// ses clés sont configurées, ET il couvre le pays de l'acheteur.
//
// ─────────────────────────────────────────────────────────────────────────
// LE PIÈGE DES DEUX FRANCS CFA
//
// XOF et XAF portent le même nom courant — « franc CFA » — la même valeur
// face à l'euro, et ce ne sont PAS la même monnaie : deux zones, deux
// banques centrales. Le Bénin est en XOF, le Cameroun en XAF.
// Les traiter comme interchangeables marcherait à l'affichage et casserait
// au versement. Chaque prestataire déclare donc explicitement les deux s'il
// couvre les deux — jamais « CFA » tout court.
// ==========================================================================

// Codes ISO à deux lettres. « * » = partout ailleurs (cartes internationales).
const FOURNISSEURS = {
    // ── Afrique de l'Ouest et Centrale — mobile money ────────────────────
    // Le moyen de paiement du quotidien là où la carte bancaire est rare.
    // Les dix-sept pays annoncés par le prestataire, en Orange Money et MTN.
    sebpay: {
        id: "sebpay",
        nom: "Mobile Money",
        detail: "Orange Money · MTN MoMo",
        emoji: "📱",
        devises: ["XOF", "XAF"],
        pays: ["BJ", "BF", "CI", "GW", "ML", "NE", "SN", "TG",
               "CM", "CF", "TD", "CG", "GQ", "GA",
               "GN", "CD", "RW"],
        // Ce qu'il faut dans l'environnement pour que ce moyen existe.
        cles: ["SEBPAY_CLE_SECRETE", "SEBPAY_URL_API"],
        // Volontairement à false tant que la documentation du prestataire
        // n'est pas entre nos mains. Coder l'appel d'après une supposition,
        // c'est découvrir en production que le champ s'appelle `montant` et
        // pas `amount` — et le découvrir sur l'argent d'un vrai client.
        // Une ligne à passer à true le jour où l'adaptateur est écrit.
        pret: false,
        ordre: 1,
    },

    // ── Algérie ──────────────────────────────────────────────────────────
    chargily: {
        id: "chargily",
        nom: "Carte algérienne",
        detail: "Edahabia · CIB",
        emoji: "💳",
        devises: ["DZD"],
        pays: ["DZ"],
        cles: ["CHARGILY_API_KEY"],
        pret: true,
        ordre: 2,
    },

    // ── Le reste du monde ────────────────────────────────────────────────
    // Le repli universel : la diaspora qui achète pour de la famille au
    // pays, et tous les pays qu'aucun des deux autres ne couvre.
    stripe: {
        id: "stripe",
        nom: "Carte bancaire",
        detail: "Visa · Mastercard · international",
        emoji: "🌍",
        devises: ["EUR", "USD"],
        pays: ["*"],
        cles: ["STRIPE_SECRET_KEY"],
        pret: true,
        ordre: 3,
    },
};

// Un prestataire est configuré si TOUTES ses clés sont présentes. Une seule
// qui manque et l'appel échouerait au moment du paiement — autant ne pas
// proposer le moyen du tout.
function configure(f) {
    return f.cles.every((c) => Boolean(process.env[c]));
}

function couvre(f, pays) {
    if (f.pays.includes("*")) return true;
    if (!pays) return false;
    return f.pays.includes(String(pays).toUpperCase());
}

// Ce qu'un acheteur donné doit voir, dans l'ordre. On ne renvoie jamais un
// moyen qui échouerait : ni clés manquantes, ni adaptateur non écrit, ni
// pays non couvert.
function pour({ pays } = {}) {
    return Object.values(FOURNISSEURS)
        .filter((f) => f.pret && configure(f) && couvre(f, pays))
        .sort((a, b) => a.ordre - b.ordre);
}

// Tous les moyens et leur état réel, sans filtre — pour une page
// d'administration qui doit montrer ce qui manque, pas le cacher.
function etat() {
    return Object.values(FOURNISSEURS)
        .sort((a, b) => a.ordre - b.ordre)
        .map((f) => ({
            ...f,
            configure: configure(f),
            clesManquantes: f.cles.filter((c) => !process.env[c]),
        }));
}

function get(id) {
    return FOURNISSEURS[String(id || "").toLowerCase()] || null;
}

module.exports = { FOURNISSEURS, pour, etat, get, configure, couvre };
