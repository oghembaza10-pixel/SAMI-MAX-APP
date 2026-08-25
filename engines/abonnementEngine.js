/**
 * ============================================================
 * OG • Abonnement Engine — relance de renouvellement
 * Chargily (et CCP) n'ont aucun prélèvement récurrent possible — chaque
 * mois est un paiement séparé. Ce job tourne une fois par jour : il
 * prévient 3 jours avant l'échéance avec un nouveau lien de paiement,
 * et repasse le workspace en "free" si rien n'a été payé après expiration.
 * ============================================================
 */
const db = require("../services/db");
const chargily = require("../services/chargily");
const devises = require("../services/devises");
const abonnementService = require("../services/abonnementService");
const confirmationsQuota = require("../services/confirmationsQuota");
const samiiQuota = require("../services/samiiQuota");
const griotCoutService = require("../services/griotCoutService");
const notificationEngine = require("./notificationEngine");
const notify = require("../services/notify");
const CONFIG = require("../config");

// Même source que routes/billing.js — le montant qu'on redemande au
// renouvellement doit être exactement celui qu'on a affiché (config/paliers.js).
const paliers = require("../config/paliers");
const PRIX_AFFICHE = Object.fromEntries(paliers.PAYANTS.map(id => [id, paliers.prixUSD(id)]));
const JOURS_AVANT_RAPPEL = 3;

async function genererLienRenouvellement(workspaceId, plan) {
    // Chargily/CCP n'ont pas de prélèvement automatique (voir en-tête du
    // fichier) — les dépassements de quota confirmations (services/
    // confirmationsQuota.js), messages (services/samiiQuota.js) et le coût
    // de génération Griot (services/griotCoutService.js, tarif par moteur,
    // pas de volume gratuit) ne peuvent donc pas être débités en temps réel :
    // ajoutés ici, une fois, au montant du prochain renouvellement.
    const etatQuota = await confirmationsQuota.getEtatQuota(workspaceId, plan);
    const depassementMessages = await samiiQuota.getDepassementMessagesMois(workspaceId);
    const coutGriot = await griotCoutService.getCoutMois(workspaceId);
    const montantBaseDzd = Math.round(devises.depuisUSD(PRIX_AFFICHE[plan], "DZD"));
    const montantDepassementConfirmDzd = etatQuota.montantDu ? Math.round(devises.depuisUSD(etatQuota.montantDu, "DZD")) : 0;
    const montantDepassementMsgDzd = depassementMessages.montantDu ? Math.round(devises.depuisUSD(depassementMessages.montantDu, "DZD")) : 0;
    const montantGriotDzd = coutGriot ? Math.round(devises.depuisUSD(coutGriot, "DZD")) : 0;
    const montantDzd = montantBaseDzd + montantDepassementConfirmDzd + montantDepassementMsgDzd + montantGriotDzd;

    const inserted = await db.query(
        `INSERT INTO abonnements (workspace_id, type, statut, methode_paiement, montant, devise, date_debut)
         VALUES ($1,$2,'en attente','chargily',$3,'DZD',now()) RETURNING id`,
        [workspaceId, plan, montantDzd]
    );

    const extras = [];
    if (montantDepassementConfirmDzd) extras.push(`${etatQuota.depassement} confirmations`);
    if (montantDepassementMsgDzd) extras.push(`${depassementMessages.count} messages`);
    if (montantGriotDzd) extras.push(`génération Griot`);
    const description = extras.length
        ? `Renouvellement abonnement SAMII — ${plan} (+ ${extras.join(", ")} au-delà du quota)`
        : `Renouvellement abonnement SAMII — ${plan}`;

    const checkout = await chargily.createCheckout({
        amount: montantDzd,
        currency: "dzd",
        description,
        successUrl: `${CONFIG.APP_URL}/billing/success?method=chargily`,
        failureUrl: `${CONFIG.APP_URL}/billing?achat=echec`,
        webhookUrl: `${CONFIG.APP_URL}/webhook/chargily`,
        metadata: { type: "abonnement", workspace_id: workspaceId, plan, abonnement_id: String(inserted[0].id) },
    });
    if (!checkout.success) return null;

    await db.query(`UPDATE abonnements SET chargily_checkout_id = $1 WHERE id = $2`, [checkout.checkoutId, inserted[0].id]);
    return checkout.checkoutUrl;
}

