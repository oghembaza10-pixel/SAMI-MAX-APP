/**
 * ============================================================
 * OG • Ambassadeur Engine — offres fidélité automatiques VIP
 * ============================================================
 */
const db = require("../services/db");
const notificationEngine = require("../engines/notificationEngine");
const workspaceService = require("../services/workspaceService");
const JOURS_ENTRE_OFFRES = 30;

// Lisait auparavant une table Airtable "CLIENTS" avec un champ {VIP} qui
// n'a jamais existé côté Postgres — cette tâche planifiée (10h chaque jour,
// voir kernel/bootstrap.js) ne trouvait donc jamais aucun client, jamais.
// "VIP" est ici défini par un vrai signal existant : 3 commandes ou plus.
async function runDaily() {
    try {
        const vipClients = await db.query(
            `SELECT id, workspace_id, nom, telephone, derniere_offre_fidelite
             FROM clients WHERE total_commandes >= 3 AND telephone != '' LIMIT 100`
        );
        console.log(`🎁 Ambassadeur : ${vipClients.length} client(s) fidèle(s) trouvé(s).`);

        for (const c of vipClients) {
            const shop = c.workspace_id || "";
            const phone = c.telephone || "";
            const nom = c.nom || "cher client";
            if (!phone || !shop) continue;

            const ws = await workspaceService.getById(shop);
            if (ws?.automatisations?.ambassadeur === false) continue;

            const derniereOffre = c.derniere_offre_fidelite ? new Date(c.derniere_offre_fidelite) : null;
            const joursDepuis = derniereOffre
                ? (Date.now() - derniereOffre.getTime()) / (1000 * 60 * 60 * 24)
                : Infinity;
            if (joursDepuis < JOURS_ENTRE_OFFRES) continue;

            const message =
                `👑 *SAMII — Offre spéciale VIP*\n\n` +
                `Bonjour ${nom} !\n\n` +
                `En tant que client fidèle, vous bénéficiez d'une offre exclusive sur votre prochaine commande. 🎁\n\n` +
                `_Contactez-nous pour en profiter._`;
            try {
                await notificationEngine.send({
                    channel: "whatsapp",
                    to: phone,
                    message,
                    shop,
                });
                await db.query(`UPDATE clients SET derniere_offre_fidelite = now() WHERE id = $1`, [c.id]);
                console.log(`✅ Offre Ambassadeur envoyée à ${nom} (${phone})`);
            } catch (err) {
                console.warn(`⚠️ Échec envoi Ambassadeur à ${nom} :`, err.message);
            }
        }
    } catch (err) {
        console.error("❌ Ambassadeur runDaily :", err.message);
    }
}
module.exports = { runDaily };
