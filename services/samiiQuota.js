// ==========================================================================
// SAMII OS — QUOTA DE MESSAGES (chat in-app /api/chat)
// ==========================================================================
// La mémoire de conversation (samii_conversations) ne doit JAMAIS être
// coupée selon l'abonnement — un client gratuit qui revient demain doit
// retrouver SAMII qui se souvient de tout, sinon il n'a aucune raison de
// croire qu'un abonnement payant vaut le coup. Le vrai levier commercial,
// c'est le volume de messages autorisés par jour, pas la mémoire.
const db = require("../services/db");

const QUOTA_GRATUIT_PAR_JOUR = 30;

async function getAbonnement(userId) {
    if (!userId) return "gratuit";
    try {
        const rows = await db.query(`SELECT abonnement FROM utilisateurs WHERE id = $1`, [userId]);
        return rows[0]?.abonnement || "gratuit";
    } catch {
        return "gratuit";
    }
}

async function compterMessagesAujourdhui(userId) {
    try {
        const rows = await db.query(
            `SELECT count(*)::int AS n FROM samii_conversations
             WHERE user_id = $1 AND role = 'user' AND created_at > now() - interval '24 hours'`,
            [userId]
        );
        return rows[0]?.n || 0;
    } catch {
        return 0;
    }
}

// Retourne l'état du quota pour ce client — utilisé à la fois pour bloquer
// l'envoi côté /api/chat et pour l'afficher côté /client-qg/quota.
async function getEtatQuota(userId) {
    if (!userId) return { illimite: true, restant: null, total: null, utilises: 0 };

    const abonnement = await getAbonnement(userId);
    if (abonnement !== "gratuit") {
        return { illimite: true, restant: null, total: null, utilises: 0 };
    }

    const utilises = await compterMessagesAujourdhui(userId);
    return {
        illimite: false,
        total: QUOTA_GRATUIT_PAR_JOUR,
        utilises,
        restant: Math.max(0, QUOTA_GRATUIT_PAR_JOUR - utilises),
    };
}

module.exports = { QUOTA_GRATUIT_PAR_JOUR, getAbonnement, compterMessagesAujourdhui, getEtatQuota };
