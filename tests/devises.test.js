// ==========================================================================
// CHACUN PAIE DANS SA MONNAIE
// ==========================================================================
//
// Relevé en base le 4 septembre, sur de VRAIES commandes :
//
//     8 commandes en EUR ... pour l'ALGÉRIE
//     1 commande  en DZD ... pour le MALI
//    22 commandes en DZD ... sans aucun pays
//
// Aucune ne correspondait au pays de l'acheteur. Bourama Traoré, à Ségou au
// Mali, s'est vu facturer 200 dinars ALGÉRIENS — une monnaie qu'il ne peut
// ni détenir ni virer depuis chez lui.
//
// Ces vérifications portent sur de l'argent réel. Une erreur ici ne casse
// pas un écran : elle facture le mauvais montant à quelqu'un.

let passees = 0;
const echecs = [];
const verifier = (ok, quoi) => { passees++; if (!ok) { echecs.push(quoi); console.error(`  ❌ ${quoi}`); } };

const d = require("../services/devises");

console.log("── Le pays de l'ACHETEUR décide, pas le vendeur ──");
{
    verifier(d.pourPays("MALI") === "XOF", "le Mali paie en francs CFA, pas en dinars algériens");
    verifier(d.pourPays("Algérie") === "DZD", "l'Algérie paie en dinars");
    verifier(d.pourPays("Cameroun") === "XAF", "le Cameroun paie en CFA d'Afrique centrale");
    verifier(d.pourPays("France") === "EUR", "la France paie en euros");

    // XOF et XAF valent le même nombre de francs pour un euro, mais ce sont
    // DEUX monnaies : on ne paie pas à Dakar avec des billets de Douala.
    verifier(d.pourPays("Senegal") !== d.pourPays("Gabon"),
        "Dakar et Libreville n'ont pas la même monnaie, même au même taux");
}

console.log("── Un accent ne doit pas coûter une devise ──");
{
    // Les formulaires envoient tout : majuscules, apostrophe courbe, code ISO.
    for (const forme of ["Côte d’Ivoire", "COTE D IVOIRE", "cote d'ivoire", "ci", "Ivory Coast"]) {
        verifier(d.pourPays(forme) === "XOF", `« ${forme} » doit mener au franc CFA`);
    }
    verifier(d.pourPays("algeria") === "DZD", "le nom anglais fonctionne aussi");
}

console.log("── Le repli est le DOLLAR, jamais le dinar ──");
{
    // « Dans le pire des cas en dollar. » Un pays inconnu ne doit surtout
    // pas hériter du dinar algérien, qui était la valeur par défaut.
    for (const inconnu of ["Zimbabwe", "", null, undefined, "   ", "Pays Imaginaire"]) {
        verifier(d.pourPays(inconnu) === "USD", `« ${inconnu} » retombe sur le dollar`);
    }
    verifier(d.pourPays("Zimbabwe") !== "DZD", "et JAMAIS sur le dinar algérien");
}

console.log("── La parité du franc CFA est FIXE ──");
{
    // 1 € = 655,957 francs, exactement, depuis 1999. Ce n'est pas un taux de
    // marché : il ne bouge pas et n'a pas à être rafraîchi.
    const xof = d.convertir(1, "EUR", "XOF");
    const xaf = d.convertir(1, "EUR", "XAF");
    verifier(xof.ok && Math.abs(xof.montant - 655.957) <= 1, `1 EUR = ${xof.montant} XOF (attendu 656)`);
    verifier(xaf.ok && Math.abs(xaf.montant - 655.957) <= 1, `1 EUR = ${xaf.montant} XAF`);

    // Aller-retour : convertir puis revenir doit retomber sur ses pieds.
    const aller = d.convertir(10000, "XOF", "EUR");
    const retour = d.convertir(aller.montant, "EUR", "XOF");
    verifier(Math.abs(retour.montant - 10000) < 5, `aller-retour XOF→EUR→XOF : ${retour.montant} (attendu ~10000)`);
}

console.log("── Une conversion impossible REFUSE, elle n'invente pas ──");
{
    // Le défaut le plus dangereux du fichier d'origine : `depuisUSD` rend le
    // montant INCHANGÉ pour une devise inconnue. 100 dollars deviennent
    // « 100 » dans n'importe quelle monnaie, sans un mot. Sur de l'argent,
    // un chiffre plausible est pire qu'un refus.
    const inconnue = d.convertir(100, "DZD", "JPY");
    verifier(inconnue.ok === false, "une devise inconnue est REFUSÉE");
    verifier(/JPY/.test(inconnue.raison || ""), "et le motif la nomme : " + inconnue.raison);

    verifier(d.convertir("abc", "EUR", "XOF").ok === false, "un montant illisible est refusé");
    verifier(d.convertir(100, "", "XOF").ok === false, "une devise vide est refusée");
    verifier(d.convertir(100, "EUR", null).ok === false, "une cible absente est refusée");

    // Et surtout : le refus ne rend PAS de montant, donc rien ne peut être
    // facturé par accident.
    verifier(inconnue.montant === undefined, "un refus ne porte aucun montant facturable");
}

console.log("── Les monnaies sans centimes n'en affichent pas ──");
{
    // « 3 279,79 FCFA » annonce une précision qui n'existe pas au comptoir.
    for (const sans of ["XOF", "XAF", "DZD"]) {
        verifier(!/[.,]\d/.test(d.formater(4500.4, sans)), `${sans} s'affiche sans centimes : ${d.formater(4500.4, sans)}`);
        verifier(Number.isInteger(d.arrondir(4500.4, sans)), `${sans} s'arrondit à l'entier`);
    }
    verifier(/[.,]\d\d/.test(d.formater(12.5, "EUR")), `l'euro garde ses centimes : ${d.formater(12.5, "EUR")}`);
}

console.log("── Le cas réel : la commande de Bourama Traoré ──");
{
    // Un produit affiché 200 DZD, acheté depuis le Mali. Ce qu'il aurait dû
    // voir, au lieu de « 200 DZD ».
    const devise = d.pourPays("MALI");
    const r = d.convertir(200, "DZD", devise);
    verifier(devise === "XOF", "un acheteur malien paie en XOF");
    verifier(r.ok && r.montant > 0, `200 DZD → ${d.formater(r.montant, devise)}`);
    verifier(r.montant !== 200, "et le montant N'EST PAS recopié tel quel d'une monnaie à l'autre");
}

if (echecs.length) {
    console.error(`\n❌ devises : ${echecs.length} problème(s) sur ${passees} vérifications\n`);
    for (const e of echecs) console.error(`   • ${e}`);
    process.exit(1);
}
console.log(`\n✅ devises : ${passees} vérifications passées`);
