/**
 * ============================================================
 * OG • Messager Éclair Engine — suivi colis + notifications temps réel
 * Vérifie TOUS les transporteurs (Yalidine + 17TRACK universel)
 * ============================================================
 */
const db = require("../services/db");
const notificationEngine = require("../engines/notificationEngine");
const tracking = require("../services/tracking");

const STATUTS_LISIBLES = {
    "en préparation": "Ton colis est en préparation 📦",
    "expédié": "Ton colis vient d'être expédié 🚚",
    "en transit": "Ton colis est en route vers toi 🛣️",
    "en livraison": "Ton colis arrive aujourd'hui ! 🏃",
    "livré": "Ton colis a été livré ! Merci pour ta confiance 🎉",
    "retourné": "Ton colis a été retourné à l'expéditeur ⚠️",
};

function messageLisible(statut) {
    const key = (statut || "").toLowerCase();
    return STATUTS_LISIBLES[key] || `Nouveau statut de ton colis : ${statut}`;
}

function mapVersStatutQG(statutTransporteur) {
    const s = (statutTransporteur || "").toLowerCase();
    if (s.includes("livr")) return "livrée";
    if (s.includes("retour") || s.includes("échec") || s.includes("echec")) return "échoué";
    if (s.includes("transit") || s.includes("expédi") || s.includes("livraison")) return "en cours";
    return null;
}

async function runCheck() {
    try {
        const commandes = await db.query(`
            SELECT * FROM commandes
            WHERE numero_suivi IS NOT NULL AND numero_suivi != ''
              AND statut != 'livrée' AND statut != 'annulée'
            LIMIT 100
        `);

        console.log(`🚚 Messager Éclair : ${commandes.length} colis à vérifier (tous transporteurs).`);

        for (const c of commandes) {
            const numeroSuivi = c.numero_suivi;
            const transporteur = c.transporteur || "yalidine";
            const dernierStatutConnu = c.dernier_statut_suivi || "";
            const telephone = c.telephone || "";

            if (!numeroSuivi || !telephone) continue;

            const result = await tracking.checkStatus(transporteur, numeroSuivi, c.workspace_id);
            if (!result.success) continue;

            const nouveauStatut = result.statut;
            if (!nouveauStatut || nouveauStatut === dernierStatutConnu) continue;

            const message =
                `📬 *SAMII — Suivi de commande*\n\n` +
                `${messageLisible(nouveauStatut)}\n\n` +
                `_Numéro de suivi : ${numeroSuivi}_ (${transporteur})`;

            try {
                await notificationEngine.send({
                    channel: "telegram",
                    to: telephone,
                    message,
                    shop: c.workspace_id || "",
                });

                const statutQG = mapVersStatutQG(nouveauStatut);
                if (statutQG) {
                    await db.query(
                        `UPDATE commandes SET dernier_statut_suivi = $1, statut = $2 WHERE id = $3`,
                        [nouveauStatut, statutQG, c.id]
                    );
                } else {
                    await db.query(
                        `UPDATE commandes SET dernier_statut_suivi = $1 WHERE id = $2`,
                        [nouveauStatut, c.id]
                    );
                }

                console.log(`✅ Client notifié — commande ${c.id} → ${nouveauStatut} (${transporteur})`);
            } catch (err) {
                console.warn(`⚠️ Échec notification suivi pour ${c.id} :`, err.message);
            }
        }
    } catch (err) {
        console.error("❌ Messager Éclair runCheck :", err.message);
    }
}

module.exports = { runCheck };
