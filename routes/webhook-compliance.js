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
const crypto  = require("crypto");
const axios   = require("axios");
const router  = express.Router();

const API_SECRET       = process.env.SHOPIFY_API_SECRET;
const AIRTABLE_API_KEY  = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE_BOUTIQUES   = process.env.TABLE_BOUTIQUES;
const TABLE_CLIENTS     = process.env.TABLE_CLIENTS   || "CLIENTS";
const TABLE_COMMANDES   = process.env.TABLE_COMMANDES || "COMMANDES";

const airtableHeaders = () => ({
    Authorization : `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
});

function verifyWebhookHmac(req) {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
    if (!hmacHeader || !req.body) return false;

    const generated = crypto
        .createHmac("sha256", API_SECRET)
        .update(req.body)
        .digest("base64");

    try {
        return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(hmacHeader));
    } catch {
        return false;
    }
}

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
        console.log(`📩 Demande de données client reçue — boutique: ${shop_domain}, client: ${customer?.email || customer?.id}`);
        // TODO : suivi manuel ou table Airtable dédiée "DEMANDES_RGPD"
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

        console.log(`🗑️ Suppression demandée pour le client ${email} (boutique ${shop_domain})`);

        if (email && TABLE_CLIENTS) {
            const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_CLIENTS}?filterByFormula=AND({email}="${email}",{shop_url}="${shop_domain}")`;
            const search    = await axios.get(searchUrl, { headers: airtableHeaders() });

            for (const record of search.data.records) {
                await axios.delete(
                    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_CLIENTS}/${record.id}`,
                    { headers: airtableHeaders() }
                );
            }
            console.log(`✅ ${search.data.records.length} enregistrement(s) client supprimé(s).`);
        }
    } catch (err) {
        console.error("❌ customers/redact :", err.response?.data || err.message);
    }
});

router.post("/shop/redact", async (req, res) => {
    if (!verifyWebhookHmac(req)) return res.status(401).send("Signature invalide.");
    res.status(200).send("OK");

    try {
        const payload = parseShopifyBody(req);
        const { shop_domain } = payload;

        console.log(`🗑️ Suppression complète demandée pour la boutique ${shop_domain}`);

        if (TABLE_BOUTIQUES) {
            const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}?filterByFormula={shop_url}="${shop_domain}"`;
            const search    = await axios.get(searchUrl, { headers: airtableHeaders() });
            const record    = search.data.records[0];

            if (record) {
                await axios.delete(
                    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}/${record.id}`,
                    { headers: airtableHeaders() }
                );
                console.log(`✅ Boutique ${shop_domain} supprimée d'Airtable.`);
            }
        }
        // TODO : supprimer aussi COMMANDES/CLIENTS/CONNECTEURS liés à cette boutique
    } catch (err) {
        console.error("❌ shop/redact :", err.response?.data || err.message);
    }
});

module.exports = router;
