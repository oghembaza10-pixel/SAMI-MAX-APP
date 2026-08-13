// ==========================================================================
// SAMII OS — WEBHOOKS DE CONFORMITÉ SHOPIFY (obligatoires pour App Review)
// ==========================================================================
// Ces 3 endpoints sont exigés par Shopify pour TOUTE Public App, sans
// exception — même si tu ne stockes pas de données sensibles.
//
// À déclarer dans le Partner Dashboard Shopify, section "Compliance
// webhooks" (Configuration de l'app) avec ces 3 URLs exactes :
//
//   Customer data request : https://samii.souverain-store.com/webhook/customers/data_request
//   Customer redact       : https://samii.souverain-store.com/webhook/customers/redact
//   Shop redact            : https://samii.souverain-store.com/webhook/shop/redact
// ==========================================================================

const express = require("express");
const router  = express.Router();
const { verifyWebhookHmac } = require("../utils/shopifyHmac");
const db = require("../services/db");
const shopifyBoutiqueService = require("../services/shopifyBoutiqueService");

function parseShopifyBody(req) {
    try {
        return JSON.parse(req.body.toString("utf8"));
    } catch {
        return {};
    }
}

router.post("/customers/data_request", async (req, res) => {
    if (!verifyWebhookHmac(req)) return res.status(401).send("Signature invalide.");
    res.status(200).send("OK");

    try {
        const payload = parseShopifyBody(req);
        const { shop_domain, customer } = payload;

        console.log(
            `📩 Demande de données client reçue — boutique: ${shop_domain}, client: ${customer?.email || customer?.id}`
        );

        // TODO : enregistrer la demande RGPD si nécessaire

    } catch (err) {
        console.error("❌ customers/data_request :", err.message);
    }
});

router.post("/customers/redact", async (req, res) => {
    if (!verifyWebhookHmac(req)) return res.status(401).send("Signature invalide.");
    res.status(200).send("OK");

    try {
        const payload = parseShopifyBody(req);
        const { shop_domain, customer } = payload;
        const email = customer?.email;
        const phone = customer?.phone;

        console.log(`🗑️ Suppression demandée pour le client ${email || phone} (${shop_domain})`);

        // La table Postgres clients n'a pas de colonne email (seulement
        // telephone) — on ne peut identifier le client que si Shopify a
        // fourni son téléphone. Mieux vaut le dire clairement que de
        // prétendre avoir supprimé une donnée qu'on n'a pas su retrouver.
        if (!phone) {
            console.warn(`⚠️ customers/redact : pas de téléphone fourni pour ${email || "client inconnu"}, suppression impossible avec le schéma actuel.`);
            return;
        }

        const workspace = await shopifyBoutiqueService.findByShopUrl(shop_domain);
        if (!workspace) {
            console.warn(`⚠️ customers/redact : boutique ${shop_domain} introuvable.`);
            return;
        }

        const deleted = await db.query(
            `DELETE FROM clients WHERE telephone = $1 AND workspace_id = $2 RETURNING id`,
            [phone, workspace.id]
        );
        console.log(`✅ ${deleted.length} client(s) supprimé(s).`);

    } catch (err) {
        console.error("❌ customers/redact :", err.message);
    }
});

router.post("/shop/redact", async (req, res) => {
    if (!verifyWebhookHmac(req)) return res.status(401).send("Signature invalide.");
    res.status(200).send("OK");

    try {
        const payload = parseShopifyBody(req);
        const { shop_domain } = payload;

        console.log(`🗑️ Déconnexion Shopify de la boutique ${shop_domain}`);

        const workspace = await shopifyBoutiqueService.findByShopUrl(shop_domain);
        if (workspace) {
            // Efface uniquement les données propres à Shopify (tokens, lien de
            // boutique) — le workspace SAMII lui-même n'est pas supprimé : le
            // marchand peut continuer à utiliser SAMII (WhatsApp, marketplace...)
            // même après avoir désinstallé l'app Shopify.
            await db.query(
                `UPDATE workspaces SET
                    shopify_shop_url = NULL,
                    shopify_access_token = NULL,
                    shopify_refresh_token = NULL,
                    shopify_token_expires_at = NULL,
                    shopify_refresh_token_expires_at = NULL,
                    shopify_webhooks_actifs = false
                 WHERE id = $1`,
                [workspace.id]
            );
            console.log(`✅ Données Shopify effacées pour le workspace ${workspace.id}.`);
        } else {
            console.warn(`⚠️ shop/redact : boutique ${shop_domain} introuvable.`);
        }

    } catch (err) {
        console.error("❌ shop/redact :", err.message);
    }
});

module.exports = router;
