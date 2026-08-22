// ==========================================================================
// SAMII OS — JOURNAL — écriture centralisée, jamais bloquante
// Un seul point d'écriture pour la table `journal`, pour deux raisons :
// 1) éviter de dupliquer la logique de secours dans chaque appelant si les
//    colonnes montant/ref_id n'existent pas encore en base (migration pas
//    encore lancée sur cet environnement — voir scripts/alter-journal.js) ;
// 2) une écriture de journal ne doit jamais faire planter l'action métier
//    qu'elle accompagne (créer une commande, confirmer un paiement...).
// ==========================================================================
const db = require("./db");

let colonnesEtenduesDisponibles = true;

// action, details, workspaceId : toujours écrits. montant/refId/userId :
// optionnels, écrits seulement si les colonnes existent (repli auto sinon).
async function log({ action, details = "", workspaceId = null, userId = null, montant = null, refId = null }) {
    if (colonnesEtenduesDisponibles) {
        try {
            await db.query(
                `INSERT INTO journal (action, details, workspace_id, user_id, montant, ref_id) VALUES ($1, $2, $3, $4, $5, $6)`,
                [action, details, workspaceId, userId, montant, refId]
            );
            return;
        } catch (err) {
            // 42703 = colonne inexistante (Postgres) : migration pas encore
            // appliquée sur cet environnement. On bascule en mode compatible
            // pour le reste du process, sans jamais faire échouer l'appelant.
            if (err.code === "42703") {
                colonnesEtenduesDisponibles = false;
                console.warn("⚠️ journal.montant/ref_id absents en base — lance `node scripts/alter-journal.js`. Écriture en mode compatible en attendant.");
            } else {
                console.error("❌ journalService.log :", err.message);
                return;
            }
        }
    }

    try {
        await db.query(
            `INSERT INTO journal (action, details, workspace_id, user_id) VALUES ($1, $2, $3, $4)`,
            [action, details, workspaceId, userId]
        );
    } catch (err) {
        console.error("❌ journalService.log (mode compatible) :", err.message);
    }
}

module.exports = { log };
