/**
 * ============================================================
 * OG • Ambassadeur Engine — offres fidélité automatiques VIP
 * ============================================================
 */
const airtable = require("../services/airtable");
const notificationEngine = require("../engines/notificationEngine");
const workspaceService = require("../services/workspaceService");
const JOURS_ENTRE_OFFRES = 30;
async function runDaily() {
    try {
        const vipClients = await airtable.find("CLIENTS", `{VIP}=1`, 100);
        console.log(`🎁 Ambassadeur : ${vipClients.length} client(s) VIP trouvé(s).`);
        for (const record of vipClients) {
            const f = record.fields;
            const shop = f.Boutique || "";
            const phone = f["Téléphone"] || "";
            const nom = f["Nom Client"] || f["Nom"] || "cher client";
            if (!phone) continue;

            const ws = await workspaceService.getById(shop);
            if (ws?.automatisations?.ambassadeur === false) continue;

            const derniereOffre = f.derniere_offre_fidelite
                ? new Date(f.derniere_offre_fidelite)
                : null;
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
                await airtable.update("CLIENTS", record.id, {
                    derniere_offre_fidelite: new Date().toISOString(),
                });
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
