// ==========================================================================
// OG EMPIRE — CONNEXION OAUTH SHOPIFY (multi-boutiques)
// ==========================================================================

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const router = express.Router();

const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;
const APP_URL = "https://sami-max-app-1.onrender.com";
const REDIRECT_URI = `${APP_URL}/auth/shopify/callback`;

const SCOPES = [
    "read_products",
    "write_products",
    "read_orders",
    "write_orders",
    "read_customers",
].join(",");

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

router.get("/auth/shopify", (req, res) => {
    const { shop } = req.query;

    if (!shop || !shop.match(/^[a-zA-Z0-9-]+\.myshopify\.com$/)) {
        return res.status(400).send(
            'Paramètre "shop" manquant ou invalide. Utilise : /auth/shopify?shop=maboutique.myshopify.com'
        );
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

router.get("/auth/shopify/callback", async (req, res) => {
    const { shop, code } = req.query;

    if (!shop || !code) {
        return res.status(400).send("Paramètres manquants (shop ou code).");
    }

    if (!verifyHmac(req.query)) {
        return res.status(401).send("Signature invalide — requête refusée par sécurité.");
    }

    try {
        const tokenRes = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: API_KEY,
            client_secret: API_SECRET,
            code,
        });

        const accessToken = tokenRes.data.access_token;

        res.send(`
            <html>
            <head><meta charset="UTF-8"><title>Connexion Shopify réussie</title></head>
            <body style="background:#050505;color:#e8e4d8;font-family:Arial,sans-serif;padding:40px;">
                <h1 style="color:#C5A059;">✅ Boutique Shopify connectée</h1>
                <p>Boutique : <strong>${shop}</strong></p>
                <p><a href="/hub" style="color:#5FD4FF;">Retour au Hub</a></p>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("Erreur OAuth Shopify:", err.response?.data || err.message);
        res.status(500).send("Erreur lors de la connexion à Shopify. Vérifie les logs serveur.");
    }
});

module.exports = router;
