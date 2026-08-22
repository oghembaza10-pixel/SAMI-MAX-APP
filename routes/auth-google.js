// ==========================================================================
// OG TECHNOLOGY — CONNEXION OAUTH GOOGLE (Gmail, Calendar, Drive, YouTube)
// Réservé aux marchands : ce sont leurs propres outils business, pas un
// canal de communication marchand↔client (contrairement à WhatsApp/
// Instagram) — même principe d'écran de consentement que routes/auth-meta.js.
// ==========================================================================
const express = require("express");
const axios = require("axios");
const CONFIG = require("../config");
const connectorService = require("../services/connectorService");
const router = express.Router();

const CLIENT_ID = CONFIG.GOOGLE.OAUTH.CLIENT_ID;
const CLIENT_SECRET = CONFIG.GOOGLE.OAUTH.CLIENT_SECRET;
const REDIRECT_URI = CONFIG.GOOGLE.OAUTH.REDIRECT_URI;

const SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/auth/google", requireAuth, (req, res) => {
    const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        // access_type=offline + prompt=consent : sans ça Google ne renvoie
        // un refresh_token qu'à la toute première autorisation d'un compte —
        // indispensable ici car l'access_token expire au bout d'1h et on
        // doit pouvoir le renouveler sans repasser par l'écran de consentement.
        `&access_type=offline` +
        `&prompt=consent`;
    res.redirect(authUrl);
});

router.get("/auth/google/callback", requireAuth, async (req, res) => {
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

        const tokenRes = await axios.post("https://oauth2.googleapis.com/token", null, {
            params: {
                code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: "authorization_code",
            },
        });
        const { access_token, refresh_token, expires_in, scope } = tokenRes.data;

        const profileRes = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const configToSave = {
            email: profileRes.data.email || "",
            identifiant: profileRes.data.email || "",
            accessToken: access_token,
            expiresAt: Date.now() + (expires_in || 3600) * 1000,
            scope: scope || "",
            connectedAt: new Date().toISOString(),
        };
        // Google ne renvoie un refresh_token que lors du tout premier
        // consentement — s'il est absent (reconnexion), on ne l'écrase pas :
        // connectorService.save() fusionne avec la config existante, donc
        // omettre la clé ici garde l'ancien refresh_token intact.
        if (refresh_token) configToSave.refreshToken = refresh_token;

        await connectorService.save(workspaceId, "google", configToSave);

        res.redirect("/connect/tools");
    } catch (err) {
        console.error("Erreur OAuth Google:", err.response?.data || err.message);
        res.status(500).send("Erreur lors de la connexion à Google. Vérifie les logs serveur.");
    }
});

module.exports = router;
