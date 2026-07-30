/**
 * ============================================================
 * OG • Sérénité Engine — rapport quotidien apaisé, chaque soir 22h
 * ============================================================
 */
const airtable = require("../services/airtable");
const notificationEngine = require("../engines/notificationEngine");

function getMontant(c) {
    return parseFloat(c.montant || c.Total || 0) || 0;
}

function isSereniteActive(fields) {
    if (!fields.automatisations) return true;
    try {
        const auto = JSON.parse(fields.automatisations);
        return auto.serenite !== false;
    } catch {
        return true;
    }
}

async function getAdminChatId(workspaceId) {
    try {
        const record = await airtable.findOne("CONNECTEURS",
            `AND({type}="telegram",{actif}=1,{workspace_id}="${workspaceId}")`
        );
        if (!record) return null;
        const config = JSON.parse((record.fields?.config || "{}").replace(/\\_/g, "_"));
        return config.chatId || config.chat_id || null;
    } catch { return null; }
}

function ecartMessage(aujourdhui, hier) {
    if (hier === 0 && aujourdhui === 0) return "Une journée calme, comme il y en a.";
    if (hier === 0) return "Une belle reprise aujourd'hui.";
    const variation = ((aujourdhui - hier) / hier) * 100;
    if (variation > 15) return `En hausse de ${variation.toFixed(0)}% par rapport à hier. Continuez ainsi.`;
    if (variation < -15) return `Un peu plus calme qu'hier (${variation.toFixed(0)}%). Rien d'alarmant, ça arrive.`;
    return "Une journée stable, dans la continuité d'hier.";
}

async function runDaily() {
    try {
        const workspaces = await airtable.find("WORKSPACES", `{statut}="actif"`, 200);
        console.log(`🕊️ Sérénité : ${workspaces.length} workspace(s) actif(s) à traiter.`);

        const aujourdhui = new Date().toISOString().split("T")[0];
        const hierDate   = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        for (const record of workspaces) {
            const f = record.fields;
            const workspaceId = f.workspace_id;
            const nom = f.nom || "votre activité";

            if (!workspaceId) continue;
            if (!isSereniteActive(f)) continue;

            const chatId = await getAdminChatId(workspaceId);
            if (!chatId) continue;

            try {
                const commandes = await airtable.find("COMMANDES", `{Boutique}="${workspaceId}"`, 300);

                const cmdAujourdhui = commandes.filter(c => (c.fields["Date Commande"] || "").slice(0, 10) === aujourdhui);
                const cmdHier       = commandes.filter(c => (c.fields["Date Commande"] || "").slice(0, 10) === hierDate);

                const revAujourdhui = cmdAujourdhui.reduce((s, c) => s + getMontant(c.fields), 0);
                const revHier       = cmdHier.reduce((s, c) => s + getMontant(c.fields), 0);

                const enAttente = cmdAujourdhui.filter(c => c.fields.Statut === "en attente").length;

                const message =
                    `🕊️ *SAMII — Bilan de la journée*\n\n` +
                    `${nom}, voici votre journée en un coup d'œil :\n\n` +
                    `📦 Commandes : *${cmdAujourdhui.length}*\n` +
                    `💰 Revenus : *${revAujourdhui.toFixed(2)}*\n` +
                    (enAttente > 0 ? `⏳ ${enAttente} commande(s) encore en attente\n` : `✅ Tout est traité\n`) +
                    `\n_${ecartMessage(revAujourdhui, revHier)}_\n\n` +
                    `Reposez-vous, je veille sur le reste. 🌙`;

                await notificationEngine.send({
                    channel: "telegram",
                    to: chatId,
                    message,
                    shop: workspaceId,
                });

                console.log(`✅ Rapport Sérénité envoyé pour workspace ${workspaceId}`);
            } catch (err) {
                console.warn(`⚠️ Échec rapport Sérénité pour ${workspaceId} :`, err.message);
            }
        }
    } catch (err) {
        console.error("❌ Sérénité runDaily :", err.message);
    }
}

module.exports = { runDaily };
