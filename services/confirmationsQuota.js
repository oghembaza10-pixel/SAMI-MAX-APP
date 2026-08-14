// ==========================================================================
// SAMII OS — QUOTA DE CONFIRMATIONS & SUIVI (seuil journalier, par workspace)
// ==========================================================================
// Jamais bloquant — le seuil (gratuit=5/j, actif=70/j, souverain=1000/j,
// société=illimité) ne sert qu'à déclencher un dépassement facturable à
// 0,12$/confirmation, qui s'accumule sur le mois (workspaces.
// confirmations_depassement_mois) puisque Chargily/CCP n'ont aucun
// prélèvement automatique — voir engines/abonnementEngine.js pour les
// paliers payants, et genererLienRegularisation() ci-dessous pour le
// palier gratuit (aucun cycle de renouvellement auquel accrocher la dette).
const db = require("../services/db");
const chargily = require("../services/chargily");
const devises = require("../services/devises");

const QUOTA_PAR_PALIER = { free: 5, standard: 70, pro: 1000 };
const PRIX_DEPASSEMENT_USD = 0.12;

async function getPalierWorkspace(workspaceId) {
    if (!workspaceId) return "free";
    try {
        const rows = await db.query(`SELECT palier_abonnement FROM workspaces WHERE id = $1`, [workspaceId]);
        return rows[0]?.palier_abonnement || "free";
    } catch {
        return "free";
    }
}

async function compterConfirmationsJour(workspaceId) {
    if (!workspaceId) return 0;
    try {
        const rows = await db.query(
            `SELECT COUNT(*)::int AS n FROM commandes WHERE workspace_id = $1 AND confirme_le >= date_trunc('day', now())`,
            [workspaceId]
        );
        return rows[0]?.n || 0;
    } catch {
        return 0;
    }
}

// Appelé juste après avoir posé confirme_le sur une commande (routes/telegram.js,
// routes/api.js, engines/commerceEngine.js, engines/crmEngine.js) — si ça fait
// dépasser le seuil du jour, incrémente l'ardoise du mois. Jamais de blocage.
async function enregistrerSiDepassement(workspaceId) {
    if (!workspaceId) return;
    try {
        const palier = await getPalierWorkspace(workspaceId);
        if (palier === "societe") return;
        const total = QUOTA_PAR_PALIER[palier] ?? QUOTA_PAR_PALIER.free;
        const utilisesAujourdhui = await compterConfirmationsJour(workspaceId);
        if (utilisesAujourdhui <= total) return;

        await db.query(
            `UPDATE workspaces SET
                confirmations_depassement_mois = CASE
                    WHEN confirmations_depassement_reset_le IS NULL OR confirmations_depassement_reset_le < date_trunc('month', now())
                    THEN 1 ELSE confirmations_depassement_mois + 1
                END,
                confirmations_depassement_reset_le = now()
             WHERE id = $1`,
            [workspaceId]
        );
    } catch (err) {
        console.warn("⚠️ enregistrerSiDepassement (confirmations) :", err.message);
    }
}

async function getDepassementMois(workspaceId) {
    if (!workspaceId) return { count: 0, montantDu: 0 };
    try {
        const rows = await db.query(
            `SELECT confirmations_depassement_mois, confirmations_depassement_reset_le FROM workspaces WHERE id = $1`,
            [workspaceId]
        );
        const w = rows[0];
        const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
        if (!w?.confirmations_depassement_reset_le || new Date(w.confirmations_depassement_reset_le) < debutMois) {
            return { count: 0, montantDu: 0 };
        }
        const count = w.confirmations_depassement_mois || 0;
        return { count, montantDu: Math.round(count * PRIX_DEPASSEMENT_USD * 100) / 100 };
    } catch {
        return { count: 0, montantDu: 0 };
    }
}

// Compat : signature attendue par engines/abonnementEngine.js (ajoute le
// dépassement au prochain renouvellement Chargily des paliers payants).
async function getEtatQuota(workspaceId, palier) {
    if (palier === "societe") return { illimite: true, depassement: 0, montantDu: 0 };
    const dep = await getDepassementMois(workspaceId);
    return { illimite: false, depassement: dep.count, montantDu: dep.montantDu };
}

// Chiffre "par mois" affiché sur /billing (l'unité réellement vérifiée est
// journalière — voir QUOTA_PAR_PALIER — mais la page parle en mois).
function quotaMensuelAffiche(palier) {
    return (QUOTA_PAR_PALIER[palier] ?? QUOTA_PAR_PALIER.free) * 30;
}

// Palier gratuit : aucun cycle de renouvellement Chargily auquel accrocher
// la dette (voir abonnementEngine.js, réservé aux paliers payants) — un
// lien de paiement à part est généré à la demande pour régulariser.
async function genererLienRegularisation(workspaceId) {
    const dep = await getDepassementMois(workspaceId);
    if (!dep.montantDu) return null;
    const montantDzd = Math.round(devises.depuisUSD(dep.montantDu, "DZD"));
    const checkout = await chargily.createCheckout({
        amount: montantDzd,
        currency: "dzd",
        description: `SAMII — Régularisation ${dep.count} confirmation(s) au-delà du quota gratuit`,
        successUrl: `${require("../config").APP_URL}/billing?achat=ok`,
        failureUrl: `${require("../config").APP_URL}/billing?achat=echec`,
        webhookUrl: `${require("../config").APP_URL}/webhook/chargily`,
        metadata: { type: "regularisation_confirmations", workspace_id: workspaceId },
    });
    return checkout.success ? checkout.checkoutUrl : null;
}

module.exports = {
    QUOTA_PAR_PALIER, PRIX_DEPASSEMENT_USD,
    getPalierWorkspace, compterConfirmationsJour, enregistrerSiDepassement,
    getDepassementMois, getEtatQuota, quotaMensuelAffiche, genererLienRegularisation,
};
