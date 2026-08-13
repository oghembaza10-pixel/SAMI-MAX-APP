// ==========================================================================
// SAMII OS — Shopify : colonnes shopify_* sur workspaces (Postgres)
// ==========================================================================
// auth-shopify.js maintenait une table Airtable "BOUTIQUES" séparée du
// workspace Postgres pourtant déjà créé pour la même boutique au même
// moment (workspaceService.create). Les deux ne se sont jamais synchronisés
// correctement — ce service écrit directement les colonnes shopify_* sur
// workspaces plutôt que de dupliquer un second enregistrement ailleurs.
// Accès direct par SQL (comme abonnementService.js) plutôt que par le
// whitelist générique de workspaceService.update, pour ne pas alourdir
// celui-ci de 6 colonnes propres à un seul connecteur.
const db = require("../services/db");
const workspaceService = require("../services/workspaceService");

async function findByShopUrl(shop) {
    const rows = await db.query(`SELECT * FROM workspaces WHERE shopify_shop_url = $1 LIMIT 1`, [shop]);
    return rows[0] || null;
}

async function saveTokens(workspaceId, { accessToken, refreshToken, tokenExpiresAt, refreshTokenExpiresAt }) {
    await db.query(
        `UPDATE workspaces SET
            shopify_access_token = $1,
            shopify_refresh_token = $2,
            shopify_token_expires_at = $3,
            shopify_refresh_token_expires_at = $4
         WHERE id = $5`,
        [accessToken, refreshToken || null, tokenExpiresAt || null, refreshTokenExpiresAt || null, workspaceId]
    );
}

async function markWebhooksActifs(workspaceId) {
    await db.query(`UPDATE workspaces SET shopify_webhooks_actifs = true WHERE id = $1`, [workspaceId]);
}

// ── Upsert de la boutique : réutilise un workspace existant pour ce
// shop_url appartenant au même propriétaire, sinon en crée un nouveau
// (même logique que l'ancienne version Airtable, portée sur Postgres). ──
async function upsertBoutique(shop, tokenData, shopInfo, currentUserEmail) {
    const tokenExpiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;
    const refreshTokenExpiresAt = tokenData.refresh_token_expires_in ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000) : null;

    let workspace = await findByShopUrl(shop);
    if (workspace && workspace.owner !== currentUserEmail) {
        console.log(`⚠️ Workspace existant (${workspace.id}) n'appartient pas à ${currentUserEmail} — création d'un nouveau.`);
        workspace = null;
    }

    const isNew = !workspace;

    if (isNew) {
        const crypto = require("crypto");
        const created = await workspaceService.create({
            workspaceId: `WS-${crypto.randomUUID()}`,
            owner: currentUserEmail || shopInfo?.email || "",
            nom: shopInfo?.name || shop,
            metier: "ecommerce",
            pays: shopInfo?.country || "DZ",
            devise: shopInfo?.currency || "",
            langue: "fr",
            logo: "",
        });
        await db.query(`UPDATE workspaces SET shopify_shop_url = $1 WHERE id = $2`, [shop, created.workspaceId]);
        workspace = await workspaceService.getById(created.workspaceId);
        console.log(`✅ Workspace créé pour ${shop} : ${created.workspaceId}`);
    } else {
        console.log(`🔄 Boutique mise à jour : ${shop}`);
    }

    await saveTokens(workspace.recordId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt,
        refreshTokenExpiresAt,
    });

    return { id: workspace.recordId, workspaceId: workspace.workspaceId, isNew };
}

module.exports = { findByShopUrl, saveTokens, markWebhooksActifs, upsertBoutique };
