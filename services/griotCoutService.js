// ==========================================================================
// SAMII OS — COÛT DE GÉNÉRATION GRIOT (facturé au temps réel, multi-moteur)
// ==========================================================================
// Contrairement aux quotas confirmations/messages (seuil + dépassement),
// chaque génération d'image/vidéo coûte directement un prix par seconde de
// génération — pas de volume inclus gratuit. Toujours accumulé (jamais de
// débit en temps réel, Chargily/CCP ne le permettent pas) et ajouté au
// prochain renouvellement (engines/abonnementEngine.js), comme les autres
// dépassements.
//
// Trois moteurs possibles (le client choisit sur /samii/griot selon son
// besoin) :
// - Runware : tarif client fixe déjà en place, inchangé.
// - WAN 2.6 (Alibaba, via OpenRouter) et H3 (MiniMax, via OpenRouter) :
//   nouveaux moteurs — prix client = 6x le prix payé au fournisseur
//   (OpenRouter), marge fixe demandée. Le prix H3 (0,13$/s) est confirmé
//   sur la page de tarification OpenRouter du modèle (minimax/hailuo-3) ;
//   le prix WAN (0,08$/s) est une estimation à confirmer sur la facture
//   OpenRouter réelle dès le premier appel — à ajuster ici si différent.
const db = require("../services/db");

const PRIX_PAR_SECONDE_USD = 0.2; // Runware — tarif client historique, inchangé

const MOTEURS = {
    runware: { label: "Runware", prixClientParSeconde: PRIX_PAR_SECONDE_USD },
    wan:     { label: "WAN 2.6 (Alibaba)", prixFournisseurParSeconde: 0.08, coefficientMarge: 6 },
    h3:      { label: "H3 (MiniMax)", prixFournisseurParSeconde: 0.13, coefficientMarge: 6 },
};

function prixClientParSeconde(moteur) {
    const m = MOTEURS[moteur] || MOTEURS.runware;
    if (m.prixClientParSeconde != null) return m.prixClientParSeconde;
    return Math.round(m.prixFournisseurParSeconde * m.coefficientMarge * 100) / 100;
}

async function enregistrerGeneration(workspaceId, dureeMs, moteur = "runware") {
    if (!workspaceId || !dureeMs) return;
    const cout = Math.round((dureeMs / 1000) * prixClientParSeconde(moteur) * 100) / 100;
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

module.exports = { PRIX_PAR_SECONDE_USD, MOTEURS, prixClientParSeconde, enregistrerGeneration, getCoutMois };
