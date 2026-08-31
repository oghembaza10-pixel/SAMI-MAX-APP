// ==========================================================================
// SAMII OS — DEVISES — conversion et affichage multi-devises
// Prix internes en USD (abonnements) ou EUR (marketplace, import CJ).
// Voir CONFIG.DEVISES pour la logique des taux (marché parallèle pour le
// dinar algérien, marché réel pour dirham/dinar tunisien).
// ==========================================================================
const CONFIG = require("../config");

const SYMBOLES = { USD: "$", EUR: "€", DZD: "DZD", MAD: "DH", TND: "DT", XAF: "FCFA", XOF: "FCFA" };

// ── LE FRANC CFA ────────────────────────────────────────────────────────
//
// XAF (Afrique centrale — Cameroun, Gabon, Tchad…) et XOF (Afrique de
// l'Ouest — Sénégal, Côte d'Ivoire, Mali…) sont ARRIMÉS À L'EURO par un
// accord monétaire : 1 € = 655,957 francs, exactement, depuis 1999.
//
// Ce n'est donc PAS un taux de marché, et ça change tout : il ne bouge pas,
// il n'a pas de « marché parallèle » comme le dinar algérien, et il n'a pas
// à être rafraîchi. Un taux figé ailleurs dans ce fichier serait une valeur
// périmée ; celui-ci est la règle elle-même.
//
// Les deux valent le même nombre de francs pour un euro, mais ce sont DEUX
// monnaies distinctes : on ne paie pas à Dakar avec des billets de Douala.
// On ne les confond donc pas, même si le calcul est identique.
const PARITE_FIXE_EUR = { XAF: 655.957, XOF: 655.957 };

// Devise d'affichage à partir de la devise du workspace (déjà stockée sur
// workspaces.devise, dérivée du pays à l'inscription) — fallback USD si la
// devise n'est pas une de celles qu'on sait convertir.
function deviseAffichage(devise) {
    return ["DZD", "MAD", "TND", "EUR", "XAF", "XOF"].includes(devise) ? devise : "USD";
}

function depuisUSD(montantUSD, devise) {
    const d = CONFIG.DEVISES;
    switch (devise) {
        case "DZD": return montantUSD * d.USD_TO_DZD;
        case "MAD": return montantUSD * d.USD_TO_MAD;
        case "TND": return montantUSD * d.USD_TO_TND;
        case "EUR": return montantUSD / d.EUR_TO_USD;
        // Le CFA passe par l'euro : c'est sa définition, pas un détour.
        case "XAF":
        case "XOF": return (montantUSD / d.EUR_TO_USD) * PARITE_FIXE_EUR[devise];
        default:    return montantUSD;
    }
}

function depuisEUR(montantEUR, devise) {
    const d = CONFIG.DEVISES;
    switch (devise) {
        case "DZD": return montantEUR * CONFIG.CHARGILY.EUR_TO_DZD_RATE;
        case "MAD": return montantEUR * d.EUR_TO_USD * d.USD_TO_MAD;
        case "TND": return montantEUR * d.EUR_TO_USD * d.USD_TO_TND;
        case "USD": return montantEUR * d.EUR_TO_USD;
        case "XAF":
        case "XOF": return montantEUR * PARITE_FIXE_EUR[devise];
        default:    return montantEUR;
    }
}

function formater(montant, devise) {
    const symbole = SYMBOLES[devise] || devise;
    // Le franc CFA n'a pas de centimes en circulation : afficher
    // « 3 279,79 FCFA » annonce une précision qui n'existe pas au comptoir.
    const valeur = ["DZD", "MAD", "TND", "XAF", "XOF"].includes(devise)
        ? Math.round(montant).toLocaleString("fr-FR")
        : montant.toFixed(2);
    return (devise === "USD" || devise === "EUR")
        ? `${symbole}${valeur}`
        : `${valeur} ${symbole}`;
}

module.exports = { deviseAffichage, depuisUSD, depuisEUR, formater, PARITE_FIXE_EUR };
