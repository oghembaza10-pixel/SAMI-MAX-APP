// ==========================================================================
// SAMII OS — Grade Service
// Centralise l'attribution de points et le recalcul du grade utilisateur.
// Réutilise utilisateurs.score_grade / grade_actuel (déjà en base, jamais
// recalculés jusqu'ici — score_grade montait mais grade_actuel restait figé).
// ==========================================================================
const db = require("./db");
const journalService = require("./journalService");

// Mêmes seuils que ceux déjà affichés côté QG marchand (public/js/qg.js) —
// on les reprend ici pour que le grade soit enfin réellement stocké et pas
// juste recalculé côté client à partir du nombre de commandes.
const SEUILS = [
    { seuil: 0,   grade: "Soldat" },
    { seuil: 10,  grade: "Caporal" },
    { seuil: 25,  grade: "Sergent" },
    { seuil: 50,  grade: "Lieutenant" },
    { seuil: 100, grade: "Capitaine" },
    { seuil: 200, grade: "Général" },
];

function gradeForScore(score) {
    let actuel = SEUILS[0].grade;
    for (const s of SEUILS) {
        if (score >= s.seuil) actuel = s.grade;
    }
    return actuel;
}

// Thèmes visuels du QG — Stratège/Sagesse débloqués dès le départ (Soldat),
// Aventurier au 3ème grade (Sergent), Gaming au 4ème grade (Lieutenant).
// Mode OG (noir/or/gris métal, identité de la marque) débloqué pour tout
// le monde dès le départ — c'est l'identité de la plateforme, pas une
// récompense à gagner.
const THEMES = [
    { id: "strategiste", label: "Stratège",   emoji: "🪖", seuilIndex: 0 },
    { id: "sagesse",     label: "Sagesse",    emoji: "🕊️", seuilIndex: 0 },
    { id: "aventurier",  label: "Aventurier", emoji: "🧭", seuilIndex: 2 },
    { id: "gaming",      label: "Gaming",     emoji: "🎮", seuilIndex: 3 },
    { id: "og",          label: "Mode OG",    emoji: "👑", seuilIndex: 0 },
];

function themeEstDebloque(themeId, grade) {
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme) return false;
    const idxGrade = SEUILS.findIndex(s => s.grade === (grade || "Soldat"));
    return (idxGrade >= 0 ? idxGrade : 0) >= theme.seuilIndex;
}

function themesDebloques(grade) {
    return THEMES.filter(t => themeEstDebloque(t.id, grade)).map(t => t.id);
}

// ── Ajoute des points à un utilisateur (par id) et recalcule son grade ──
async function ajouterPoints(userId, points, raison) {
    if (!userId || !points) return null;

    try {
        const rows = await db.query(
            `UPDATE utilisateurs SET score_grade = COALESCE(score_grade,0) + $1 WHERE id = $2 RETURNING score_grade, grade_actuel`,
            [points, userId]
        );
        if (!rows[0]) return null;

        const nouveauScore = rows[0].score_grade;
        const ancienGrade = rows[0].grade_actuel || "Soldat";
        const nouveauGrade = gradeForScore(nouveauScore);

        if (nouveauGrade !== ancienGrade) {
            await db.query(`UPDATE utilisateurs SET grade_actuel = $1 WHERE id = $2`, [nouveauGrade, userId]);
        }

        if (raison) {
            journalService.log({ action: "grade.points", details: `user=${userId} +${points} — ${raison}` });
        }

        return { score: nouveauScore, grade: nouveauGrade, promu: nouveauGrade !== ancienGrade };
    } catch (err) {
        console.error("❌ gradeService.ajouterPoints :", err.message);
        return null;
    }
}

// ── Même chose, mais pour le marchand propriétaire d'un workspace ──
// (utile pour les événements qui n'ont qu'un workspace_id, ex: livraison)
async function ajouterPointsParWorkspace(workspaceId, points, raison) {
    if (!workspaceId) return null;

    try {
        const rows = await db.query(
            `SELECT u.id FROM utilisateurs u
             JOIN workspaces w ON w.owner_email = u.email
             WHERE w.id = $1 LIMIT 1`,
            [workspaceId]
        );
        if (!rows[0]) return null;
        return await ajouterPoints(rows[0].id, points, raison);
    } catch (err) {
        console.error("❌ gradeService.ajouterPointsParWorkspace :", err.message);
        return null;
    }
}

module.exports = {
    ajouterPoints,
    ajouterPointsParWorkspace,
    gradeForScore,
    SEUILS,
    THEMES,
    themeEstDebloque,
    themesDebloques,
};
