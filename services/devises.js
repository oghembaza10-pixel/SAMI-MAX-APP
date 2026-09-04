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

// Les devises qu'on sait réellement convertir. Écrite une fois : trois
// listes identiques traînaient dans ce fichier, et une quatrième ailleurs
// aurait fini par diverger.
const CONNUES = ["DZD", "MAD", "TND", "EUR", "XAF", "XOF", "USD"];

// Devise d'affichage à partir de la devise du workspace (déjà stockée sur
// workspaces.devise, dérivée du pays à l'inscription) — fallback USD si la
// devise n'est pas une de celles qu'on sait convertir.
function deviseAffichage(devise) {
    return CONNUES.includes(devise) ? devise : "USD";
}

// ── QUEL PAYS PAIE EN QUOI ──────────────────────────────────────────────
//
// « Ça doit être en monnaie réelle de chaque pays, et dans le pire des cas
//   en dollar. »
//
// Ce fichier savait convertir depuis le début. Ce qu'il ne savait pas, et
// que PERSONNE ne savait, c'est de quelle monnaie relève un ACHETEUR. La
// devise venait du workspace du vendeur ou, pire, d'une valeur écrite en
// dur. Relevé en base le 4 septembre, sur de vraies commandes :
//
//     8 commandes en EUR ... pour l'ALGÉRIE
//     1 commande  en DZD ... pour le MALI
//    22 commandes en DZD ... sans aucun pays
//
// Aucune ne correspondait au pays de l'acheteur. Bourama Traoré, à Ségou,
// s'est vu facturer 200 dinars ALGÉRIENS — une monnaie qu'il ne peut ni
// détenir ni virer depuis le Mali.
//
// Les clés sont normalisées (sans accent, sans casse, sans ponctuation) :
// les formulaires envoient « MALI », « Mali », « Côte d'Ivoire » et parfois
// « Cote d Ivoire ». Comparer des chaînes brutes renverrait au dollar une
// commande ivoirienne sur un simple accent.
const PAYS_DEVISE = {
    // Zone franc CFA Ouest (UEMOA)
    mali: "XOF", senegal: "XOF", "cote divoire": "XOF", "cote d ivoire": "XOF",
    "burkina faso": "XOF", benin: "XOF", togo: "XOF", niger: "XOF",
    "guinee bissau": "XOF",
    // Zone franc CFA Centre (CEMAC)
    cameroun: "XAF", gabon: "XAF", tchad: "XAF", congo: "XAF",
    "republique centrafricaine": "XAF", "guinee equatoriale": "XAF",
    // Maghreb
    algerie: "DZD", maroc: "MAD", tunisie: "TND",
    // Europe
    france: "EUR", belgique: "EUR", espagne: "EUR", italie: "EUR",
    allemagne: "EUR", portugal: "EUR",
};

// Codes ISO et noms anglais : ils arrivent d'un navigateur en anglais,
// d'un import fournisseur ou d'une API de livraison.
const PAYS_ALIAS = {
    ml: "mali", sn: "senegal", ci: "cote divoire", bf: "burkina faso",
    bj: "benin", tg: "togo", ne: "niger", gw: "guinee bissau",
    cm: "cameroun", ga: "gabon", td: "tchad", cg: "congo",
    dz: "algerie", ma: "maroc", tn: "tunisie", fr: "france",
    "ivory coast": "cote divoire", burkina: "burkina faso",
    algeria: "algerie", morocco: "maroc", tunisia: "tunisie",
    cameroon: "cameroun", chad: "tchad",
};

function normaliserPays(pays) {
    const brut = String(pays || "").trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/['\u2019`.,]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return PAYS_ALIAS[brut] || brut;
}

// Rend TOUJOURS une devise connue — jamais null, qui obligerait chaque
// appelant à réinventer son propre repli, donc à diverger.
function pourPays(pays) {
    return PAYS_DEVISE[normaliserPays(pays)] || "USD";
}

// ── CONVERTIR D'UNE DEVISE VERS UNE AUTRE ───────────────────────────────
//
// `depuisUSD` et `depuisEUR` ne savaient partir que de deux monnaies. Un
// prix affiché en EUR à un acheteur malien devait pouvoir devenir des XOF :
// il fallait donc un chemin quelconque → quelconque. Le dollar sert de
// pivot, parce que c'est là que les taux sont déjà écrits.
//
// Rend `{ ok, montant, devise, raison }` et JAMAIS un nombre nu. C'est
// délibéré : `depuisUSD` rend le montant INCHANGÉ pour une devise inconnue
// (`default: return montantUSD`), ce qui facture des dollars pour des
// dinars sans que rien ne le signale. Sur de l'argent, un refus explicite
// vaut mieux qu'un chiffre plausible.
function versUSD(montant, devise) {
    const d = CONFIG.DEVISES;
    switch (devise) {
        case "USD": return montant;
        case "EUR": return montant * d.EUR_TO_USD;
        case "DZD": return montant / d.USD_TO_DZD;
        case "MAD": return montant / d.USD_TO_MAD;
        case "TND": return montant / d.USD_TO_TND;
        case "XAF":
        case "XOF": return (montant / PARITE_FIXE_EUR[devise]) * d.EUR_TO_USD;
        default:    return null;
    }
}

function convertir(montant, de, vers) {
    const n = Number(montant);
    if (!Number.isFinite(n)) return { ok: false, raison: `montant illisible : ${montant}` };

    const source = String(de || "").toUpperCase();
    const cible = String(vers || "").toUpperCase();
    if (!CONNUES.includes(source)) return { ok: false, raison: `devise inconnue : ${source || "(vide)"}` };
    if (!CONNUES.includes(cible)) return { ok: false, raison: `devise inconnue : ${cible || "(vide)"}` };
    if (source === cible) return { ok: true, montant: arrondir(n, cible), devise: cible };

    const enUSD = versUSD(n, source);
    if (enUSD === null) return { ok: false, raison: `conversion impossible depuis ${source}` };
    return { ok: true, montant: arrondir(depuisUSD(enUSD, cible), cible), devise: cible };
}

// Le franc CFA et le dinar algérien n'ont pas de centimes : rendre
// 4 499,997 au lieu de 4 500 se voit sur une facture.
function arrondir(montant, devise) {
    return ["DZD", "MAD", "TND", "XAF", "XOF"].includes(String(devise).toUpperCase())
        ? Math.round(montant)
        : Math.round(montant * 100) / 100;
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

module.exports = {
    deviseAffichage, depuisUSD, depuisEUR, formater, PARITE_FIXE_EUR,
    pourPays, normaliserPays, convertir, versUSD, arrondir, CONNUES, PAYS_DEVISE,
};
