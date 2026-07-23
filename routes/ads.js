// ==========================================================================
// SAMII OS — ROUTE : LANCER UNE PUB (utilise services/meta.js)
// ==========================================================================
// V2 : habillage premium (même style que le QG), + notification au
// commerçant dès que la campagne est créée.
// ==========================================================================
const { canActAutonomously } = require("./samii-mode");
const express = require("express");
const router   = express.Router();
const meta      = require("../services/meta");
const workspaceService = require("../services/workspaceService");

// TODO : adapte le nom exact si ton NotificationEngine expose une autre
// signature — je me base sur ce qu'on a vu dans tes logs.
const notificationEngine = require("../engines/notificationEngine");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/create", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.redirect("/hub");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Lancer une pub — SAMII</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .ads-shell { max-width: 640px; margin: 0 auto; padding: 40px 24px 80px; }
        .ads-back {
            display: inline-flex; align-items: center; gap: 6px;
            color: var(--text-muted); text-decoration: none; font-size: .82rem;
            margin-bottom: 24px; transition: color .2s ease;
        }
        .ads-back:hover { color: var(--cyan-tech); }
        .ads-hero { margin-bottom: 28px; }
        .ads-hero .qg-eyebrow { color: var(--cyan-tech); }
        .ads-hero h1 { font-family: var(--font-display); font-size: 1.6rem; color: #fff; margin-top: 8px; }
        .ads-hero p { color: var(--text-muted); font-size: .88rem; margin-top: 8px; line-height: 1.6; }
        .ads-card {
            background: var(--bg-glass); backdrop-filter: blur(14px);
            border: var(--border-soft); border-radius: 18px; padding: 28px;
        }
        .ads-field { margin-bottom: 18px; }
        .ads-field label {
            display: block; font-family: var(--font-mono); font-size: .7rem;
            letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted);
            margin-bottom: 8px;
        }
        .ads-field input, .ads-field select, .ads-field textarea {
            width: 100%; padding: 12px 14px; border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-family: var(--font-body); font-size: .9rem;
        }
        .ads-field textarea { resize: vertical; min-height: 80px; }
        .ads-field input:focus, .ads-field select:focus, .ads-field textarea:focus {
            outline: none; border-color: var(--cyan-tech);
            box-shadow: 0 0 0 3px rgba(95,212,255,0.12);
        }
        .ads-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .ads-submit {
            width: 100%; padding: 14px; margin-top: 8px;
            background: var(--gold-og); border: none; border-radius: 12px;
            font-weight: 700; font-size: .95rem; cursor: pointer; color: #000;
            transition: background .2s ease;
        }
        .ads-submit:hover { background: var(--gold-hover); }
        .ads-msg { margin-top: 16px; text-align: center; font-size: .85rem; color: #e55; min-height: 20px; }
        .ads-msg.ok { color: #3ddc84; }
        .ads-note {
            display: flex; gap: 10px; align-items: flex-start;
            background: rgba(95,212,255,0.06); border: 1px solid rgba(95,212,255,0.2);
            border-radius: 12px; padding: 14px 16px; margin-top: 24px;
            font-size: .8rem; color: var(--text-muted); line-height: 1.6;
        }
        .ads-note i { width: 18px; height: 18px; color: var(--cyan-tech); flex-shrink: 0; margin-top: 1px; }
    </style>
</head>
<body>
<div class="ads-shell">
    <a href="/qg" class="ads-back">
        <i data-lucide="arrow-left" style="width:14px;height:14px;"></i> Retour au QG
    </a>

    <div class="ads-hero">
        <span class="qg-eyebrow">Arsenal · Boost Marketing</span>
        <h1>🎯 Lancer une publicité</h1>
        <p>SAMII crée la campagne en pause — tu valides avant qu'elle parte en ligne.</p>
    </div>

    <div class="ads-card">
        <form id="form-ads">
            <div class="ads-field">
                <label>Nom de la campagne</label>
                <input name="name" placeholder="Ex : Promo été 2026" required>
            </div>
            <div class="ads-row">
                <div class="ads-field">
                    <label>Objectif</label>
                    <select name="objective">
                        <option value="OUTCOME_TRAFFIC">Trafic</option>
                        <option value="OUTCOME_ENGAGEMENT">Engagement</option>
                        <option value="OUTCOME_SALES">Ventes</option>
                    </select>
                </div>
                <div class="ads-field">
                    <label>Budget journalier (centimes)</label>
                    <input name="dailyBudgetCents" type="number" min="100" placeholder="500" required>
                </div>
            </div>
            <div class="ads-field">
                <label>Titre de l'annonce</label>
                <input name="headline" placeholder="Ex : -20% sur toute la collection" required>
            </div>
            <div class="ads-field">
                <label>Message</label>
                <textarea name="message" placeholder="Le texte de ta publicité..." required></textarea>
            </div>
            <div class="ads-field">
                <label>URL de l'image</label>
                <input name="imageUrl" type="url" placeholder="https://..." required>
            </div>
            <div class="ads-field">
                <label>Lien vers ta boutique/produit</label>
                <input name="link" type="url" placeholder="https://..." required>
            </div>
            <button type="submit" class="ads-submit">Créer la campagne (en pause)</button>
        </form>
        <div class="ads-msg" id="msg"></div>
    </div>

    <div class="ads-note">
        <i data-lucide="info"></i>
        <span>La campagne sera créée <b>en pause</b>. Va dans ton Ads Manager Meta pour la vérifier et l'activer toi-même une première fois — SAMII pourra ensuite l'ajuster automatiquement selon tes règles.</span>
    </div>
</div>

<script src="https://unpkg.com/lucide@latest"></script>
<script>
    if (typeof lucide !== "undefined") lucide.createIcons();

    document.getElementById('form-ads').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg  = document.getElementById('msg');
        const data = Object.fromEntries(new FormData(e.target));
        msg.textContent = '⏳ SAMII crée ta campagne...';
        msg.className   = 'ads-msg';

        const res  = await fetch('/ads/create', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify(data),
        });
        const json = await res.json();

        if (json.success) {
            msg.textContent = '✅ Campagne créée en pause ! Tu vas recevoir une confirmation. Vérifie-la dans Ads Manager.';
            msg.className   = 'ads-msg ok';
        } else {
            msg.textContent = json.error || '❌ Erreur. Vérifie que ton compte Meta est bien connecté.';
        }
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

        const workspaceId = req.session.workspaceId;
        const workspace    = await workspaceService.getById(workspaceId);
        const pays         = workspace?.pays || "DZ";

        const targeting = {
            geo_locations: { countries: [pays] },
            age_min      : 18,
            age_max      : 65,
        };

        const campaign = await meta.createCampaign(name, objective || "OUTCOME_TRAFFIC");

        const adSet = await meta.createAdSet(campaign.id, {
            name            : `${name} - Ensemble`,
            dailyBudgetCents: parseInt(dailyBudgetCents, 10),
            targeting,
            startTime       : new Date().toISOString(),
        });

       const creative = await meta.createAdCreative({ imageUrl, message, headline, link });
        const ad       = await meta.createAd(adSet.id, creative.id, `${name} - Pub`);

        const mode = workspace?.samii?.mode || "copilote";
        const wasActivated = canActAutonomously(mode);

        if (wasActivated) {
            await meta.setStatus(ad.id, "ACTIVE");
            await meta.setStatus(adSet.id, "ACTIVE");
            await meta.setStatus(campaign.id, "ACTIVE");
        }

        const statusMessage = wasActivated
            ? `✅ Ta campagne "${name}" est en ligne ! SAMII l'a lancée automatiquement (mode ${mode}).`
            : `✅ Ta campagne "${name}" est prête !\n\nElle est en pause, va la valider dans ton Ads Manager Meta pour la lancer.`;

        if (req.session.shop) {
            try {
                await notificationEngine.send({
                    shop   : req.session.shop,
                    channel: "telegram",
                    message: statusMessage,
                });
            } catch (notifErr) {
                console.warn("⚠️ Notification pub non envoyée :", notifErr.message);
            }
        } else {
            console.log("ℹ️ Pas de boutique Shopify liée à ce compte — notification pub ignorée.");
        }
       

        res.json({ success: true, campaignId: campaign.id, adId: ad.id });

    } catch (err) {
        console.error("❌ POST /ads/create :", err.response?.data || err.message);
        res.json({ success: false, error: "Erreur lors de la création de la pub. Vérifie ta connexion Meta." });
    }
});

module.exports = router;
