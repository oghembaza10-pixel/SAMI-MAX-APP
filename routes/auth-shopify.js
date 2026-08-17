// ==========================================================================
// OG TECHNOLOGY — CONNEXION OAUTH SHOPIFY (multi-boutiques) V7
// ==========================================================================
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const router = express.Router();
const orchestrator = require("../brain/orchestrator");
const E = require("../brain/events");
const shopifyBoutiqueService = require("../services/shopifyBoutiqueService");

const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;

// App Shopify dédiée à la boutique du fondateur (distribution personnalisée,
// pas encore soumise à review Shopify) — distincte de l'app multi-boutiques
// ci-dessus utilisée par tous les marchands de la plateforme.
const SOVEREIGN_SHOP = "lifestyle2-0-store.myshopify.com";
const SOVEREIGN_API_KEY = process.env.SHOPIFY_API_KEY2;
const SOVEREIGN_API_SECRET = process.env.SHOPIFY_API_SECRET2;

function credentialsFor(shop) {
    return shop === SOVEREIGN_SHOP
        ? { apiKey: SOVEREIGN_API_KEY, apiSecret: SOVEREIGN_API_SECRET }
        : { apiKey: API_KEY, apiSecret: API_SECRET };
}

const APP_URL = "https://samii.souverain-store.com";
const REDIRECT_URI = `${APP_URL}/auth/shopify/callback`;

const SCOPES = [
    "read_products", "write_products", "read_orders", "write_orders",
    "read_customers", "write_customers", "read_inventory", "write_inventory",
    "read_shipping", "write_shipping", "read_fulfillments", "write_fulfillments",
    // Codes de réduction limités dans le temps pour la relance panier
    // abandonné (engines/commerceEngine.js abandonedCheckout).
    "read_discounts", "write_discounts",
].join(",");

const stateStore = new Map();

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function verifyHmac(query) {
    const { hmac, signature, ...rest } = query;
    if (!hmac) return false;
    const { apiSecret } = credentialsFor(query.shop);
    const message = Object.keys(rest)
        .sort()
        .map((key) => `${key}=${Array.isArray(rest[key]) ? rest[key].join(",") : rest[key]}`)
        .join("&");
    const generatedHash = crypto.createHmac("sha256", apiSecret).update(message).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmac));
}

async function exchangeCodeForToken(shop, code) {
    const { apiKey, apiSecret } = credentialsFor(shop);
    const { data } = await axios.post(`https://${shop}/admin/oauth/access_token`, {
        client_id: apiKey, client_secret: apiSecret, code, expiring: 1,
    });
    return data;
}

async function refreshAccessToken(shop, refreshToken) {
    const { data } = await axios.post(`https://${shop}/admin/oauth/access_token`, {
        client_id: API_KEY, client_secret: API_SECRET, refresh_token: refreshToken, grant_type: "refresh_token",
    });
    return data;
}

async function getFreshAccessToken(shop) {
    const workspace = await shopifyBoutiqueService.findByShopUrl(shop);
    if (!workspace) throw new Error(`Boutique introuvable : ${shop}`);

    const expiresAt = workspace.shopify_token_expires_at ? new Date(workspace.shopify_token_expires_at) : null;
    // Un token d'app custom (connexion manuelle) n'a pas de date d'expiration : on ne
    // le considère "expirant bientôt" que s'il en a réellement une qui approche.
    const isExpiringSoon = expiresAt ? expiresAt.getTime() - Date.now() < 5 * 60 * 1000 : false;

    if (!isExpiringSoon) return workspace.shopify_access_token;
    if (!workspace.shopify_refresh_token) throw new Error(`Pas de refresh_token pour ${shop} — réauthentification nécessaire.`);

    console.log(`🔄 Rafraîchissement du token Shopify pour ${shop}...`);
    const refreshed = await refreshAccessToken(shop, workspace.shopify_refresh_token);

    await shopifyBoutiqueService.saveTokens(workspace.id, {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + refreshed.refresh_token_expires_in * 1000),
    });
    return refreshed.access_token;
}

