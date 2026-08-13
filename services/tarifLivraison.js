// ==========================================================================
// SAMII OS — TARIF LIVRAISON — Payé par le client, pas le marchand
// ==========================================================================
// Formule "base + prix au km", comme les apps de livraison locales
// (Yassir Express et équivalents). Ces montants sont des valeurs de départ
// raisonnables, pas des tarifs réels scrapés — à ajuster ici si besoin,
// c'est le seul endroit où ils sont définis.
const BASE_DA = 100;       // frais de base, quelle que soit la distance
const PRIX_PAR_KM_DA = 30; // au-delà du 1er km inclus dans la base
const KM_INCLUS = 1;
const DEVISE = "DZD";

function calculerPrix(distanceKm) {
    if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) return null;
    const kmFacturables = Math.max(0, distanceKm - KM_INCLUS);
    const prix = BASE_DA + kmFacturables * PRIX_PAR_KM_DA;
    return Math.round(prix / 5) * 5; // arrondi au 5 DA le plus proche, plus lisible qu'un prix à virgule
}

module.exports = { calculerPrix, BASE_DA, PRIX_PAR_KM_DA, KM_INCLUS, DEVISE };
