// ==========================================================================
// OG EMPIRE — CONNEXION OAUTH META (pour la démo App Review + usage réel)
// ==========================================================================

const express = require("express");
const axios = require("axios");
const CONFIG = require("../config");
const router = express.Router();

const APP_ID = CONFIG.META.APP_ID;
const APP_SECRET = CONFIG.META.APP_SECRET;
const REDIRECT_URI = CONFIG.META.REDIRECT_URI;
const GRAPH_VERSION = "v23.0";

const SCOPES = [
    "public_profile",
    "email",
    "pages_show_list",
    "business_management",
    "ads_management",
    "ads_read",
    "pages_manage_ads",
].join(",");

router.get("/auth/meta", (req, res) => {
    const authUrl =
        `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth` +
        `?client_id=${APP_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${SCOPES}` +
        `&response_type=code`;
    res.redirect(authUrl);
});

router.get("/auth/meta/callback", async (req, res) => {
    const { code, error, error_description } = req.query;

    if (error) {
        return res.send(`<p>Connexion annulée ou refusée : ${error_description || error}</p>`);
    }
    if (!code) {
        return res.send("<p>Code d'autorisation manquant.</p>");
    }

    try {
        const tokenRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`, {
            params: {
                client_id: APP_ID,
                client_secret: APP_SECRET,
                redirect_uri: REDIRECT_URI,
                code,
            },
        });
        const accessToken = tokenRes.data.access_token;

        const pagesRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`, {
            params: { access_token: accessToken },
        });
        const pages = pagesRes.data.data || [];

        const pagesList = pages.length
            ? pages.map(p => `<li>${p.name} <span style="color:#888">(id: ${p.id})</span></li>`).join("")
            : "<li>Aucune Page trouvée sur ce compte.</li>";

        res.send(`
            <html>
            <head><meta charset="UTF-8"><title>Connexion Meta réussie</title></head>
            <body style="background:#050505;color:#e8e4d8;font-family:Arial,sans-serif;padding:40px;">
                <h1 style="color:#C5A059;">✅ Connexion Meta réussie</h1>
                <p>Voici les Pages Facebook associées à ce compte :</p>
                <ul>${pagesList}</ul>
                <p><a href="/hub" style="color:#5FD4FF;">Retour au Hub</a></p>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("Erreur OAuth Meta:", err.response?.data || err.message);
        res.status(500).send("Erreur lors de la connexion à Meta. Vérifie les logs serveur.");
    }
});

module.exports = router;
