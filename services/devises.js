// ==========================================================================
// SAMII OS — DEVISES — conversion et affichage multi-devises
// Prix internes en USD (abonnements) ou EUR (marketplace, import CJ).
// Voir CONFIG.DEVISES pour la logique des taux (marché parallèle pour le
// dinar algérien, marché réel pour dirham/dinar tunisien).
// ==========================================================================
const CONFIG = require("../config");

const SYMBOLES = { USD: "$", EUR: "€", DZD: "DZD", MAD: "DH", TND: "DT" };

// Devise d'affichage à partir de la devise du workspace (déjà stockée sur
// workspaces.devise, dérivée du pays à l'inscription) — fallback USD si la
// devise n'est pas une de celles qu'on sait convertir.
function deviseAffichage(devise) {
    return ["DZD", "MAD", "TND", "EUR"].includes(devise) ? devise : "USD";
}

function depuisUSD(montantUSD, devise) {
    const d = CONFIG.DEVISES;
    switch (devise) {
        case "DZD": return montantUSD * d.USD_TO_DZD;
        case "MAD": return montantUSD * d.USD_TO_MAD;
        case "TND": return montantUSD * d.USD_TO_TND;
        case "EUR": return montantUSD / d.EUR_TO_USD;
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
        default:    return montantEUR;
    }
}

function formater(montant, devise) {
    const symbole = SYMBOLES[devise] || devise;
    const valeur = ["DZD", "MAD", "TND"].includes(devise) ? Math.round(montant) : montant.toFixed(2);
    return (devise === "USD" || devise === "EUR")
        ? `${symbole}${valeur}`
        : `${valeur} ${symbole}`;
}

module.exports = { deviseAffichage, depuisUSD, depuisEUR, formater };
