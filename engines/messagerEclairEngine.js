/**
 * ============================================================
 * OG • Messager Éclair Engine — suivi colis + notifications temps réel
 * ============================================================
 */
const airtable = require("../services/airtable");
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
    return null; // statut inconnu, on ne touche pas au champ Statut
}

async function runCheck() {
    try {
        const commandes = await airtable.find(
            "COMMANDES",
            `AND(NOT({numero_suivi}=""), {Statut}!="livrée", {Statut}!="annulée")`,
            100
        );

        console.log(`🚚 Messager Éclair : ${commandes.length} colis à vérifier.`);

        for (const c of commandes) {
            const f = c.fields;
            const numeroSuivi = f.numero_suivi;
            const transporteur = f.transporteur || "yalidine";
            const dernierStatutConnu = f.dernier_statut_suivi || "";
            const telephone = f["Téléphone"] || "";

            if (!numeroSuivi || !telephone) continue;

            const result = await tracking.checkStatus(transporteur, numeroSuivi, f.Boutique);
            if (!result.success) continue;

            const nouveauStatut = result.statut;
            if (!nouveauStatut || nouveauStatut === dernierStatutConnu) continue;

            const message =
                `📬 *SAMII — Suivi de commande*\n\n` +
                `${messageLisible(nouveauStatut)}\n\n` +
                `_Numéro de suivi : ${numeroSuivi}_`;

            try {
                await notificationEngine.send({
                    channel: "telegram",
                    to: telephone,
                    message,
                    shop: f.Boutique || "",
                });

                const statutQG = mapVersStatutQG(nouveauStatut);
                const updateFields = { dernier_statut_suivi: nouveauStatut };
                if (statutQG) updateFields.Statut = statutQG;

                await airtable.update("COMMANDES", c.id, updateFields);

                console.log(`✅ Client notifié — commande ${f["ID Commande"] || c.id} → ${nouveauStatut}`);
            } catch (err) {
                console.warn(`⚠️ Échec notification suivi pour ${c.id} :`, err.message);
            }
        }
    } catch (err) {
        console.error("❌ Messager Éclair runCheck :", err.message);
    }
}

module.exports = { runCheck };
