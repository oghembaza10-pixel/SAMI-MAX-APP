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

// Renvoie l'id de la ligne 'model' insérée (jamais celui de 'user') — sert
// à attacher un feedback 👍/👎 à cette réponse précise (voir setFeedback).
async function enregistrerTour(userId, message, reply, source = "web", projetId = null) {
    if (!userId) return null;
    try {
        const rows = await db.query(
            `INSERT INTO samii_conversations (user_id, role, contenu, source, projet_id) VALUES ($1,'user',$2,$4,$5), ($1,'model',$3,$4,$5) RETURNING id, role`,
            [userId, message, reply || "", source, projetId]
        );
        return rows.find(r => r.role === "model")?.id || null;
    } catch (err) {
        console.error("❌ samiiMemoire.enregistrerTour :", err.message);
        return null;
    }
}

// N'autorise à noter que ses propres messages (WHERE user_id = $3) — un
// utilisateur ne peut jamais modifier le feedback d'un autre.
async function setFeedback(messageId, userId, feedback) {
    if (!["up", "down"].includes(feedback)) return false;
    try {
        const rows = await db.query(
            `UPDATE samii_conversations SET feedback = $1 WHERE id = $2 AND user_id = $3 AND role = 'model' RETURNING id`,
            [feedback, messageId, userId]
        );
        return rows.length > 0;
    } catch (err) {
        console.error("❌ samiiMemoire.setFeedback :", err.message);
        return false;
    }
}

// ══════════════════════════════════════════════════════════════════════
// LE PONT : CE QUI A ÉTÉ DIT AVANT LE COMPTE APPARTIENT À LA PERSONNE
// ══════════════════════════════════════════════════════════════════════
//
// LE PROBLÈME, TEL QU'IL SE VIVAIT.
//
// Quelqu'un arrive sur la page d'accueil, raconte son commerce à SAMII
// pendant dix messages, se décide, crée son compte — et SAMII ne sait plus
// qui il est. Il redemande tout. C'est le pire moment possible pour paraître
// amnésique : celui où la personne vient d'accorder sa confiance.
//
// CE QUI EXISTAIT DÉJÀ, ET QU'IL SUFFISAIT DE RELIER.
//
// Le chat public écrit DÉJÀ ces échanges dans `samii_conversations` — la
// même table, la même forme, la même colonne — sous la clé
// « anon:<identifiant de session> » (voir routes/vitrine.js). Rien n'était
// perdu : personne n'allait le chercher.
//
// Rattacher, c'est donc une seule requête : changer la clé. Aucune copie,
// aucune seconde table, aucun format de transfert.
//
// ── POURQUOI ON NE RATTACHE QUE SA PROPRE SESSION ────────────────────────
//
// L'identifiant de session vient du cookie de la personne, jamais du corps
// de la requête. Accepter un identifiant fourni de l'extérieur reviendrait à
// dire « donne-moi la conversation de ce visiteur-là » — on s'approprierait
// l'historique de quelqu'un d'autre en une ligne de console.
async function rattacherConversationAnonyme(sessionID, userId) {
    if (!sessionID || !userId) return { rattachees: 0 };
    const ref = String(sessionID).slice(0, 64);
    try {
        // On efface `session_ref` en même temps : ces messages appartiennent
        // désormais à quelqu'un, et les laisser marqués « visiteur » les
        // ferait réclamer une seconde fois par la prochaine session portant
        // le même identifiant.
        const rows = await db.query(
            `UPDATE samii_conversations
                SET user_id = $1, session_ref = NULL
              WHERE session_ref = $2 AND user_id IS NULL
          RETURNING id`,
            [String(userId), ref],
        );
        if (rows.length) {
            console.log(`🔗 ${rows.length} message(s) de la vitrine rattaché(s) au compte ${userId}`);
        }
        return { rattachees: rows.length };
    } catch (err) {
        // Un rattachement raté ne doit JAMAIS empêcher quelqu'un de se
        // connecter ou de créer son compte. Il perdra le fil de sa
        // conversation d'avant — c'est dommage, ce n'est pas bloquant.
        console.error("❌ rattacherConversationAnonyme :", err.message);
        return { rattachees: 0, erreur: err.message };
    }
}

module.exports = { getHistorique, enregistrerTour, setFeedback, rattacherConversationAnonyme };
