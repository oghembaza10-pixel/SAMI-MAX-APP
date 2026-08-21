// ==========================================================================
// SAMII OS — FACTURES / TICKETS DE LIVRAISON
// Génère et envoie au client une facture simple pour une commande existante
// — texte formaté, pas de PDF (inutile sur WhatsApp/Telegram, où le texte
// s'affiche directement), enregistrée dans la table `factures` déjà prête
// mais jamais utilisée jusqu'ici.
// ==========================================================================
const db     = require("./db");
const axios  = require("axios");
const CONFIG = require("../config");
const whatsapp = require("./whatsapp");

// Même logique que routes/telegram.js resolveBotBase — dupliquée ici car non
// exportée par le routeur, et volontairement minimale (peu de chances de
// changer, pas besoin d'un partage plus complexe pour ça).
async function resolveTelegramBase(workspaceId) {
    try {
        const rows = await db.query(
            `SELECT config FROM connecteurs WHERE type = 'telegram_bot' AND actif = true AND workspace_id = $1`,
            [workspaceId]
        );
        const config = rows[0] ? JSON.parse(rows[0].config || "{}") : null;
        if (config?.botToken) return `https://api.telegram.org/bot${config.botToken}`;
    } catch { /* repli sur le bot partagé */ }
    return `https://api.telegram.org/bot${CONFIG.TELEGRAM.BOT_TOKEN}`;
}

function texteFacture(commande, workspace, numero) {
    const date = new Date(commande.date_commande).toLocaleDateString("fr-FR");
    return [
        `🧾 *Facture ${numero}*`,
        `${workspace.nom}`,
        `Date : ${date}`,
        ``,
        `Client : ${commande.nom_client}`,
        `Produit : ${commande.produit}`,
        `Montant : ${commande.montant} ${workspace.devise || "DZD"}`,
        commande.numero_suivi ? `Suivi : ${commande.numero_suivi}${commande.transporteur ? ` (${commande.transporteur})` : ""}` : "",
        ``,
        `Merci pour votre confiance.`,
    ].filter(Boolean).join("\n");
}

// ── Génère la facture, l'enregistre, et l'envoie directement au client sur
// le même canal que sa commande (WhatsApp ou Telegram) ────────────────────
async function genererEtEnvoyerFacture(workspaceId, commandeId) {
    const [commande] = await db.query(
        `SELECT * FROM commandes WHERE id = $1 AND workspace_id = $2`,
        [commandeId, workspaceId]
    );
    if (!commande) return { success: false, error: "Commande introuvable." };

    const [workspace] = await db.query(`SELECT nom, devise FROM workspaces WHERE id = $1`, [workspaceId]);
    if (!workspace) return { success: false, error: "Boutique introuvable." };

    const numero = `F-${commande.id}`;
    const texte  = texteFacture(commande, workspace, numero);

    await db.query(
        `INSERT INTO factures (workspace_id, commande_id, montant, devise, statut) VALUES ($1, $2, $3, $4, 'envoyee')`,
        [workspaceId, commandeId, commande.montant, workspace.devise || "DZD"]
    );

    const destinataire = commande.contact_id || commande.telephone;
    if (!destinataire) return { success: true, texte, warning: "Facture enregistrée, mais aucun contact client trouvé pour l'envoyer automatiquement." };

    try {
        if (commande.source === "whatsapp") {
            await whatsapp.send({ to: destinataire, message: texte, workspaceId });
        } else {
            const base = await resolveTelegramBase(workspaceId);
            await axios.post(`${base}/sendMessage`, { chat_id: destinataire, text: texte, parse_mode: "Markdown" });
        }
    } catch (err) {
        console.error("❌ factureService envoi :", err.response?.data || err.message);
        return { success: true, texte, warning: "Facture enregistrée mais l'envoi automatique au client a échoué — envoie-la toi-même." };
    }

    return { success: true, texte, numero };
}

module.exports = { genererEtEnvoyerFacture, texteFacture };
