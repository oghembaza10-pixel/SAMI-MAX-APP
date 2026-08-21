// ==========================================================================
// SAMII OS — ORDERS (logique partagée de confirmation de paiement Chargily)
// Utilisée à la fois par le webhook (routes/webhook-chargily.js) et par le
// retour client sur la page de succès (routes/marketplace.js) : le webhook
// peut ne jamais arriver (mauvaise config dashboard, réseau...), donc on ne
// s'y fie pas comme seule source de vérité.
// ==========================================================================
const chargily = require("./chargily");
const db = require("./db");
const socketService = require("./socketService");
const notify = require("./notify");
const { CARTES } = require("../config/cartes-catalog");
const abonnementService = require("./abonnementService");
// Les 33 lois de l'Arsenal partagent la même table cartes_achats (voir
// routes/arsenal.js) — nécessaire ici pour retrouver leur durée exacte.
const ARSENAL_CARDS = require("../routes/arsenal").CARDS;

// Relit le statut réel du checkout chez Chargily et marque la commande payée
// si besoin. Idempotent : ne fait rien si déjà "payée" ou si non payé.
async function confirmChargilyPayment(checkoutId) {
    if (!checkoutId) return { updated: false };

    const checkout = await chargily.getCheckout(checkoutId);
    if (!checkout || checkout.status !== "paid") return { updated: false };

    const orderId = checkout.metadata?.order_id;
    if (!orderId) return { updated: false };

    const rows = await db.query(
        `UPDATE commandes SET statut = 'payée', chargily_checkout_id = $1
         WHERE id = $2 AND statut != 'payée' RETURNING workspace_id`,
        [checkoutId, orderId]
    );

    if (!rows[0]) return { updated: false, orderId };

    const workspaceId = rows[0].workspace_id;
    await db.query(
        `INSERT INTO journal (action, details, workspace_id, montant, ref_id) VALUES ($1, $2, $3, $4, $5)`,
        ["order.paid.chargily", `#${orderId} payée via Chargily (${checkoutId})`, workspaceId, checkout.amount || null, orderId]
    );
    socketService.emitToShop(workspaceId, "commande-payee", { id: orderId });
    notify.notifyWorkspace(workspaceId, {
        title: "💳 Paiement reçu",
        body: `Commande #${orderId} payée en ligne`,
        url: "/qg",
    });
    console.log(`✅ Commande ${orderId} marquée payée via Chargily (confirmChargilyPayment)`);

    return { updated: true, orderId };
}

// Confirme l'achat d'une carte SAMII à l'unité (config/cartes-catalog.js).
// Même logique de vérification directe auprès de Chargily, idempotent.
async function confirmChargilyCartePurchase(checkoutId) {
    if (!checkoutId) return { updated: false };

    const checkout = await chargily.getCheckout(checkoutId);
    if (!checkout || checkout.status !== "paid") return { updated: false };

    const { workspace_id: workspaceId, carte_id: carteId } = checkout.metadata || {};
    if (!workspaceId || !carteId) return { updated: false };

    const carte = CARTES.find(c => c.id === carteId) || ARSENAL_CARDS.find(c => c.loi === carteId);
    const dureeJours = carte?.dureeJours || 7;
    const expireLe = new Date(Date.now() + dureeJours * 86400000);

    const rows = await db.query(
        `UPDATE cartes_achats SET statut = 'payée', expire_le = $3
         WHERE workspace_id = $1 AND carte_id = $2 AND statut != 'payée' RETURNING id`,
        [workspaceId, carteId, expireLe]
    );

    if (!rows[0]) return { updated: false };

    await db.query(
        `INSERT INTO journal (action, details, workspace_id, montant, ref_id) VALUES ($1, $2, $3, $4, $5)`,
        ["carte.achetee", `Carte "${carteId}" débloquée ${dureeJours} jours via Chargily (${checkoutId})`, workspaceId, checkout.amount || null, carteId]
    );
    socketService.emitToShop(workspaceId, "carte-debloquee", { carteId, expireLe });
    notify.notifyWorkspace(workspaceId, {
        title: "🔓 Carte débloquée",
        body: `Ta carte "${carteId}" est active pour ${dureeJours} jours.`,
        url: "/cartes",
    });
    console.log(`✅ Carte ${carteId} débloquée ${dureeJours}j pour ${workspaceId} via Chargily`);

    return { updated: true, workspaceId, carteId };
}

