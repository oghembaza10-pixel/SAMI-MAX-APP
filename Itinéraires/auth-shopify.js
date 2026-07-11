// ==========================================================================
// OG EMPIRE — CONNEXION OAUTH SHOPIFY (multi-boutiques)
// ==========================================================================

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const router = express.Router();

const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_BOUTIQUES = process.env.TABLE_BOUTIQUES;

const APP_URL = "https://sami-max-app-1.onrender.com";
const REDIRECT_URI = `${APP_URL}/auth/shopify/callback`;

const SCOPES = [
    "read_products",
    "write_products",
    "read_orders",
    "write_orders",
    "read_customers",
].join(",");

// — HMAC verification —
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

// — BLOC 1 : Sauvegarder boutique dans Airtable —
async function saveBoutiqueAirtable(shop, accessToken) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}`;
    await axios.post(url, {
        fields: {
            shop_url: shop,
            nom_boutique: shop,
            access_token: accessToken,
            scopes: SCOPES,
            status: "actif",
            date_connexion: new Date().toISOString().split("T")[0],
            webhooks_actifs: false,
        }
    }, {
        headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        }
    });
}


// — BLOC 2 : Enregistrer les webhooks automatiquement —
async function registerWebhooks(shop, accessToken) {
    const webhooks = [
        "orders/create",
        "orders/updated",
        "orders/paid",
        "products/update",
        "app/uninstalled",
    ];

    for (const topic of webhooks) {
        await axios.post(
            `https://${shop}/admin/api/2024-01/webhooks.json`,
            {
                webhook: {
                    topic,
                    address: `${APP_URL}/webhook/${topic.replace("/", "-")}`,
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
    }

    // Marquer webhooks_actifs = true dans Airtable
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}?filterByFormula={shop_url}="${shop}"`;
    const search = await axios.get(searchUrl, {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });
    const recordId = search.data.records[0]?.id;
    if (recordId) {
        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_BOUTIQUES}/${recordId}`,
            { fields: { webhooks_actifs: true } },
            { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" } }
        );
    }
}

// — ROUTE 1 : Lancer l'OAuth —
router.get("/auth/shopify", (req, res) => {
    const { shop } = req.query;
    if (!shop || !shop.match(/^[a-zA-Z0-9-]+\.myshopify\.com$/)) {
        return res.status(400).send('Paramètre "shop" manquant ou invalide.');
    }
    const state = crypto.randomBytes(16).toString("hex");
    const installUrl =
        `https://${shop}/admin/oauth/authorize` +
        `?client_id=${API_KEY}` +
        `&scope=${SCOPES}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&state=${state}`;
    res.redirect(installUrl);
});

// — ROUTE 2 : Callback OAuth —
router.get("/auth/shopify/callback", async (req, res) => {
    const { shop, code } = req.query;
    if (!shop || !code) return res.status(400).send("Paramètres manquants.");
    if (!verifyHmac(req.query)) return res.status(401).send("Signature invalide.");

    try {
        // Récupérer le token
        const tokenRes = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: API_KEY,
            client_secret: API_SECRET,
            code,
        });
        const accessToken = tokenRes.data.access_token;

        // BLOC 1 — Sauvegarder dans Airtable
        await saveBoutiqueAirtable(shop, accessToken);

        // BLOC 2 — Enregistrer les webhooks
        await registerWebhooks(shop, accessToken);

        // BLOC 3 — Redirect Hub
        res.send(`
            <html>
            <head><meta charset="UTF-8"><title>Connexion réussie</title></head>
            <body style="background:#050505;color:#e8e4d8;font-family:Arial,sans-serif;padding:40px;text-align:center;">
                <h1 style="color:#C5A059;">✅ Boutique connectée à SAMII !</h1>
                <p>Boutique : <strong>${shop}</strong></p>
                <p style="color:#aaa;">Webhooks activés automatiquement ✅</p>
                <br>
                <a href="/hub" style="background:#C5A059;color:#000;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;">
                    Retour au Hub SAMII
                </a>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("Erreur OAuth:", err.response?.data || err.message);
        res.status(500).send("Erreur connexion Shopify. Vérifie les logs.");
    }
});

module.exports = router;

