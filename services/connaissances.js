// ==========================================================================
// SAMII OS — BASE DE CONNAISSANCES PERMANENTE DU FONDATEUR
// ==========================================================================
// Miroir de brain/prompts/sovereign/tables.js (les 231 lois) mais pour du
// contenu propre au fondateur (PDF, image, texte qu'il a lui-même donné à
// SAMII) — chargé à chaque conversation "souverain", jamais reformulé,
// jamais oublié tant qu'il n'est pas désactivé.
const db = require("../services/db");

async function lister(userId) {
    if (!userId) return [];
    return await db.query(
        `SELECT id, titre, contenu_resume, fichier_url, fichier_nom, created_at
         FROM samii_connaissances WHERE user_id = $1 AND actif = true ORDER BY created_at DESC`,
        [userId]
    );
}

// Injecté tel quel dans le prompt — volontairement compact (titre + résumé
// seulement), le fichier original reste accessible via fichier_url mais
// n'est jamais rechargé à chaque message (coût en tokens).
async function texteAgrege(userId) {
    if (!userId) return "";
    const rows = await lister(userId);
    if (!rows.length) return "";
    return rows.map(r => `### ${r.titre}\n${r.contenu_resume}`).join("\n\n");
}

async function ajouter(userId, { titre, contenu_resume, fichier_url, fichier_nom }) {
    if (!userId || !contenu_resume) return null;
    const rows = await db.query(
        `INSERT INTO samii_connaissances (user_id, titre, contenu_resume, fichier_url, fichier_nom)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, titre, created_at`,
        [userId, (titre || "Sans titre").trim().slice(0, 200), contenu_resume.trim().slice(0, 8000), fichier_url || null, fichier_nom || null]
    );
    return rows[0];
}

// Désactive plutôt que supprime — cohérent avec le reste de la plateforme
// (archiver un projet, désactiver un connecteur...), garde une trace.
async function retirer(userId, id) {
    const rows = await db.query(
        `UPDATE samii_connaissances SET actif = false WHERE id = $1 AND user_id = $2 RETURNING id`,
        [id, userId]
    );
    return rows.length > 0;
}

module.exports = { lister, texteAgrege, ajouter, retirer };
