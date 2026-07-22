// ==========================================================================
// OG EMPIRE — CONNEXION OAUTH SHOPIFY (multi-boutiques) V4
// ==========================================================================
// Mise à jour : Shopify exige désormais des tokens offline EXPIRANTS pour
// toute nouvelle Public App (obligatoire depuis le 1er avril 2026).
// Seul l'échange de token + le rafraîchissement changent — le reste de
// l'architecture (orchestrateur, Airtable, webhooks, sessions) est identique.
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
    "write_customers",
    "read_inventory",
    "write_inventory",
    "read_shipping",
    "write_shipping",
    "read_fulfillments",
    "write_fulfillments",
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

const airtableHeaders = () => ({
    Authorization : `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
});

// ── ✅ NOUVEAU : échange de token avec expiring=1 ────────────
async function exchangeCodeForToken(shop, code) {
    const { data } = await axios.post(`https://${shop}/admin/oauth/access_token`, {
        client_id     : API_KEY,
        client_secret : API_SECRET,
        code,
        expiring      : 1, // ✅ obligatoire depuis avril 2026 pour les Public Apps
    });
    // data contient : access_token, expires_in, refresh_token, refresh_token_expires_in
    return data;
}

// ── ✅ NOUVEAU : rafraîchir un token expiré via son refresh_token ──
async function refreshAccessToken(shop, refreshToken) {
    const { data } = await axios.post(`https://${shop}/admin/oauth/access_token`, {
        client_id     : API_KEY,
        client_secret : API_SECRET,
        refresh_token : refreshToken,
        grant_type    : "refresh_token",
    });
    return data; // nouveau access_token, expires_in, refresh_token, refresh_token_expires_in
}

// ── ✅ NOUVEAU : récupère un token TOUJOURS valide pour une boutique ──
// À utiliser partout où tu appelles l'API Shopify (services/shopify.js,
// orchestrator, webhooks qui font des appels sortants) au lieu de piocher
// l'access_token brut en base — remplace ça au fur et à mesure de ton côté,
// pas besoin de tout faire d'un coup.
async function getFreshAccessToken(shop) {
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}?filterByFormula={shop_url}="${shop}"`;
    const search    = await axios.get(searchUrl, { headers: airtableHeaders() });
    const record    = search.data.records[0];

    if (!record) throw new Error(`Boutique introuvable : ${shop}`);

    const f = record.fields;
    const expiresAt = f.token_expires_at ? new Date(f.token_expires_at) : null;
    const isExpiringSoon = !expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000; // marge 5 min

    if (!isExpiringSoon) {
        return f.access_token; // encore valide, pas besoin de rafraîchir
    }

    if (!f.refresh_token) {
        throw new Error(`Pas de refresh_token pour ${shop} — réauthentification nécessaire.`);
    }

    console.log(`🔄 Rafraîchissement du token Shopify pour ${shop}...`);
    const refreshed = await refreshAccessToken(shop, f.refresh_token);

    const newExpiresAt        = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    const newRefreshExpiresAt = new Date(Date.now() + refreshed.refresh_token_expires_in * 1000).toISOString();

    await axios.patch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}/${record.id}`,
        {
            fields: {
                access_token            : refreshed.access_token,
                refresh_token           : refreshed.refresh_token,
                token_expires_at        : newExpiresAt,
                refresh_token_expires_at: newRefreshExpiresAt,
            },
        },
        { headers: airtableHeaders() }
    );

    return refreshed.access_token;
}

