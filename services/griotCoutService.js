// ==========================================================================
// SAMII OS — COÛT DE GÉNÉRATION GRIOT (Runware, facturé au temps réel)
// ==========================================================================
// Contrairement aux quotas confirmations/messages (seuil + dépassement),
// chaque génération d'image/vidéo coûte directement 0,20$ par seconde de
// génération — pas de volume inclus gratuit. Toujours accumulé (jamais de
// débit en temps réel, Chargily/CCP ne le permettent pas) et ajouté au
// prochain renouvellement (engines/abonnementEngine.js), comme les autres
// dépassements.
const db = require("../services/db");

const PRIX_PAR_SECONDE_USD = 0.2;

async function enregistrerGeneration(workspaceId, dureeMs) {
    if (!workspaceId || !dureeMs) return;
    const cout = Math.round((dureeMs / 1000) * PRIX_PAR_SECONDE_USD * 100) / 100;
    if (!cout) return;
    try {
        await db.query(
            `UPDATE workspaces SET
                griot_generation_du_mois = CASE
                    WHEN griot_generation_reset_le IS NULL OR griot_generation_reset_le < date_trunc('month', now())
                    THEN $2 ELSE griot_generation_du_mois + $2
                END,
                griot_generation_reset_le = now()
             WHERE id = $1`,
            [workspaceId, cout]
        );
    } catch (err) {
        console.warn("⚠️ enregistrerGeneration (Griot) :", err.message);
    }
}

async function getCoutMois(workspaceId) {
    if (!workspaceId) return 0;
    try {
        const rows = await db.query(
            `SELECT griot_generation_du_mois, griot_generation_reset_le FROM workspaces WHERE id = $1`,
            [workspaceId]
        );
        const w = rows[0];
        const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
        if (!w?.griot_generation_reset_le || new Date(w.griot_generation_reset_le) < debutMois) return 0;
        return Number(w.griot_generation_du_mois) || 0;
    } catch {
        return 0;
    }
}

module.exports = { PRIX_PAR_SECONDE_USD, enregistrerGeneration, getCoutMois };
