const express = require("express");
const router   = express.Router();
const meta      = require("../services/meta");
const workspaceService = require("../services/workspaceService");
const notificationEngine = require("../engines/notificationEngine");
const { canActAutonomously } = require("./samii-mode");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

async function getWorkspaceOrRedirect(req, res) {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) { res.redirect("/hub"); return null; }
    const workspace = await workspaceService.getById(workspaceId);
    if (!workspace) { res.redirect("/hub"); return null; }
    return workspace;
}

router.get("/settings", requireAuth, async (req, res) => {
    const workspace = await getWorkspaceOrRedirect(req, res);
    if (!workspace) return;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Connecter Meta Ads — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .shell { max-width: 560px; margin: 0 auto; padding: 40px 24px 80px; }
        .shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.4rem; margin-bottom: 6px; }
        .shell p.sub { color: var(--text-muted); font-size: .85rem; margin-bottom: 24px; line-height: 1.6; }
        .card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; color: var(--text-muted); margin: 14px 0 6px; }
        input { width: 100%; padding: 11px 13px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: var(--text-main); font-size: .88rem; }
        input:focus { outline: none; border-color: var(--cyan-tech); }
        button { width: 100%; padding: 13px; margin-top: 18px; background: var(--gold-og); border: none; border-radius: 10px; font-weight: 700; cursor: pointer; }
        .msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #3ddc84; min-height: 20px; }
    </style>
</head>
<body>
<div class="shell">
    <h1>🔗 <span data-i18n="ads.settings.title">Connecter Meta Ads</span></h1>
    <p class="sub" data-i18n="ads.settings.subtitle">Ces identifiants sont propres à ce workspace.</p>
    <div class="card">
        <form id="form-settings">
            <label data-i18n="ads.settings.accessToken">Access Token</label>
            <input name="metaAccessToken" value="${workspace.metaAccessToken || ""}" placeholder="EAAS..." required>
            <label data-i18n="ads.settings.adAccountId">Ad Account ID</label>
            <input name="metaAdAccountId" value="${workspace.metaAdAccountId || ""}" placeholder="act_123456789" required>
            <label data-i18n="ads.settings.pageId">Page ID</label>
            <input name="metaPageId" value="${workspace.metaPageId || ""}" placeholder="110461700..." required>
            <button type="submit" data-i18n="ads.settings.save">Enregistrer</button>
        </form>
        <div class="msg" id="msg"></div>
    </div>
</div>
<script src="/js/i18n.js"></script>
<script>
document.getElementById('form-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = '⏳ Enregistrement...';
    const res = await fetch('/ads/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) {
        msg.textContent = '✅ Enregistré ! Direction la création de pub...';
        setTimeout(() => window.location.href = '/ads/create', 900);
    } else {
        msg.textContent = json.error || '❌ Erreur.';
    }
});
</script>
</body>
</html>`);
});

router.post("/settings", requireAuth, async (req, res) => {
    try {
        const workspace = await workspaceService.getById(req.session.workspaceId);
        if (!workspace) return res.json({ success: false, error: "Workspace introuvable." });

        const { metaAccessToken, metaAdAccountId, metaPageId } = req.body;

        await workspaceService.update(workspace.recordId, {
            meta_access_token : metaAccessToken || "",
            meta_ad_account_id: metaAdAccountId || "",
            meta_page_id      : metaPageId      || "",
        });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /ads/settings :", err.response?.data || err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});
router.get("/create", requireAuth, async (req, res) => {
    const workspace = await getWorkspaceOrRedirect(req, res);
    if (!workspace) return;

    if (!workspace.metaAccessToken || !workspace.metaAdAccountId || !workspace.metaPageId) {
        return res.redirect("/ads/settings");
    }

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Lancer une pub — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .ads-shell { max-width: 640px; margin: 0 auto; padding: 40px 24px 80px; }
        .ads-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .ads-back:hover { color: var(--cyan-tech); }
        .ads-hero { margin-bottom: 28px; }
        .ads-hero .qg-eyebrow { color: var(--cyan-tech); }
        .ads-hero h1 { font-family: var(--font-display); font-size: 1.6rem; color: #fff; margin-top: 8px; }
        .ads-hero p { color: var(--text-muted); font-size: .88rem; margin-top: 8px; line-height: 1.6; }
        .ads-card { background: var(--bg-glass); backdrop-filter: blur(14px); border: var(--border-soft); border-radius: 18px; padding: 28px; }
        .ads-field { margin-bottom: 18px; }
        .ads-field label { display: block; font-family: var(--font-mono); font-size: .7rem; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
        .ads-field input, .ads-field select, .ads-field textarea { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: var(--text-main); font-size: .9rem; }
        .ads-field textarea { resize: vertical; min-height: 80px; }
        .ads-field input:focus, .ads-field select:focus, .ads-field textarea:focus { outline: none; border-color: var(--cyan-tech); box-shadow: 0 0 0 3px rgba(95,212,255,0.12); }
        .ads-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .ads-submit { width: 100%; padding: 14px; margin-top: 8px; background: var(--gold-og); border: none; border-radius: 12px; font-weight: 700; font-size: .95rem; cursor: pointer; color: #000; }
        .ads-submit:hover { background: var(--gold-hover); }
        .ads-msg { margin-top: 16px; text-align: center; font-size: .85rem; color: #e55; min-height: 20px; }
        .ads-msg.ok { color: #3ddc84; }
        .ads-note { display: flex; gap: 10px; align-items: flex-start; background: rgba(95,212,255,0.06); border: 1px solid rgba(95,212,255,0.2); border-radius: 12px; padding: 14px 16px; margin-top: 24px; font-size: .8rem; color: var(--text-muted); line-height: 1.6; }
    </style>
</head>
<body>
<div class="ads-shell">
    <a href="/qg" class="ads-back" data-i18n="ads.create.back">← Retour au QG</a>
    <div class="ads-hero">
        <span class="qg-eyebrow" data-i18n="ads.create.eyebrow">Arsenal · Boost Marketing</span>
        <h1>🎯 <span data-i18n="ads.create.title">Lancer une publicité</span></h1>
        <p><span data-i18n="ads.create.connectedAccount">Compte pub connecté :</span> ${workspace.metaAdAccountId}</p>
    </div>
    <div class="ads-card">
        <form id="form-ads">
            <div class="ads-field"><label data-i18n="ads.create.campaignName">Nom de la campagne</label><input name="name" placeholder="Ex : Promo été 2026" required></div>
            <div class="ads-row">
                <div class="ads-field"><label data-i18n="ads.create.objective">Objectif</label>
                    <select name="objective">
                        <option value="OUTCOME_TRAFFIC" data-i18n="ads.create.objectiveTraffic">Trafic</option>
                        <option value="OUTCOME_ENGAGEMENT" data-i18n="ads.create.objectiveEngagement">Engagement</option>
                        <option value="OUTCOME_SALES" data-i18n="ads.create.objectiveSales">Ventes</option>
                    </select>
                </div>
                <div class="ads-field"><label data-i18n="ads.create.dailyBudget">Budget journalier (centimes)</label><input name="dailyBudgetCents" type="number" min="100" placeholder="500" required></div>
            </div>
            <div class="ads-field"><label data-i18n="ads.create.headline">Titre de l'annonce</label><input name="headline" placeholder="Ex : -20% sur toute la collection" required></div>
            <div class="ads-field"><label data-i18n="ads.create.message">Message</label><textarea name="message" required></textarea></div>
            <div class="ads-field"><label data-i18n="ads.create.imageUrl">URL de l'image</label><input name="imageUrl" type="url" required></div>
            <div class="ads-field"><label data-i18n="ads.create.link">Lien vers ta boutique/produit</label><input name="link" type="url" required></div>
            <button type="submit" class="ads-submit" data-i18n="ads.create.submit">Créer la campagne</button>
        </form>
        <div class="ads-msg" id="msg"></div>
    </div>
    <div class="ads-note" data-i18n="ads.create.note">ℹ️ Selon ton mode SAMII actuel, la campagne peut être créée en pause ou activée directement.</div>
</div>
<script src="/js/i18n.js"></script>
<script>
document.getElementById('form-ads').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = '⏳ SAMII crée ta campagne...'; msg.className = 'ads-msg';
    const res = await fetch('/ads/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await res.json();
    if (json.success) { msg.textContent = json.message || '✅ Campagne créée.'; msg.className = 'ads-msg ok'; }
    else { msg.textContent = json.error || '❌ Erreur.'; }
});
</script>
</body>
</html>`);
});