// ── BLOC 1 : Upsert boutique → retourne record ───────────────
async function upsertBoutique(shop, tokenData, shopInfo) {
    const headers = airtableHeaders();

    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}?filterByFormula={shop_url}="${shop}"`;
    const search    = await axios.get(searchUrl, { headers });
    const record    = search.data.records[0];

    const tokenExpiresAt        = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    const refreshTokenExpiresAt = new Date(Date.now() + tokenData.refresh_token_expires_in * 1000).toISOString();

    const fields = {
        access_token            : tokenData.access_token,
        refresh_token           : tokenData.refresh_token,           // ✅ nouveau
        token_expires_at        : tokenExpiresAt,                    // ✅ nouveau
        refresh_token_expires_at: refreshTokenExpiresAt,              // ✅ nouveau
        status                  : "actif",
        date_connexion          : new Date().toISOString().split("T")[0],
        webhooks_actifs         : false,
        nom_boutique            : shopInfo?.name    || shop,
        email                   : shopInfo?.email   || "",
        devise                  : shopInfo?.currency || "",
        pays                    : shopInfo?.country  || "",
        timezone                : shopInfo?.iana_timezone || "",
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
    const headers = airtableHeaders();

    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}?filterByFormula={shop_url}="${shop}"`;
    const search = await axios.get(searchUrl, { headers });
    const record = search.data.records[0];

    if (record) {
        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}/${record.id}`,
            {
                fields: {
                    derniere_connexion: new Date().toISOString().split("T")[0],
                    actif: true,
                },
            },
            { headers }
        );

        console.log(`🔄 Utilisateur mis à jour : ${shop}`);
        return record.id;

    } else {

        const created = await axios.post(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}`,
            {
                fields: {
                    shop_url: shop,
                    email: email || "",
                    role: "owner",
                    derniere_connexion: new Date().toISOString().split("T")[0],
                    actif: true,
                },
            },
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
        "orders/fulfilled",
        "orders/cancelled",
        "customers/create",
        "customers/update",
        "products/update",
        "inventory_levels/update",
        "fulfillments/create",
        "app/uninstalled"
    ];

    for (const topic of webhooks) {
        try {
            await axios.post(
                `https://${shop}/admin/api/2026-07/webhooks.json`,
                {
                    webhook: {
                        topic,
                        address: `${APP_URL}/webhook`,
                        format: "json",
                    },
                },
                {
                    headers: {
                        "X-Shopify-Access-Token": accessToken,
                        "Content-Type": "application/json",
                    },
                }
            );

            console.log(`✅ Webhook enregistré : ${topic}`);

        } catch (err) {
            console.warn(`⚠️ Webhook ${topic} :`, err.response?.data || err.message);
        }
    }

    const headers   = airtableHeaders();
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
        // ✅ Échange du code contre un token EXPIRANT (nouvelle exigence Shopify)
        const tokenData = await exchangeCodeForToken(shop, code);

        // Infos boutique Shopify
        const shopRes  = await axios.get(`https://${shop}/admin/api/2026-07/shop.json`, {
            headers: { "X-Shopify-Access-Token": tokenData.access_token }
        });
        const shopInfo = shopRes.data.shop;

        // Upsert boutique (stocke maintenant access_token + refresh_token + expirations)
        const boutique = await upsertBoutique(shop, tokenData, shopInfo);
        await upsertUser(shop, shopInfo.email);
        await registerWebhooks(shop, tokenData.access_token);

        // Orchestrateur SAMII — inchangé
        await orchestrator.process({
            type   : "shop.connected",
            shop,
            payload: { accessToken: tokenData.access_token, scopes: SCOPES },
        });

        // Session sécurisée — inchangée
        req.session.regenerate((err) => {
            if (err) {
                console.error("❌ Session regenerate :", err.message);
                return res.status(500).send("Erreur session.");
            }

            req.session.loggedIn = true;
            req.session.shop = shop;
            req.session.boutiqueId = boutique.id;
            req.session.workspaceId = boutique.id;

            req.session.save((err) => {
                if (err) {
                    console.error("❌ Session save :", err.message);
                    return res.status(500).send("Erreur session.");
                }

                return res.redirect("/qg");
            });
        });

    } catch (err) {
        console.error("❌ Erreur OAuth:", err.response?.data || err.message);
        res.status(500).send("Erreur connexion Shopify. Vérifie les logs.");
    }
});

module.exports = router;
module.exports.getFreshAccessToken = getFreshAccessToken; // ✅ exporté pour être utilisé ailleurs
