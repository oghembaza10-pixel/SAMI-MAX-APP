// ==========================================================================
// SAMII OS — ABONNEMENTS — activation/désactivation de palier, partagée
// entre le webhook Stripe, la confirmation Chargily et le rappel de
// renouvellement (engines/abonnementEngine.js). Un seul endroit qui sait
// ce que "passer au palier standard/pro" veut dire concrètement.
// ==========================================================================
const db = require("./db");
const journalService = require("./journalService");
const workspaceService = require("./workspaceService");

const PLAN_GRANTS = {
    standard: { forteresse: 1, boost: 0 },
    pro      : { forteresse: 2, boost: 1 },
};

const DUREE_JOURS = 30;

async function activerPalier(workspaceId, plan) {
    const workspace = await workspaceService.getById(workspaceId);
    if (!workspace) return false;

    const grant = PLAN_GRANTS[plan] || { forteresse: 0, boost: 0 };
    const currentCoffre = workspace.coffre || {};

    await workspaceService.update(workspace.recordId, {
        coffre: JSON.stringify({
            forteresse: {
                charges: (currentCoffre.forteresse?.charges || 0) + grant.forteresse,
                activeUntil: currentCoffre.forteresse?.activeUntil || null,
            },
            boost: {
                charges: (currentCoffre.boost?.charges || 0) + grant.boost,
                activeUntil: currentCoffre.boost?.activeUntil || null,
            },
        }),
        samii: JSON.stringify({ ...workspace.samii, plan }),
    });
    await db.query(`UPDATE workspaces SET palier_abonnement = $1 WHERE id = $2`, [plan, workspace.recordId]);

    return true;
}

async function retrograderVersFree(workspaceId) {
    await db.query(`UPDATE workspaces SET palier_abonnement = 'free' WHERE id = $1`, [workspaceId]);
    await journalService.log({ action: "abonnement.expire", details: "Palier repassé à free (pas de renouvellement dans le délai de grâce)", workspaceId });
}

module.exports = { activerPalier, retrograderVersFree, PLAN_GRANTS, DUREE_JOURS };
