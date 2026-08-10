// ==========================================================================
// SAMII OS — NOTIFY (notification push vers tous les appareils d'un compte)
// ==========================================================================
const db = require("./db");
const webpush = require("./webpush");

async function notifyUser(userId, { title, body, url } = {}) {
    if (!userId || !webpush.isEnabled()) return;
    try {
        const rows = await db.query(
            `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
            [userId]
        );
        for (const row of rows) {
            const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
            const result = await webpush.sendNotification(subscription, { title, body, url });
            if (!result.success && result.expired) {
                await db.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [row.endpoint]).catch(() => {});
            }
        }
    } catch (err) {
        console.error("❌ notifyUser :", err.message);
    }
}

// Le marchand est identifié via son email (workspaces.owner_email -> utilisateurs.email) :
// les workspaces ne stockent pas directement l'id utilisateur.
async function notifyWorkspace(workspaceId, payload) {
    if (!workspaceId || !webpush.isEnabled()) return;
    try {
        const rows = await db.query(
            `SELECT u.id FROM utilisateurs u
             JOIN workspaces w ON w.owner_email = u.email
             WHERE w.id = $1`,
            [workspaceId]
        );
        if (rows[0]?.id) await notifyUser(rows[0].id, payload);
    } catch (err) {
        console.error("❌ notifyWorkspace :", err.message);
    }
}

module.exports = { notifyUser, notifyWorkspace };
