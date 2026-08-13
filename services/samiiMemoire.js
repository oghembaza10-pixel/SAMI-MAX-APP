// ==========================================================================
// SAMII OS — MÉMOIRE DE CONVERSATION SAMII (table samii_conversations)
// ==========================================================================
// Source unique pour tout ce qui fait vivre SAMII "en tant que client"
// (widget Hub, page /samii, Academy...) — partagée entre ces surfaces pour
// que ce soit le même SAMII, avec les mêmes souvenirs, peu importe l'écran
// utilisé. Toujours complète (150 derniers messages) quel que soit le
// palier d'abonnement — voir services/samiiQuota.js pour la limite de
// volume, qui est le seul axe qui diffère entre gratuit et payant.
//
// projetId (optionnel) sépare la mémoire par "Projet" (à la Claude
// Projects) — chaque projet a son propre fil, complètement étanche des
// autres et de la conversation générale (projet_id NULL).
const db = require("../services/db");

async function getHistorique(userId, projetId = null) {
    if (!userId) return [];
    try {
        const rows = projetId
            ? await db.query(
                `SELECT role, contenu AS message FROM samii_conversations
                 WHERE user_id = $1 AND projet_id = $2
                 ORDER BY created_at DESC LIMIT 150`,
                [userId, projetId]
              )
            : await db.query(
                `SELECT role, contenu AS message FROM samii_conversations
                 WHERE user_id = $1 AND projet_id IS NULL
                 ORDER BY created_at DESC LIMIT 150`,
                [userId]
              );
        return rows.reverse();
    } catch (err) {
        console.error("❌ samiiMemoire.getHistorique :", err.message);
        return [];
    }
}

async function enregistrerTour(userId, message, reply, source = "web", projetId = null) {
    if (!userId) return;
    try {
        await db.query(
            `INSERT INTO samii_conversations (user_id, role, contenu, source, projet_id) VALUES ($1,'user',$2,$4,$5), ($1,'model',$3,$4,$5)`,
            [userId, message, reply || "", source, projetId]
        );
    } catch (err) {
        console.error("❌ samiiMemoire.enregistrerTour :", err.message);
    }
}

module.exports = { getHistorique, enregistrerTour };