async function registerWebhooks(shop, accessToken) {
    const webhooks = ["orders/create", "orders/updated", "orders/paid", "orders/fulfilled", "orders/cancelled", "customers/create", "customers/update", "products/update", "inventory_levels/update", "fulfillments/create", "checkouts/create", "app/uninstalled"];
    for (const topic of webhooks) {
        try {
            await axios.post(`https://${shop}/admin/api/2026-07/webhooks.json`, { webhook: { topic, address: `${APP_URL}/webhook`, format: "json" } }, { headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" } });
            console.log(`✅ Webhook enregistré : ${topic}`);
        } catch (err) {
            console.warn(`⚠️ Webhook ${topic} :`, err.response?.data || err.message);
        }
    }

    const workspace = await shopifyBoutiqueService.findByShopUrl(shop);
    if (workspace) await shopifyBoutiqueService.markWebhooksActifs(workspace.id);
}

router.get("/auth/shopify", requireAuth, (req, res) => {
    const { shop } = req.query;
    if (!shop || !shop.match(/^[a-zA-Z0-9-]+\.myshopify\.com$/)) {
        return res.status(400).send('Paramètre "shop" manquant ou invalide.');
    }
    const state = crypto.randomBytes(16).toString("hex");
    stateStore.set(shop, state);
    const { apiKey } = credentialsFor(shop);
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;
    res.redirect(installUrl);
});

router.get("/auth/shopify/callback", requireAuth, async (req, res) => {
    const { shop, code, state } = req.query;
    if (!shop || !code) return res.status(400).send("Paramètres manquants.");

    const savedState = stateStore.get(shop);
    if (!savedState || state !== savedState) return res.status(403).send("State invalide — tentative CSRF détectée.");
    stateStore.delete(shop);

    if (!verifyHmac(req.query)) return res.status(401).send("Signature invalide.");

    try {
        const tokenData = await exchangeCodeForToken(shop, code);
        const shopRes = await axios.get(`https://${shop}/admin/api/2026-07/shop.json`, { headers: { "X-Shopify-Access-Token": tokenData.access_token } });
        const shopInfo = shopRes.data.shop;

        const boutique = await shopifyBoutiqueService.upsertBoutique(shop, tokenData, shopInfo, req.session.email);
        await registerWebhooks(shop, tokenData.access_token);

        await orchestrator.process({ type: E.SHOP_CONNECTED, shop, payload: { accessToken: tokenData.access_token, scopes: SCOPES } });

        req.session.shop = shop;
        req.session.boutiqueId = boutique.id;
        req.session.workspaceId = boutique.workspaceId;

        req.session.save((err) => {
            if (err) { console.error("❌ Session save :", err.message); return res.status(500).send("Erreur session."); }
            return res.redirect("/qg");
        });

    } catch (err) {
        console.error("❌ Erreur OAuth:", err.response?.data || err.message);
        res.status(500).send("Erreur connexion Shopify. Vérifie les logs.");
    }
});

// ── CONNEXION MANUELLE PAR TOKEN (app custom, sans passer par la review Shopify) ──
router.post("/auth/shopify/token", requireAuth, async (req, res) => {
    try {
        let { shop, token } = req.body;
        shop = (shop || "").trim().toLowerCase();
        token = (token || "").trim();

        if (!shop.includes(".myshopify.com")) shop += ".myshopify.com";
        if (!shop.match(/^[a-zA-Z0-9-]+\.myshopify\.com$/)) {
            return res.json({ success: false, error: "URL de boutique invalide (ex: monshop.myshopify.com)." });
        }
        if (!token) {
            return res.json({ success: false, error: "Token manquant." });
        }

        // On vérifie que le token fonctionne vraiment avant de créer quoi que ce soit.
        let shopInfo;
        try {
            const shopRes = await axios.get(`https://${shop}/admin/api/2026-07/shop.json`, {
                headers: { "X-Shopify-Access-Token": token },
            });
            shopInfo = shopRes.data.shop;
        } catch (err) {
            const status = err.response?.status;
            if (status === 401 || status === 403) {
                return res.json({ success: false, error: "Token refusé par Shopify — vérifie qu'il est bien copié en entier et que l'app est installée." });
            }
            return res.json({ success: false, error: "Impossible de joindre cette boutique — vérifie l'URL." });
        }

        const tokenData = { access_token: token, refresh_token: null };
        const boutique = await upsertBoutique(shop, tokenData, shopInfo, req.session.email);
        await upsertUser(shop, shopInfo.email);
        await registerWebhooks(shop, token);

        await orchestrator.process({ type: E.SHOP_CONNECTED, shop, payload: { accessToken: token, scopes: "custom" } });

        req.session.shop = shop;
        req.session.boutiqueId = boutique.id;
        req.session.workspaceId = boutique.workspaceId;

        req.session.save((err) => {
            if (err) { console.error("❌ Session save :", err.message); return res.json({ success: false, error: "Erreur session." }); }
            res.json({ success: true, shop, boutique: shopInfo.name || shop });
        });

    } catch (err) {
        console.error("❌ POST /auth/shopify/token :", err.response?.data || err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
module.exports.getFreshAccessToken = getFreshAccessToken;
