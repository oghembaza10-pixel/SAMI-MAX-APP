// ==========================================================================
// SAMII OS — PAR OÙ L'ARGENT ENTRE ET SORT, PAYS PAR PAYS
//
// POURQUOI CE FICHIER DÉCIDE DE TOUT. Une place de marché occidentale suppose
// une carte bancaire et un IBAN. En Afrique et au Maghreb, cette supposition
// élimine la majorité des gens avant même qu'ils essaient : en Algérie on paie
// au CCP ou en Edahabia, au Nigeria par virement instantané ou mobile money,
// au Sénégal et en Côte d'Ivoire par Wave et Orange Money, au Kenya par M-Pesa.
// Construire la place sur la carte, c'est construire une place vide.
//
// LA DÉCISION D'ARCHITECTURE. Le registre des transactions
// (services/academie.js) ne connaît AUCUN moyen de paiement : il n'enregistre
// qu'un montant, un taux, une commission et un statut. Ce fichier-ci décrit
// séparément par où l'argent peut entrer et sortir dans chaque pays. Les deux
// ne se touchent jamais. Conséquence directe : ouvrir un pays de plus, c'est
// ajouter une entrée ici — jamais toucher à la comptabilité, jamais migrer une
// table, jamais rejouer l'historique.
//
// AUTOMATIQUE OU À LA MAIN, MAIS JAMAIS FAUX. Certains rails se règlent tout
// seuls (Chargily, carte). D'autres demandent qu'un humain confirme la
// réception (CCP, virement, espèces). Un rail manuel est plus lent ; il n'est
// pas moins réel, et il vaut infiniment mieux qu'un pays fermé. Ce qui compte,
// c'est que le registre dise la vérité dans les deux cas.
//
// CE QUI N'EST PAS ICI. Aucune clé, aucun identifiant, aucun secret : ce
// fichier est une carte du terrain, pas un trousseau.
// ==========================================================================

// Les moyens, décrits une fois. `automatique` dit si la plateforme peut
// constater le mouvement seule ; sinon, quelqu'un valide.
const MOYENS = {
    ccp: {
        id: "ccp", label: "CCP — Algérie Poste", icone: "🏦",
        sens: ["entree", "sortie"], automatique: false,
        note: "Virement postal. Confirmation par l'équipe après vérification du versement.",
    },
    chargily: {
        id: "chargily", label: "Edahabia / CIB", icone: "💳",
        sens: ["entree"], automatique: true,
        note: "Les deux cartes domestiques algériennes. Aucun prélèvement récurrent possible.",
    },
    mobile_money: {
        id: "mobile_money", label: "Mobile money", icone: "📱",
        sens: ["entree", "sortie"], automatique: false,
        note: "Le vrai compte bancaire d'une grande partie du continent : un numéro de téléphone.",
    },
    virement: {
        id: "virement", label: "Virement bancaire", icone: "🏛️",
        sens: ["entree", "sortie"], automatique: false,
        note: "Lent mais universel. Le recours quand rien d'autre n'existe.",
    },
    carte: {
        id: "carte", label: "Carte internationale", icone: "💳",
        sens: ["entree"], automatique: true,
        note: "Visa/Mastercard. Minoritaire sur nos marchés, indispensable à l'international.",
    },
    especes: {
        id: "especes", label: "Espèces", icone: "💵",
        sens: ["entree", "sortie"], automatique: false,
        note: "Remise en main propre, constatée par l'équipe ou par l'agence. Ne jamais faire semblant de l'ignorer : c'est ainsi qu'une grande partie du commerce se règle.",
    },
};

