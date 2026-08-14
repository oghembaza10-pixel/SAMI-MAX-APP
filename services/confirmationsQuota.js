// ==========================================================================
// SAMII OS — QUOTA DE CONFIRMATIONS & SUIVI (par workspace, par mois calendaire)
// ==========================================================================
// Chargily/CCP n'ont aucun prélèvement automatique possible (voir
// engines/abonnementEngine.js) — donc pas de "débit en temps réel" par
// confirmation en trop. Le dépassement s'accumule et est ajouté au prochain
// lien de paiement de renouvellement (voir genererLienRenouvellement).
const db = require("../services/db");

const QUOTA_PAR_PALIER = { free: 100, standard: 1000, pro: 10000 };
const PRIX_DEPASSEMENT_USD = 0.12;

async function compterConfirmationsMois(workspaceId) {
    if (!workspaceId) return 0;
    try {
        const rows = await db.query(
            `SELECT COUNT(*)::int AS n FROM commandes
             WHERE workspace_id = $1 AND confirme_le >= date_trunc('month', now())`,
            [workspaceId]
        );
        return rows[0]?.n || 0;
    } catch {
        return 0;
    }
}

async function getEtatQuota(workspaceId, palier) {
    if (palier === "societe") {
        return { illimite: true, total: null, utilises: 0, restant: null, depassement: 0, montantDu: 0 };
    }
    const total = QUOTA_PAR_PALIER[palier] || QUOTA_PAR_PALIER.free;
    const utilises = await compterConfirmationsMois(workspaceId);
    const depassement = Math.max(0, utilises - total);
    return {
        illimite: false,
        total,
        utilises,
        restant: Math.max(0, total - utilises),
        depassement,
        // Gratuit : jamais facturé (pas de moyen de paiement enregistré) —
        // le dépassement n'a de sens à monétiser que sur un palier payant.
        montantDu: palier && palier !== "free" ? Math.round(depassement * PRIX_DEPASSEMENT_USD * 100) / 100 : 0,
    };
}

module.exports = { QUOTA_PAR_PALIER, PRIX_DEPASSEMENT_USD, compterConfirmationsMois, getEtatQuota };
