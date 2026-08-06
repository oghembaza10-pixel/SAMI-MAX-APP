/**
 * ============================================================
 * OG • Sérénité Engine — rapport quotidien apaisé, chaque soir 22h
 * ============================================================
 */
const db = require("../services/db");
const notificationEngine = require("../engines/notificationEngine");

function isSereniteActive(workspace) {
    if (!workspace.automatisations) return true;
    try {
        const auto = JSON.parse(workspace.automatisations);
        return auto.serenite !== false;
    } catch {
        return true;
    }
}

async function getAdminChatId(workspaceId) {
    try {
        const rows = await db.query(
            `SELECT config FROM connecteurs WHERE type = 'telegram' AND actif = true AND workspace_id = $1`,
            [workspaceId]
        );
        if (!rows[0]) return null;
        const config = JSON.parse(rows[0].config || "{}");
        return config.chatId || null;
    } catch {
        return null;
    }
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
        const workspaces = await db.query(`SELECT * FROM workspaces`);
        console.log(`🕊️ Sérénité : ${workspaces.length} workspace(s) à traiter.`);

        const aujourdhui = new Date().toISOString().split("T")[0];
        const hierDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        for (const workspace of workspaces) {
            const workspaceId = workspace.id;
            const nom = workspace.nom || "votre activité";

            if (!workspaceId) continue;
            if (!isSereniteActive(workspace)) continue;

            const chatId = await getAdminChatId(workspaceId);
            if (!chatId) continue;

            try {
                const commandes = await db.query(
                    `SELECT * FROM commandes WHERE workspace_id = $1`,
                    [workspaceId]
                );

                const cmdAujourdhui = commandes.filter(c => {
                    const d = c.date_commande ? new Date(c.date_commande).toISOString().slice(0, 10) : "";
                    return d === aujourdhui;
                });
                const cmdHier = commandes.filter(c => {
                    const d = c.date_commande ? new Date(c.date_commande).toISOString().slice(0, 10) : "";
                    return d === hierDate;
                });

                const revAujourdhui = cmdAujourdhui.reduce((s, c) => s + (parseFloat(c.montant) || 0), 0);
                const revHier = cmdHier.reduce((s, c) => s + (parseFloat(c.montant) || 0), 0);
                const enAttente = cmdAujourdhui.filter(c => c.statut === "en attente").length;

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
