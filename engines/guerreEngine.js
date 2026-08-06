/**
 * ============================================================
 * OG • Guerre Engine — compte à rebours envoyé à toute la communauté
 * Email + Telegram, chaque jour de J-7 à J-0
 * ============================================================
 */
const db = require("../services/db");
const gmail = require("../services/gmail");
const notificationEngine = require("../engines/notificationEngine");

async function getJoursRestants() {
    const rows = await db.query(`SELECT valeur FROM configuration WHERE cle = 'guerre_date_lancement'`);
    if (!rows[0]) return null;
    const dateLancement = new Date(rows[0].valeur);
    const maintenant = new Date();
    const diffMs = dateLancement.getTime() - maintenant.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function messagePourJour(jours) {
    if (jours > 0) {
        return {
            sujet: `⚔️ La Guerre approche — J-${jours}`,
            corps: `Plus que ${jours} jour${jours > 1 ? "s" : ""} avant le lancement de la V2 SAMII OS.\n\nGrades, gangs, territoires, coffre de guerre — prépare ta place.`,
        };
    }
    return {
        sujet: `🔥 C'est parti — La Guerre a commencé`,
        corps: `La V2 SAMII OS est lancée. Grades, gangs, territoires — tout est ouvert dès maintenant.`,
    };
}

async function runDaily() {
    try {
        const jours = await getJoursRestants();
        if (jours === null || jours > 7 || jours < 0) {
            console.log("🕊️ Guerre Engine : hors fenêtre d'annonce (pas entre J-7 et J-0).");
            return;
        }

        const { sujet, corps } = messagePourJour(jours);
        console.log(`⚔️ Guerre Engine : envoi du message J-${jours} à toute la communauté.`);

        const utilisateurs = await db.query(`SELECT id, email, nom, prenom FROM utilisateurs`);
        console.log(`⚔️ ${utilisateurs.length} membre(s) à notifier.`);

        for (const user of utilisateurs) {
            try {
                if (user.email) {
                    await gmail.send({
                        to: user.email,
                        subject: sujet,
                        html: `
                            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#03060b;color:#f5fbff;padding:24px;border-radius:14px;">
                                <h2 style="color:#d7b34c;">${sujet}</h2>
                                <p style="color:#c5cdd5;line-height:1.6;">${corps.replace(/\n/g, "<br>")}</p>
                                <p style="color:#7f96a8;font-size:12px;margin-top:20px;">— SAMII OS</p>
                            </div>
                        `,
                    });
                }
            } catch (emailErr) {
                console.warn(`⚠️ Échec email guerre pour ${user.email} :`, emailErr.message);
            }
        }

        try {
            const telegramClients = await db.query(
                `SELECT config FROM connecteurs WHERE type IN ('telegram', 'telegram_client') AND actif = true`
            );
            for (const row of telegramClients) {
                try {
                    const config = JSON.parse(row.config || "{}");
                    if (!config.chatId) continue;
                    await notificationEngine.send({
                        channel: "telegram",
                        to: config.chatId,
                        message: `⚔️ *${sujet}*\n\n${corps}`,
                        shop: "",
                    });
                } catch (tgErr) {
                    console.warn("⚠️ Échec Telegram guerre :", tgErr.message);
                }
            }
        } catch (err) {
            console.warn("⚠️ Lecture connecteurs Telegram guerre échouée :", err.message);
        }

        console.log(`✅ Guerre Engine : diffusion J-${jours} terminée.`);
    } catch (err) {
        console.error("❌ Guerre Engine runDaily :", err.message);
    }
}

module.exports = { runDaily };