// Ce qu'on sait faire, pays par pays. `operateurs` nomme les services locaux
// pour que le marchand reconnaisse le sien au lieu de lire « mobile money ».
const PAYS = {
    DZ: {
        nom: "Algérie", devise: "DZD",
        entree: ["chargily", "ccp", "especes"],
        sortie: ["ccp", "especes"],
        operateurs: [],
    },
    MA: {
        nom: "Maroc", devise: "MAD",
        entree: ["virement", "mobile_money", "carte", "especes"],
        sortie: ["virement", "mobile_money", "especes"],
        operateurs: ["Cash Plus", "Wafacash", "inwi money"],
    },
    TN: {
        nom: "Tunisie", devise: "TND",
        entree: ["virement", "mobile_money", "carte", "especes"],
        sortie: ["virement", "mobile_money", "especes"],
        operateurs: ["D17", "e-DINAR"],
    },
    NG: {
        nom: "Nigeria", devise: "NGN",
        entree: ["virement", "mobile_money", "carte"],
        sortie: ["virement", "mobile_money"],
        operateurs: ["Bank transfer", "OPay", "PalmPay", "Moniepoint"],
    },
    SN: {
        nom: "Sénégal", devise: "XOF",
        entree: ["mobile_money", "virement", "especes"],
        sortie: ["mobile_money", "especes"],
        operateurs: ["Wave", "Orange Money", "Free Money"],
    },
    CI: {
        nom: "Côte d'Ivoire", devise: "XOF",
        entree: ["mobile_money", "virement", "especes"],
        sortie: ["mobile_money", "especes"],
        operateurs: ["Wave", "Orange Money", "MTN MoMo", "Moov Money"],
    },
    CM: {
        nom: "Cameroun", devise: "XAF",
        entree: ["mobile_money", "virement", "especes"],
        sortie: ["mobile_money", "especes"],
        operateurs: ["MTN MoMo", "Orange Money"],
    },
    GH: {
        nom: "Ghana", devise: "GHS",
        entree: ["mobile_money", "virement", "carte"],
        sortie: ["mobile_money", "virement"],
        operateurs: ["MTN MoMo", "Telecel Cash", "AirtelTigo Money"],
    },
    KE: {
        nom: "Kenya", devise: "KES",
        entree: ["mobile_money", "virement", "carte"],
        sortie: ["mobile_money", "virement"],
        operateurs: ["M-Pesa", "Airtel Money"],
    },
    EG: {
        nom: "Égypte", devise: "EGP",
        entree: ["mobile_money", "virement", "carte"],
        sortie: ["mobile_money", "virement"],
        operateurs: ["Vodafone Cash", "InstaPay"],
    },
};

// Partout ailleurs. Pas un rejet : un pays qu'on ne connaît pas encore garde
// le virement, qui marche de partout, et la carte.
const DEFAUT = {
    nom: "International", devise: "USD",
    entree: ["carte", "virement"],
    sortie: ["virement"],
    operateurs: [],
};

function pays(code) {
    return PAYS[String(code || "").toUpperCase()] || DEFAUT;
}

// Les moyens d'encaisser dans ce pays, décrits pour être affichés tels quels.
function moyensEntree(code) {
    return pays(code).entree.map((id) => MOYENS[id]).filter(Boolean);
}

// Les moyens de reverser un vendeur dans ce pays.
function moyensSortie(code) {
    return pays(code).sortie.map((id) => MOYENS[id]).filter(Boolean);
}

// Vrai si au moins un rail se règle sans intervention humaine. Sert à savoir
// si une transaction peut se conclure en libre-service ou si l'équipe doit
// confirmer — pas à décider si le pays est ouvert : tous le sont.
function aUnRailAutomatique(code) {
    return moyensEntree(code).some((m) => m.automatique);
}

// Tous les pays servis, pour un sélecteur. Trié par nom, l'international en
// dernier parce qu'il est le repli, pas un choix.
function listePays() {
    return Object.entries(PAYS)
        .map(([code, p]) => ({ code, ...p }))
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

module.exports = { MOYENS, PAYS, DEFAUT, pays, moyensEntree, moyensSortie, aUnRailAutomatique, listePays };
