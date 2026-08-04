// ==========================================================================
// OG EMPIRE — CONNEXION WOOCOMMERCE (Application Authentication — 1 clic)
// ==========================================================================
const express = require("express");
const axios   = require("axios");
const router  = express.Router();
const { registerOrderWebhook } = require("./webhook-woocommerce");

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
  <title>Connecter WooCommerce — OG Empire</title>
  <link rel="stylesheet" href="/css/hub-premium.css">
</head>
<body>
<div class="og-capital">
  <main class="capitol-content" style="display:flex;align-items:center;justify-content:center;min-height:100vh;">
    <div style="background:#111;border:1px solid #222;border-radius:16px;padding:40px;max-width:440px;width:100%;">

      <div style="text-align:center;margin-bottom:30px;">
        <div style="font-size:3rem;">🛒</div>
        <h2 style="color:#fff;margin-top:10px;">Connecter WooCommerce</h2>
        <p style="color:#666;font-size:0.85rem;margin-top:6px;">
          Entre l'adresse de ta boutique — tu seras redirigé vers ton site pour approuver en un clic.
        </p>
      </div>

      <form method="POST" action="/connect/woocommerce">
        <input type="text" name="site_url" placeholder="maboutique.com" required
               style="width:100%;padding:11px 13px;border-radius:9px;border:1px solid #222;background:#000;color:#fff;font-size:0.88rem;margin-bottom:18px;">
        <button type="submit"
                style="display:block;width:100%;padding:13px;background:#96588A;border:none;border-radius:10px;color:#fff;font-weight:700;font-size:0.95rem;cursor:pointer;">
          🛒 Connecter ma boutique
        </button>
      </form>

      <a href="/connect/tools"
         style="display:block;margin-top:20px;text-align:center;padding:13px;background:#1a1a1a;border-radius:10px;color:#fff;text-decoration:none;font-weight:600;font-size:0.9rem;">
        ← Retour à mes outils
      </a>

    </div>
  </main>
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
<head>
  <meta charset="UTF-8">
  <title>Connexion WooCommerce — OG Empire</title>
  <link rel="stylesheet" href="/css/hub-premium.css">
</head>
<body>
<div class="og-capital">
  <main class="capitol-content" style="display:flex;align-items:center;justify-content:center;min-height:100vh;">
    <div style="background:#111;border:1px solid #222;border-radius:16px;padding:40px;max-width:440px;width:100%;">

      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:3rem;">${success ? "✅" : "❌"}</div>
        <h2 style="color:${success ? "#3ddc84" : "#e55"};margin-top:10px;">
          ${success ? "Boutique connectée !" : "Connexion annulée"}
        </h2>
        <p style="color:#666;font-size:0.85rem;margin-top:6px;">
          ${success ? "WooCommerce est maintenant relié à ton QG." : "Tu peux réessayer depuis tes outils."}
        </p>
      </div>

      <a href="/connect/tools"
         style="display:block;margin-top:10px;text-align:center;padding:13px;background:#1a1a1a;border-radius:10px;color:#fff;text-decoration:none;font-weight:600;font-size:0.9rem;">
        ← Retour à mes outils
      </a>
      ${success ? `
      <a href="/qg"
         style="display:block;margin-top:10px;text-align:center;padding:13px;background:#96588A;border-radius:10px;color:#fff;text-decoration:none;font-weight:600;font-size:0.9rem;">
        Retour au QG →
      </a>` : ""}

    </div>
  </main>
</div>
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
        const siteUrl = req.body.store_url || req.body.site_url || "";

        await connectorService.save(workspaceId, "woocommerce", {
            siteUrl,
            consumerKey   : consumer_key,
            consumerSecret: consumer_secret,
            permissions   : key_permissions || "read_write",
            connectedAt   : new Date().toISOString(),
        });

        console.log(`✅ WooCommerce connecté pour workspace ${workspaceId}`);

        if (siteUrl) {
            await registerOrderWebhook(siteUrl, consumer_key, consumer_secret);
        }

        res.status(200).json({ success: true });

    } catch (err) {
        console.error("❌ Callback WooCommerce :", err.message);
        res.status(500).json({ error: "Erreur serveur." });
    }
});

module.exports = router;
