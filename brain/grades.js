// ==========================================================================
// SAMII OS — GRADES (T-XX) — Moteur de progression universel
// Marchand et Client partagent la même échelle, calculs séparés.
// Formule pure, PAS d'appel Gemini — économise le quota.
// ==========================================================================

// ── ÉCHELLE COMMUNE (x10 approximatif à chaque palier) ────────
const GRADES = [
    { nom: "Soldat",     icon: "🪖",  seuil: 0     },
    { nom: "Caporal",    icon: "🎖️", seuil: 50    },
    { nom: "Sergent",    icon: "⭐",  seuil: 500   },
    { nom: "Lieutenant", icon: "🌟",  seuil: 2000  },
    { nom: "Capitaine",  icon: "🏅",  seuil: 5000  },
    { nom: "Général",    icon: "🎗️", seuil: 20000 },
];

function trouverGrade(score) {
    let actuel = GRADES[0];
    let suivant = GRADES[1] || null;
    for (let i = 0; i < GRADES.length; i++) {
        if (score >= GRADES[i].seuil) {
            actuel = GRADES[i];
            suivant = GRADES[i + 1] || null;
        }
    }
    let progression = 100;
    if (suivant) {
        progression = Math.min(
            Math.round(((score - actuel.seuil) / (suivant.seuil - actuel.seuil)) * 100),
            100
        );
    }
    return {
        nom: actuel.nom,
        icon: actuel.icon,
        score,
        prochainGrade: suivant?.nom || null,
        seuilProchain: suivant?.seuil || null,
        progression,
    };
}

// ── CALCUL MARCHAND ────────────────────────────────────────────
// Facteurs : volume de commandes + qualité (confirmation, avis).
// Score sur fenêtre glissante pour permettre de redescendre si la
// qualité chute (voir logique complète à affiner plus tard avec
// vraies données de commandes récentes).
function calculerScoreMarchand({ totalCommandes = 0, tauxConfirmation = 100, noteMoyenneAvis = 5 }) {
    let score = totalCommandes;

    // Pénalité si mauvais taux de confirmation (sous 70%)
    if (tauxConfirmation < 70) {
        score *= 0.7;
    }

    // Bonus si bons avis clients (note sur 5)
    if (noteMoyenneAvis >= 4.5) {
        score *= 1.15;
    } else if (noteMoyenneAvis < 3) {
        score *= 0.8;
    }

    return Math.round(score);
}

// ── CALCUL CLIENT ──────────────────────────────────────────────
function calculerScoreClient({
    tempsTotalMinutes = 0,
    nbParrainagesMarchand = 0,
    nbParrainagesClient = 0,
    nbAchats = 0,
    nbPostsValides = 0,
}) {
    const score =
        Math.floor(tempsTotalMinutes / 10) * 1 +
        nbParrainagesMarchand * 50 +
        nbParrainagesClient * 15 +
        nbAchats * 20 +
        nbPostsValides * 10;

    return Math.round(score);
}

// ── POINT D'ENTRÉE UNIQUE ──────────────────────────────────────
function calculerGrade(type, data) {
    let score;
    if (type === "marchand") {
        score = calculerScoreMarchand(data);
    } else if (type === "client") {
        score = calculerScoreClient(data);
    } else {
        throw new Error(`Type de profil inconnu pour le calcul de grade : ${type}`);
    }

    return trouverGrade(score);
}

module.exports = {
    GRADES,
    calculerGrade,
    calculerScoreMarchand,
    calculerScoreClient,
    trouverGrade,
};
