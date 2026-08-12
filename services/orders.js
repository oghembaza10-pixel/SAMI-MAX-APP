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

module.exports = { confirmChargilyPayment };
