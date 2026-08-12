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
        `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
        ["order.paid.chargily", `#${orderId} payée via Chargily (${checkoutId})`, workspaceId]
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

    const carte = CARTES.find(c => c.id === carteId);
    const dureeJours = carte?.dureeJours || 7;
    const expireLe = new Date(Date.now() + dureeJours * 86400000);

    const rows = await db.query(
        `UPDATE cartes_achats SET statut = 'payée', expire_le = $3
         WHERE workspace_id = $1 AND carte_id = $2 AND statut != 'payée' RETURNING id`,
        [workspaceId, carteId, expireLe]
    );

    if (!rows[0]) return { updated: false };

    await db.query(
        `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
        ["carte.achetee", `Carte "${carteId}" débloquée ${dureeJours} jours via Chargily (${checkoutId})`, workspaceId]
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

module.exports = { confirmChargilyPayment, confirmChargilyCartePurchase };
