// ==========================================================================
// SAMII OS — PROJETS SAMII (à la Claude Projects)
// ==========================================================================
// Chaque projet est un fil de conversation isolé avec SAMII, séparé de la
// conversation générale et des autres projets — pratique pour un
// particulier qui veut avancer sur plusieurs choses ("Mon mariage",
// "Ouvrir ma boutique"...) sans que SAMII mélange les contextes.
const db = require("../services/db");

async function lister(userId) {
    if (!userId) return [];
    return await db.query(
        `SELECT id, nom, updated_at FROM projets_samii
         WHERE user_id = $1 AND archive = false
         ORDER BY updated_at DESC`,
        [userId]
    );
}

async function creer(userId, nom) {
    const rows = await db.query(
        `INSERT INTO projets_samii (user_id, nom) VALUES ($1, $2) RETURNING id, nom, updated_at`,
        [userId, (nom || "Projet sans nom").trim().slice(0, 120)]
    );
    return rows[0];
}

// Vérifie que ce projet appartient bien à cet utilisateur avant de le
// laisser lire/écrire dedans — un ID de projet ne suffit jamais seul.
async function appartientA(userId, projetId) {
    if (!userId || !projetId) return false;
    const rows = await db.query(
        `SELECT id FROM projets_samii WHERE id = $1 AND user_id = $2 AND archive = false`,
        [projetId, userId]
    );
    return rows.length > 0;
}

async function toucher(projetId) {
    await db.query(`UPDATE projets_samii SET updated_at = now() WHERE id = $1`, [projetId]);
}

async function archiver(userId, projetId) {
    const rows = await db.query(
        `UPDATE projets_samii SET archive = true WHERE id = $1 AND user_id = $2 RETURNING id`,
        [projetId, userId]
    );
    return rows.length > 0;
}

module.exports = { lister, creer, appartientA, toucher, archiver };
