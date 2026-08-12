// ==========================================================================
// SAMII OS — CATALOGUE DES CARTES (outils/moteurs stratégiques débloquables)
// Chaque carte = un outil déjà construit (routes/*.js). Débloquée par palier
// d'abonnement, par grade (progression gratuite), ou achetée à l'unité.
// ==========================================================================

// Mêmes paliers que routes/billing.js — ordre croissant.
const PALIERS = ["free", "standard", "pro", "societe"];

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

const CARTES = [
    // ── Débloquées dès le palier Gratuit ──────────────────────────────
    { id: "samii-mode",      nom: "Modes de SAMII",        icone: "🎭", description: "Ombre, Copilote, Stratège, Autonome, Souverain — le niveau d'autonomie de SAMII.", route: "/samii-mode", palier: "free",     gradeMin: "Soldat",     prix: null },
    { id: "messagereclair",  nom: "Messager Éclair",       icone: "📦", description: "Suivi de colis et notifications client automatiques.",                          route: "/messagereclair", palier: "free",  gradeMin: "Soldat",     prix: null },
    { id: "missions",        nom: "Missions",              icone: "🎯", description: "Liste de tâches concrètes générées par SAMII pour faire avancer ton activité.", route: "/missions",  palier: "free",     gradeMin: "Soldat",     prix: null },
    { id: "coffre",          nom: "Le Coffre OG",          icone: "🗝️", description: "Objets consommables : Forteresse, Boost.",                                      route: "/coffre",    palier: "free",     gradeMin: "Soldat",     prix: null },

    // ── Débloquées au palier Actif ($9.99) ────────────────────────────
    { id: "automatisations", nom: "Automatisations",       icone: "⚙️", description: "Tableau de pilotage : active/désactive les automatisations SAMII en un clic.", route: "/automatisations", palier: "standard", gradeMin: "Caporal",  prix: 2.99 },
    { id: "diplomate",       nom: "Diplomate",              icone: "🕊️", description: "SAMII rédige 3 propositions de réponse pour chaque message client.",         route: "/diplomate",  palier: "standard", gradeMin: "Caporal",  prix: 2.99 },
    { id: "memoireclient",   nom: "Mémoire Client",         icone: "🧠", description: "Historique relationnel enrichi — SAMII se souvient de chaque client.",       route: "/memoireclient", palier: "standard", gradeMin: "Caporal", prix: 2.99 },
    { id: "griot",           nom: "Griot",                  icone: "🎬", description: "Storytelling automatique + pack de contenu vidéo marketing (généré par IA).", route: "/griot",     palier: "standard", gradeMin: "Sergent",  prix: 3.49 },
    { id: "topproduits",     nom: "Top Produits",           icone: "📈", description: "Top 5 produits du moment + Top 5 à venir, par marché.",                       route: "/topproduits", palier: "standard", gradeMin: "Caporal",  prix: 2.99 },

    // ── Débloquées au palier Souverain ($39.99) ───────────────────────
    { id: "oeilconcurrentiel", nom: "Œil Concurrentiel",   icone: "👁️", description: "Prix marché en temps réel + veille fournisseurs.",                            route: "/oeilconcurrentiel", palier: "pro", gradeMin: "Lieutenant", prix: 3.49 },
    { id: "opportunites",    nom: "Radar Opportunités",    icone: "📡", description: "Détecte les opportunités de marché via recherche web réelle.",              route: "/opportunites", palier: "pro", gradeMin: "Lieutenant", prix: 3.49 },
    { id: "oraclefinancier", nom: "Oracle Financier",      icone: "🔮", description: "Prévisions de revenus basées sur ton activité réelle.",                       route: "/oraclefinancier", palier: "pro", gradeMin: "Capitaine", prix: 3.49 },
    { id: "miroir",          nom: "Miroir",                icone: "🪞", description: "Auto-diagnostic complet de ton activité, points forts et faibles.",           route: "/miroir",     palier: "pro", gradeMin: "Lieutenant", prix: 3.49 },
    { id: "chasseurstock",   nom: "Chasseur de Stock",     icone: "🏹", description: "Trouve des fournisseurs mondiaux pour ton stock.",                            route: "/chasseurstock", palier: "pro", gradeMin: "Capitaine", prix: 3.49 },
    { id: "arsenal",         nom: "Arsenal",               icone: "⚔️", description: "Ta boîte à outils marketing avancée.",                                          route: "/arsenal",   palier: "pro", gradeMin: "Lieutenant", prix: 3.49 },
];

// Une carte est débloquée si : le palier du workspace la couvre déjà, OU le
// grade du client a atteint le seuil requis (progression gratuite), OU elle
// a été achetée à l'unité (cartesAcheteesIds).
function carteEstDebloquee(carte, { palierWorkspace, gradeClient, cartesAcheteesIds = [] } = {}) {
    if (palierIndex(palierWorkspace) >= palierIndex(carte.palier)) return true;
    if (gradeIndex(gradeClient) >= gradeIndex(carte.gradeMin)) return true;
    if (cartesAcheteesIds.includes(carte.id)) return true;
    return false;
}

module.exports = { CARTES, PALIERS, GRADES, palierIndex, gradeIndex, carteEstDebloquee };
