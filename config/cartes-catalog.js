// ==========================================================================
// SAMII OS — CATALOGUE DES CARTES (outils/moteurs stratégiques débloquables)
// Chaque carte = un outil déjà construit (routes/*.js). Débloquée par palier
// d'abonnement, par grade (progression gratuite), ou achetée à l'unité.
// ==========================================================================

// Les paliers et leur ordre viennent de config/paliers.js (source unique des
// quatre paliers et de leurs prix) — ici on n'a besoin que de l'ordre.
const { ORDRE: PALIERS } = require("./paliers");

function palierIndex(palier) {
    const i = PALIERS.indexOf(palier || "free");
    return i === -1 ? 0 : i;
}

// Mêmes grades que services/gradeService.js (index croissant = progression).
const GRADES = ["Soldat", "Caporal", "Sergent", "Lieutenant", "Capitaine", "Général"];

function gradeIndex(grade) {
    const i = GRADES.indexOf(grade || "Soldat");
    return i === -1 ? 0 : i;
}

// LES ADRESSES DOIVENT EXISTER. `route` est ce sur quoi le marchand clique,
// depuis /cartes comme depuis la vitrine de l'Académie. Onze d'entre elles
// pointaient à côté (/griot au lieu de /samii/griot, etc.) : un lien mort ne
// lève aucune erreur et n'apparaît dans aucun journal, il se contente de ne
// mener nulle part. tests/cartes.test.js vérifie désormais que chacune est
// réellement montée dans index.js — la seule façon que ça ne recommence pas.
//
// Achat à l'unité = accès temporaire, pas définitif (prix en EUR, converti en
// DZD au moment du paiement — voir CONFIG.CHARGILY.EUR_TO_DZD_RATE). Chaque
// carte a son propre prix et sa propre durée ; par défaut, les cartes plus
// coûteuses en ressources IA (Griot, Oracle Financier...) ont une fenêtre
// plus courte pour inciter à l'abonnement plutôt qu'à l'achat répété.
const CARTES = [
    // ── Débloquées dès le palier Gratuit ──────────────────────────────
    { id: "samii-mode",      nom: "Modes de SAMII",        icone: "🎭", description: "Ombre, Copilote, Stratège, Autonome, Souverain — le niveau d'autonomie de SAMII.", route: "/samii/mode", palier: "free",     gradeMin: "Soldat",     prix: null, dureeJours: null },
    { id: "messagereclair",  nom: "Messager Éclair",       icone: "📦", description: "Suivi de colis et notifications client automatiques.",                          route: "/samii/messager-eclair", palier: "free",  gradeMin: "Soldat",     prix: null, dureeJours: null },
    { id: "missions",        nom: "Missions",              icone: "🎯", description: "Liste de tâches concrètes générées par SAMII pour faire avancer ton activité.", route: "/missions",  palier: "free",     gradeMin: "Soldat",     prix: null, dureeJours: null },
    { id: "coffre",          nom: "Le Coffre OG",          icone: "🗝️", description: "Objets consommables : Forteresse, Boost.",                                      route: "/coffre",    palier: "free",     gradeMin: "Soldat",     prix: null, dureeJours: null },
    // Griot est ouvert dès le palier gratuit, volontairement : ses moteurs
    // gratuits (script, photo et vidéo réelles) ne nous coûtent rien et sont
    // la meilleure démonstration de ce que fait SAMII. Les créations par IA,
    // qui coûtent à la seconde, restent réservées aux paliers payants
    // (config/paliers.js → creationsIA, appliqué dans routes/griot.js).
    { id: "griot",           nom: "Griot",                  icone: "🎬", description: "Scripts, photos et vidéos pour tes publications — moteurs gratuits inclus.",  route: "/samii/griot",     palier: "free",     gradeMin: "Soldat",     prix: null, dureeJours: null },

    // ── Débloquées au palier Actif — achat à l'unité : 7 jours ──
    { id: "automatisations", nom: "Automatisations",       icone: "⚙️", description: "Tableau de pilotage : active/désactive les automatisations SAMII en un clic.", route: "/automatisations", palier: "standard", gradeMin: "Caporal",  prix: 2.99, dureeJours: 7 },
    { id: "diplomate",       nom: "Diplomate",              icone: "🕊️", description: "SAMII rédige 3 propositions de réponse pour chaque message client.",         route: "/samii/diplomate",  palier: "standard", gradeMin: "Caporal",  prix: 2.99, dureeJours: 7 },
    { id: "memoireclient",   nom: "Mémoire Client",         icone: "🧠", description: "Historique relationnel enrichi — SAMII se souvient de chaque client.",       route: "/samii/memoire-client", palier: "standard", gradeMin: "Caporal", prix: 2.99, dureeJours: 7 },
    { id: "topproduits",     nom: "Top Produits",           icone: "📈", description: "Top 5 produits du moment + Top 5 à venir, par marché.",                       route: "/samii/top-produits", palier: "standard", gradeMin: "Caporal",  prix: 2.99, dureeJours: 7 },

    // ── Débloquées au palier Souverain — achat à l'unité : 3 jours ──
    { id: "oeilconcurrentiel", nom: "Œil Concurrentiel",   icone: "👁️", description: "Prix marché en temps réel + veille fournisseurs.",                            route: "/samii/oeil-concurrentiel", palier: "pro", gradeMin: "Lieutenant", prix: 3.49, dureeJours: 3 },
    { id: "opportunites",    nom: "Radar Opportunités",    icone: "📡", description: "Détecte les opportunités de marché via recherche web réelle.",              route: "/samii/opportunites", palier: "pro", gradeMin: "Lieutenant", prix: 3.49, dureeJours: 3 },
    { id: "oraclefinancier", nom: "Oracle Financier",      icone: "🔮", description: "Prévisions de revenus basées sur ton activité réelle.",                       route: "/samii/oracle-financier", palier: "pro", gradeMin: "Capitaine", prix: 3.49, dureeJours: 3 },
    { id: "miroir",          nom: "Miroir",                icone: "🪞", description: "Auto-diagnostic complet de ton activité, points forts et faibles.",           route: "/samii/miroir",     palier: "pro", gradeMin: "Lieutenant", prix: 3.49, dureeJours: 3 },
    { id: "chasseurstock",   nom: "Chasseur de Stock",     icone: "🏹", description: "Trouve des fournisseurs mondiaux pour ton stock.",                            route: "/samii/chasseur-stock", palier: "pro", gradeMin: "Capitaine", prix: 3.49, dureeJours: 3 },
    { id: "arsenal",         nom: "Arsenal",               icone: "⚔️", description: "Ta boîte à outils marketing avancée.",                                          route: "/arsenal",   palier: "pro", gradeMin: "Lieutenant", prix: 3.49, dureeJours: 3 },
];

// Une carte est débloquée si : le palier du workspace la couvre déjà, OU le
// grade du client a atteint le seuil requis (progression gratuite — permanent),
// OU elle a été achetée à l'unité et son accès temporaire n'a pas expiré
// (cartesActivesIds : uniquement les achats dont expire_le > now(), filtré
// par l'appelant qui a accès à l'horloge de la base).
function carteEstDebloquee(carte, { palierWorkspace, gradeClient, cartesActivesIds = [] } = {}) {
    if (palierIndex(palierWorkspace) >= palierIndex(carte.palier)) return true;
    if (gradeIndex(gradeClient) >= gradeIndex(carte.gradeMin)) return true;
    if (cartesActivesIds.includes(carte.id)) return true;
    return false;
}

module.exports = { CARTES, PALIERS, GRADES, palierIndex, gradeIndex, carteEstDebloquee };