// Confirme le paiement Chargily d'un abonnement (Edahabia/CIB — le seul moyen
// de payer par carte qui marche vraiment en Algérie). Pas de prélèvement
// récurrent possible côté Chargily : on pose une date_fin à 30 jours, et
// c'est engines/abonnementEngine.js qui relance par lien avant expiration.
async function confirmChargilyAbonnement(checkoutId) {
    if (!checkoutId) return { updated: false };

    const checkout = await chargily.getCheckout(checkoutId);
    if (!checkout || checkout.status !== "paid") return { updated: false };

    const { workspace_id: workspaceId, plan } = checkout.metadata || {};
    if (!workspaceId || !plan) return { updated: false };

    const expireLe = new Date(Date.now() + abonnementService.DUREE_JOURS * 86400000);

    const rows = await db.query(
        `UPDATE abonnements SET statut = 'payée', date_fin = $3
         WHERE chargily_checkout_id = $1 AND workspace_id = $2 AND statut != 'payée' RETURNING id`,
        [checkoutId, workspaceId, expireLe]
    );
    if (!rows[0]) return { updated: false };

    await abonnementService.activerPalier(workspaceId, plan);

    await db.query(
        `INSERT INTO journal (action, details, workspace_id, montant, ref_id) VALUES ($1, $2, $3, $4, $5)`,
        ["abonnement.paye", `Abonnement "${plan}" activé 30 jours via Chargily (${checkoutId})`, workspaceId, checkout.amount || null, plan]
    );
    socketService.emitToShop(workspaceId, "abonnement-active", { plan, expireLe });
    notify.notifyWorkspace(workspaceId, {
        title: "👑 Abonnement activé",
        body: `Ton palier "${plan}" est actif pour 30 jours.`,
        url: "/qg",
    });
    console.log(`✅ Abonnement ${plan} activé 30j pour ${workspaceId} via Chargily`);

    return { updated: true, workspaceId, plan };
}

// Confirmation manuelle d'un virement CCP par l'équipe (Centre de contrôle admin) :
// il n'existe pas d'API Algérie Poste pour vérifier un virement automatiquement,
// donc un humain vérifie le compte CCP puis déclenche cette activation.
async function confirmCcpAbonnement(abonnementId) {
    if (!abonnementId) return { updated: false };
    const expireLe = new Date(Date.now() + abonnementService.DUREE_JOURS * 86400000);

    const rows = await db.query(
        `UPDATE abonnements SET statut = 'payée', date_fin = $2
         WHERE id = $1 AND methode_paiement = 'ccp' AND statut != 'payée'
         RETURNING workspace_id, type AS plan`,
        [abonnementId, expireLe]
    );
    if (!rows[0]) return { updated: false };
    const { workspace_id: workspaceId, plan } = rows[0];

    await abonnementService.activerPalier(workspaceId, plan);

    const workspaceRows = await db.query(`SELECT owner FROM workspaces WHERE id = $1`, [workspaceId]);
    const ownerEmail = workspaceRows[0]?.owner;
    if (ownerEmail) {
        const userRows = await db.query(`SELECT id FROM utilisateurs WHERE email = $1`, [ownerEmail]);
        const userId = userRows[0]?.id;
        if (userId) {
            const commissionRows = await db.query(
                `SELECT id FROM commissions_parrainage
                 WHERE filleul_id = $1 AND plan = $2 AND source = 'ccp' AND statut = 'en_attente'
                 ORDER BY created_at DESC LIMIT 1`,
                [userId, plan]
            );
            if (commissionRows[0]) {
                await db.query(`UPDATE commissions_parrainage SET statut = 'confirmee' WHERE id = $1`, [commissionRows[0].id]);
            }
        }
    }

    await db.query(
        `INSERT INTO journal (action, details, workspace_id, ref_id) VALUES ($1, $2, $3, $4)`,
        ["abonnement.paye", `Abonnement "${plan}" activé 30 jours via CCP (confirmé manuellement)`, workspaceId, plan]
    );
    socketService.emitToShop(workspaceId, "abonnement-active", { plan, expireLe });
    notify.notifyWorkspace(workspaceId, {
        title: "👑 Abonnement activé",
        body: `Ton palier "${plan}" est actif pour 30 jours (paiement CCP confirmé).`,
        url: "/qg",
    });
    console.log(`✅ Abonnement ${plan} activé 30j pour ${workspaceId} via CCP (admin)`);

    return { updated: true, workspaceId, plan };
}

module.exports = { confirmChargilyPayment, confirmChargilyCartePurchase, confirmChargilyAbonnement, confirmCcpAbonnement };
