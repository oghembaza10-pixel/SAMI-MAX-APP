// ==========================================================================
// OG EMPIRE — CONNEXION WOOCOMMERCE (Application Authentication — 1 clic)
// ==========================================================================
const express = require("express");
const axios   = require("axios");
const router  = express.Router();

const APP_URL = "https://samii.souverain-store.com";

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/connect/woocommerce", requireAuth, (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Connecter WooCommerce — SAMII</title>
    <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#0b0b0b;font-family:Arial;display:flex;justify-content:center;align-items:center;min-height:100vh;color:white;padding:20px;}
        .box{width:100%;max-width:420px;background:#181818;padding:35px;border-radius:14px;border:1px solid #333;text-align:center;}
        h1{color:#96588a;margin-bottom:8px;font-size:1.4rem;}
        p{color:#888;font-size:0.85rem;margin-bottom:24px;}
        input{width:100%;padding:12px;border:1px solid #333;border-radius:8px;background:#111;color:white;font-size:0.95rem;margin-bottom:16px;}
        input:focus{outline:none;border-color:#96588a;}
        button{width:100%;padding:13px;background:#96588a;border:none;border-radius:8px;font-weight:bold;font-size:1rem;cursor:pointer;color:#fff;}
    </style>
</head>
<body>
<div class="box">
    <h1>🛒 Connecter WooCommerce</h1>
    <p>Entre l'adresse de ta boutique — tu seras redirigé vers ton site pour approuver en un clic.</p>
    <form method="POST" action="/connect/woocommerce">
        <input type="text" name="site_url" placeholder="maboutique.com" required>
        <button type="submit">Connecter ma boutique</button>
    </form>
</div>
</body>
</html>`);
});

router.post("/connect/woocommerce", requireAuth, (req, res) => {
    let siteUrl = (req.body.site_url || "").trim();
    if (!siteUrl) return res.redirect("/connect/woocommerce");

    if (!siteUrl.startsWith("http")) siteUrl = `https://${siteUrl}`;
    siteUrl = siteUrl.replace(/\/$/, "");

    const workspaceId = req.session.workspaceId;

    const params = new URLSearchParams({
        app_name    : "SAMII OS",
        scope       : "read_write",
        user_id     : workspaceId,
        return_url  : `${APP_URL}/auth/woocommerce/return`,
        callback_url: `${APP_URL}/auth/woocommerce/callback`,
    });

    req.session.pendingWooSite = siteUrl;

    res.redirect(`${siteUrl}/wc-auth/v1/authorize?${params.toString()}`);
});

router.get("/auth/woocommerce/return", requireAuth, (req, res) => {
    const success = req.query.success === "1";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Connexion WooCommerce</title></head>
<body style="background:#050505;color:#e8e4d8;font-family:Arial;padding:40px;text-align:center;">
    ${success
        ? `<h1 style="color:#3ddc84;">✅ Boutique connectée !</h1><p>WooCommerce est maintenant relié à ton QG.</p>`
        : `<h1 style="color:#e74c3c;">❌ Connexion annulée</h1><p>Tu peux réessayer depuis ton QG.</p>`
    }
    <p style="margin-top:20px;"><a href="/qg" style="color:#5FD4FF;">Retour au QG</a></p>
</body>
</html>`);
});

router.post("/auth/woocommerce/callback", express.json(), async (req, res) => {
    try {
        const { key_id, user_id, consumer_key, consumer_secret, key_permissions } = req.body;
        const workspaceId = user_id;

        if (!workspaceId || !consumer_key || !consumer_secret) {
            console.error("❌ Callback WooCommerce incomplet :", req.body);
            return res.status(400).json({ error: "Données manquantes." });
        }

        const connectorService = require("../services/connectorService");
        await connectorService.save(workspaceId, "woocommerce", {
            consumerKey   : consumer_key,
            consumerSecret: consumer_secret,
            permissions   : key_permissions || "read_write",
            connectedAt   : new Date().toISOString(),
        });

        console.log(`✅ WooCommerce connecté pour workspace ${workspaceId}`);
        res.status(200).json({ success: true });

    } catch (err) {
        console.error("❌ Callback WooCommerce :", err.message);
        res.status(500).json({ error: "Erreur serveur." });
    }
});

module.exports = router;
