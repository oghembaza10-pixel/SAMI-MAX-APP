// ==========================================================================
// OG EMPIRE — CONNEXION OAUTH SHOPIFY (multi-boutiques) V3
// ==========================================================================

const express      = require("express");
const axios        = require("axios");
const crypto       = require("crypto");
const router       = express.Router();
const orchestrator = require("../brain/orchestrator");

const API_KEY          = process.env.SHOPIFY_API_KEY;
const API_SECRET       = process.env.SHOPIFY_API_SECRET;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_BOUTIQUES  = process.env.TABLE_BOUTIQUES;
const TABLE_USERS      = process.env.TABLE_USERS || "UTILISATEURS";

const APP_URL      = "https://samii.souverain-store.com";
const REDIRECT_URI = `${APP_URL}/auth/shopify/callback`;

const SCOPES = [
    "read_products",
    "write_products",
    "read_orders",
    "write_orders",
    "read_customers",
].join(",");

const stateStore = new Map();

// ── HMAC verification ────────────────────────────────────────
function verifyHmac(query) {
    const { hmac, signature, ...rest } = query;
    if (!hmac) return false;
    const message = Object.keys(rest)
        .sort()
        .map((key) => `${key}=${Array.isArray(rest[key]) ? rest[key].join(",") : rest[key]}`)
        .join("&");
    const generatedHash = crypto
        .createHmac("sha256", API_SECRET)
        .update(message)
        .digest("hex");
    return crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmac));
}

// ── BLOC 1 : Upsert boutique → retourne record ───────────────
async function upsertBoutique(shop, accessToken, shopInfo) {
    const headers = {
        Authorization : `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
    };

    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}?filterByFormula={shop_url}="${shop}"`;
    const search    = await axios.get(searchUrl, { headers });
    const record    = search.data.records[0];

    const fields = {
        access_token   : accessToken,
        status         : "actif",
        date_connexion : new Date().toISOString().split("T")[0],
        webhooks_actifs: false,
        nom_boutique   : shopInfo?.name   || shop,
        email          : shopInfo?.email  || "",
        devise         : shopInfo?.currency || "",
        pays           : shopInfo?.country  || "",
        timezone       : shopInfo?.iana_timezone || "",
    };

    if (record) {
        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}/${record.id}`,
            { fields },
            { headers }
        );
        console.log(`🔄 Boutique mise à jour : ${shop}`);
        return { id: record.id, isNew: false };
    } else {
        const created = await axios.post(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}`,
            { fields: { shop_url: shop, scopes: SCOPES, ...fields }},
            { headers }
        );
        console.log(`✅ Nouvelle boutique créée : ${shop}`);
        return { id: created.data.id, isNew: true };
    }
}

// ── BLOC 2 : Upsert utilisateur ──────────────────────────────
async function upsertUser(shop, email) {
    const headers = {
        Authorization : `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
    };

    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}?filterByFormula={shop_url}="${shop}"`;
    const search    = await axios.get(searchUrl, { headers });
    const record    = search.data.records[0];

    if (record) {
        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}/${record.id}`,
            { fields: { last_login: new Date().toISOString(), actif: true }},
            { headers }
        );
        console.log(`🔄 Utilisateur mis à jour : ${shop}`);
        return record.id;
    } else {
        const created = await axios.post(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}`,
            { fields: {
                shop_url  : shop,
                email     : email || "",
                role      : "owner",
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString(),
                actif     : true,
            }},
            { headers }
        );
        console.log(`✅ Utilisateur créé : ${shop}`);
        return created.data.id;
    }
}

// ── BLOC 3 : Enregistrer les webhooks ────────────────────────
async function registerWebhooks(shop, accessToken) {
    const webhooks = [
        "orders/create",
        "orders/updated",
        "orders/paid",
        "products/update",
        "app/uninstalled",
    ];

    for (const topic of webhooks) {
        try {
            await axios.post(
                `https://${shop}/admin/api/2024-01/webhooks.json`,
                { webhook: {
                    topic,
                    address: `${APP_URL}/webhook`,
                    format : "json",
                }},
                { headers: {
                    "X-Shopify-Access-Token": accessToken,
                    "Content-Type"          : "application/json",
                }}
            );
            console.log(`✅ Webhook enregistré : ${topic}`);
        } catch (err) {
            console.warn(`⚠️ Webhook ${topic} : ${err.response?.data?.errors || err.message}`);
        }
    }

    // Marquer webhooks_actifs = true
    const headers   = { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" };
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}?filterByFormula={shop_url}="${shop}"`;
    const search    = await axios.get(searchUrl, { headers });
    const recordId  = search.data.records[0]?.id;
    if (recordId) {
        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}/${recordId}`,
            { fields: { webhooks_actifs: true }},
            { headers }
        );
    }
}

// ── ROUTE 1 : Lancer l'OAuth ─────────────────────────────────
router.get("/auth/shopify", (req, res) => {
    const { shop } = req.query;
    if (!shop || !shop.match(/^[a-zA-Z0-9-]+\.myshopify\.com$/)) {
        return res.status(400).send('Paramètre "shop" manquant ou invalide.');
    }

    const state = crypto.randomBytes(16).toString("hex");
    stateStore.set(shop, state);

    const installUrl =
        `https://${shop}/admin/oauth/authorize` +
        `?client_id=${API_KEY}` +
        `&scope=${SCOPES}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&state=${state}`;

    res.redirect(installUrl);
});

// ── ROUTE 2 : Callback OAuth ─────────────────────────────────
router.get("/auth/shopify/callback", async (req, res) => {
    const { shop, code, state } = req.query;

    if (!shop || !code) return res.status(400).send("Paramètres manquants.");

    const savedState = stateStore.get(shop);
    if (!savedState || state !== savedState) {
        return res.status(403).send("State invalide — tentative CSRF détectée.");
    }
    stateStore.delete(shop);

    if (!verifyHmac(req.query)) return res.status(401).send("Signature invalide.");

    try {
        // Token Shopify
        const tokenRes    = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id    : API_KEY,
            client_secret: API_SECRET,
            code,
        });
        const accessToken = tokenRes.data.access_token;

        // Infos boutique Shopify
        const shopRes  = await axios.get(`https://${shop}/admin/api/2024-01/shop.json`, {
            headers: { "X-Shopify-Access-Token": accessToken }
        });
        const shopInfo = shopRes.data.shop;

        // Upsert boutique + utilisateur
        const boutique = await upsertBoutique(shop, accessToken, shopInfo);
        await upsertUser(shop, shopInfo.email);

        // Webhooks
        await registerWebhooks(shop, accessToken);

        // Orchestrateur SAMII
        await orchestrator.process({
            type   : "shop.connected",
            shop,
            payload: { accessToken, scopes: SCOPES },
        });

        // Session ✅ sans accessToken
        req.session.loggedIn   = true;
        req.session.shop       = shop;
        req.session.boutiqueId = boutique.id;

        // Redirect QG
        res.redirect("/qg/ecommerce");

    } catch (err) {
        console.error("❌ Erreur OAuth:", err.response?.data || err.message);
        res.status(500).send("Erreur connexion Shopify. Vérifie les logs.");
    }
});

module.exports = router;


