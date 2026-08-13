// ==========================================================================
// SAMII OS — VÉRIFICATION D'IDENTITÉ
// ==========================================================================
// Gate de confiance pour les activités à risque physique/financier réel :
// livreurs (accès aux adresses clients + argent liquide) et location de
// chambres (accueil de clients chez soi). Statuts : non_soumis → en_attente
// (après upload) → verifie / refuse (décision admin, jamais automatique).
const db = require("../services/db");

async function getStatut(userId) {
    const rows = await db.query(
        `SELECT verification_statut, verification_document_url, verification_note_admin
         FROM utilisateurs WHERE id = $1`,
        [userId]
    );
    return rows[0] || null;
}

function estVerifie(statutRow) {
    return statutRow?.verification_statut === "verifie";
}

async function soumettre(userId, documentUrl) {
    await db.query(
        `UPDATE utilisateurs SET
            verification_statut = 'en_attente',
            verification_document_url = $1,
            verification_soumis_le = now(),
            verification_note_admin = NULL
         WHERE id = $2`,
        [documentUrl, userId]
    );
}

async function approuver(userId) {
    const rows = await db.query(
        `UPDATE utilisateurs SET verification_statut = 'verifie', verification_traite_le = now()
         WHERE id = $1 AND verification_statut = 'en_attente' RETURNING id`,
        [userId]
    );
    return rows.length > 0;
}

async function refuser(userId, note) {
    const rows = await db.query(
        `UPDATE utilisateurs SET verification_statut = 'refuse', verification_traite_le = now(), verification_note_admin = $1
         WHERE id = $2 AND verification_statut = 'en_attente' RETURNING id`,
        [note || "", userId]
    );
    return rows.length > 0;
}

module.exports = { getStatut, estVerifie, soumettre, approuver, refuser };
