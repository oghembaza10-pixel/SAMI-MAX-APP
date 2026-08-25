// ==========================================================================
// SAMII OS — ABONNEMENTS — activation/désactivation de palier, partagée
// entre le webhook Stripe, la confirmation Chargily et le rappel de
// renouvellement (engines/abonnementEngine.js). Un seul endroit qui sait
// ce que "passer au palier standard/pro" veut dire concrètement.
// ==========================================================================
const db = require("./db");
const journalService = require("./journalService");
const workspaceService = require("./workspaceService");
const paliers = require("../config/paliers");

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

// Le palier réellement actif d'un espace. En cas de doute (espace inconnu,
// base injoignable) on renvoie "free" : une erreur technique ne doit jamais
// ouvrir une fonctionnalité payante, elle doit la fermer.
async function getPalier(workspaceId) {
    if (!workspaceId) return "free";
    try {
        const rows = await db.query(`SELECT palier_abonnement FROM workspaces WHERE id = $1`, [workspaceId]);
        return rows[0]?.palier_abonnement || "free";
    } catch {
        return "free";
    }
}

// Vrai si l'espace atteint au moins ce palier. C'est le seul contrôle à
// utiliser pour ouvrir une fonctionnalité annoncée comme payante sur la page
// d'accueil — sinon la page promet un palier et le produit en donne un autre.
async function auMoins(workspaceId, minimum) {
    return paliers.rang(await getPalier(workspaceId)) >= paliers.rang(minimum);
}

module.exports = { activerPalier, retrograderVersFree, getPalier, auMoins, PLAN_GRANTS, DUREE_JOURS };