async function prevenirWorkspace(workspaceId, message) {
    const rows = await db.query(
        `SELECT u.id AS user_id, u.telephone FROM workspaces w
         LEFT JOIN utilisateurs u ON u.email = COALESCE(w.owner, w.owner_email)
         WHERE w.id = $1`,
        [workspaceId]
    );
    const telephone = rows[0]?.telephone;

    if (telephone) {
        try {
            await notificationEngine.send({ channel: "whatsapp", to: telephone, message, shop: workspaceId });
        } catch (err) {
            console.warn(`⚠️ Rappel WhatsApp échoué pour ${workspaceId} :`, err.message);
        }
    }
    notify.notifyWorkspace(workspaceId, { title: "👑 Ton abonnement SAMII", body: message, url: "/billing" }).catch(() => {});
}

async function runDailyRenewalCheck() {
    try {
        // Un abonnement "actif" par workspace = le plus récent payé, par palier
        // manuel (chargily/ccp — Stripe se renouvelle lui-même, on l'ignore ici).
        const abonnements = await db.query(`
            SELECT DISTINCT ON (workspace_id) *
            FROM abonnements
            WHERE statut = 'payée' AND methode_paiement IN ('chargily', 'ccp') AND date_fin IS NOT NULL
            ORDER BY workspace_id, date_fin DESC
        `);

        console.log(`👑 Abonnement Engine : ${abonnements.length} abonnement(s) manuel(s) actif(s) à vérifier.`);

        const maintenant = Date.now();

        for (const a of abonnements) {
            const dateFin = new Date(a.date_fin).getTime();
            const joursRestants = Math.ceil((dateFin - maintenant) / 86400000);

            if (joursRestants < 0 && !a.expire_traite_le) {
                // Expiré et jamais renouvelé — retour au palier gratuit. Traité
                // une seule fois par abonnement (expire_traite_le), pour ne pas
                // spammer le marchand tant qu'il ne renouvelle pas.
                await abonnementService.retrograderVersFree(a.workspace_id);
                const lien = await genererLienRenouvellement(a.workspace_id, a.type);
                await prevenirWorkspace(
                    a.workspace_id,
                    `⏳ Ton abonnement SAMII "${a.type}" a expiré, tu es repassé au palier gratuit.\n\nRenouvelle en un clic : ${lien || CONFIG.APP_URL + "/billing"}`
                );
                await db.query(`UPDATE abonnements SET expire_traite_le = now() WHERE id = $1`, [a.id]);
                console.log(`⬇️ ${a.workspace_id} repassé free (abonnement ${a.type} expiré).`);
            } else if (joursRestants >= 0 && joursRestants <= JOURS_AVANT_RAPPEL && !a.rappel_envoye_le) {
                const lien = await genererLienRenouvellement(a.workspace_id, a.type);
                await prevenirWorkspace(
                    a.workspace_id,
                    `⏳ Ton abonnement SAMII "${a.type}" expire dans ${joursRestants} jour(s).\n\nRenouvelle dès maintenant pour ne rien perdre : ${lien || CONFIG.APP_URL + "/billing"}`
                );
                await db.query(`UPDATE abonnements SET rappel_envoye_le = now() WHERE id = $1`, [a.id]);
                console.log(`📨 Rappel envoyé à ${a.workspace_id} (${a.type}, expire dans ${joursRestants}j).`);
            }
        }
    } catch (err) {
        console.error("❌ Abonnement Engine runDailyRenewalCheck :", err.message);
    }
}

module.exports = { runDailyRenewalCheck };
