// ==========================================================================
// OG EMPIRE — CONNEXION OAUTH META (Facebook + Instagram)
// ==========================================================================
const express = require("express");
const axios = require("axios");
const CONFIG = require("../config");
const connectorService = require("../services/connectorService");
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

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/webhook/meta", (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        console.log("✅ Webhook Meta vérifié");
        res.status(200).send(challenge);
    } else {
        console.log("❌ Webhook Meta — token invalide");
        res.sendStatus(403);
    }
});

router.get("/auth/meta", requireAuth, (req, res) => {
    const authUrl =
        `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth` +
        `?client_id=${APP_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${SCOPES}` +
        `&response_type=code`;
    res.redirect(authUrl);
});

router.get("/auth/meta/callback", requireAuth, async (req, res) => {
    const { code, error, error_description } = req.query;

    if (error) {
        return res.send(`<p>Connexion annulée ou refusée : ${error_description || error}</p>`);
    }
    if (!code) {
        return res.send("<p>Code d'autorisation manquant.</p>");
    }

    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");

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

        await connectorService.save(workspaceId, "facebook", {
            accessToken,
            pages: pages.map(p => ({ id: p.id, name: p.name })),
            connectedAt: new Date().toISOString(),
        });
        await connectorService.save(workspaceId, "instagram", {
            accessToken,
            connectedAt: new Date().toISOString(),
        });

        res.redirect("/connect/tools");

    } catch (err) {
        console.error("Erreur OAuth Meta:", err.response?.data || err.message);
        res.status(500).send("Erreur lors de la connexion à Meta. Vérifie les logs serveur.");
    }
});

module.exports = router;