router.post("/create", requireAuth, async (req, res) => {
    try {
        const { name, objective, headline, message, imageUrl, link, dailyBudgetCents } = req.body;
        if (!name || !headline || !message || !imageUrl || !link || !dailyBudgetCents) {
            return res.json({ success: false, error: "Tous les champs sont obligatoires." });
        }

        const workspace = await workspaceService.getById(req.session.workspaceId);
        if (!workspace) return res.json({ success: false, error: "Workspace introuvable." });

        if (!workspace.metaAccessToken || !workspace.metaAdAccountId || !workspace.metaPageId) {
            return res.json({ success: false, error: "Compte Meta non connecté. Va dans /ads/settings." });
        }

        const creds = {
            accessToken: workspace.metaAccessToken,
            adAccountId: workspace.metaAdAccountId,
            pageId     : workspace.metaPageId,
        };

        const targeting = {
            geo_locations: { countries: [workspace.pays || "DZ"] },
            age_min: 18,
            age_max: 65,
        };

        const campaign = await meta.createCampaign(creds, name, objective || "OUTCOME_TRAFFIC");
        const adSet = await meta.createAdSet(creds, campaign.id, {
            name: `${name} - Ensemble`,
            dailyBudgetCents: parseInt(dailyBudgetCents, 10),
            targeting,
            startTime: new Date().toISOString(),
        });
        const creative = await meta.createAdCreative(creds, { imageUrl, message, headline, link });
        const ad = await meta.createAd(creds, adSet.id, creative.id, `${name} - Pub`);

        const mode = workspace?.samii?.mode || "copilote";
        const wasActivated = canActAutonomously(mode);

        if (wasActivated) {
            await meta.setStatus(creds, ad.id, "ACTIVE");
            await meta.setStatus(creds, adSet.id, "ACTIVE");
            await meta.setStatus(creds, campaign.id, "ACTIVE");
        }

        const statusMessage = wasActivated
            ? `✅ Ta campagne "${name}" est en ligne ! SAMII l'a lancée automatiquement (mode ${mode}).`
            : `✅ Ta campagne "${name}" est prête !\n\nElle est en pause, va la valider dans ton Ads Manager Meta pour la lancer.`;

        if (req.session.shop) {
            try {
                await notificationEngine.send({ shop: req.session.shop, channel: "telegram", message: statusMessage });
            } catch (notifErr) {
                console.warn("⚠️ Notification pub non envoyée :", notifErr.message);
            }
        }

        res.json({ success: true, message: statusMessage, campaignId: campaign.id, adId: ad.id });

    } catch (err) {
        console.error("❌ POST /ads/create :", err.response?.data || err.message);
        res.json({ success: false, error: "Erreur lors de la création de la pub. Vérifie ta connexion Meta (/ads/settings)." });
    }
});

module.exports = router;
