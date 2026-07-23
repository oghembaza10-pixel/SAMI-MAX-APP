// ==========================================================================
// SAMII OS — ROUTE : LANCER UNE PUB (utilise services/meta.js)
// ==========================================================================
// V1 volontairement simple : objectif + créa + budget + ciblage basique
// (pays du workspace, tranche d'âge large). Le ciblage avancé (intérêts,
// audiences personnalisées) sera une V2, une fois cette base testée.
//
// La campagne est TOUJOURS créée en PAUSE — jamais activée automatiquement
// par SAMII sans validation humaine.
// ==========================================================================

const express = require("express");
const router   = express.Router();
const meta      = require("../services/meta");
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/create", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.redirect("/hub");

    const workspace = await workspaceService.getById(workspaceId);

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Lancer une pub — SAMII</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#050505; font-family:Arial,sans-serif; color:white; padding:30px 20px; max-width:520px; margin:auto; }
        h1{ color:#C5A059; font-size:1.3rem; margin-bottom:6px; }
        p.sub{ color:#86807A; font-size:.85rem; margin-bottom:24px; }
        label{ display:block; font-size:.78rem; color:#86807A; margin-top:16px; margin-bottom:6px; }
        input, select, textarea{
            width:100%; padding:11px; border:1px solid #333; border-radius:8px;
            background:#0d0d12; color:white; font-size:.9rem; font-family:inherit;
        }
        textarea{ resize:vertical; min-height:70px; }
        input:focus, select:focus, textarea:focus{ outline:none; border-color:#5FD4FF; }
        button{
            width:100%; padding:13px; margin-top:24px; background:#C5A059;
            border:none; border-radius:8px; font-weight:bold; font-size:1rem;
            cursor:pointer; color:#000;
        }
        button:hover{ opacity:.9; }
        .msg{ margin-top:14px; text-align:center; font-size:.85rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
        .note{ background:#12121a; border:1px solid rgba(197,160,89,.2); border-radius:8px; padding:12px; margin-top:20px; font-size:.78rem; color:#86807A; line-height:1.5; }
    </style>
</head>
<body>
    <h1>🎯 Lancer une publicité</h1>
    <p class="sub">SAMII crée la campagne en pause — tu valides avant qu'elle parte en ligne.</p>

    <form id="form-ads">
        <label>Nom de la campagne</label>
        <input name="name" placeholder="Ex : Promo été 2026" required>

        <label>Objectif</label>
        <select name="objective">
            <option value="OUTCOME_TRAFFIC">Trafic (visites)</option>
            <option value="OUTCOME_ENGAGEMENT">Engagement</option>
            <option value="OUTCOME_SALES">Ventes</option>
        </select>

        <label>Titre de l'annonce</label>
        <input name="headline" placeholder="Ex : -20% sur toute la collection" required>

        <label>Message</label>
        <textarea name="message" placeholder="Le texte de ta publicité..." required></textarea>

        <label>URL de l'image</label>
        <input name="imageUrl" type="url" placeholder="https://..." required>

        <label>Lien vers ta boutique/produit</label>
        <input name="link" type="url" placeholder="https://..." required>

        <label>Budget journalier (en centimes de ta devise, ex: 500 = 5.00)</label>
        <input name="dailyBudgetCents" type="number" min="100" placeholder="500" required>

        <button type="submit">Créer la campagne (en pause)</button>
    </form>

    <div class="msg" id="msg"></div>

    <div class="note">
        ℹ️ La campagne sera créée <b>en pause</b>. Va dans ton Ads Manager Meta pour vérifier
        et l'activer toi-même une première fois — SAMII pourra ensuite l'ajuster automatiquement
        selon les règles que tu définiras.
    </div>

<script>
document.getElementById('form-ads').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = '⏳ SAMII crée ta campagne...';
    msg.className   = 'msg';

    const res  = await fetch('/ads/create', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json();

    if (json.success) {
        msg.textContent = '✅ Campagne créée en pause ! Vérifie-la dans Ads Manager.';
        msg.className   = 'msg ok';
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
            geo_locations   : { countries: [pays] },
            age_min         : 18,
            age_max         : 65,
        };

        const campaign = await meta.createCampaign(name, objective || "OUTCOME_TRAFFIC");

        const adSet = await meta.createAdSet(campaign.id, {
            name            : `${name} - Ensemble`,
            dailyBudgetCents: parseInt(dailyBudgetCents, 10),
            targeting,
            startTime       : new Date().toISOString(),
        });

        const creative = await meta.createAdCreative({
            imageUrl,
            message,
            headline,
            link,
        });

        const ad = await meta.createAd(adSet.id, creative.id, `${name} - Pub`);

        res.json({
            success   : true,
            campaignId: campaign.id,
            adId      : ad.id,
        });

    } catch (err) {
        console.error("❌ POST /ads/create :", err.response?.data || err.message);
        res.json({ success: false, error: "Erreur lors de la création de la pub. Vérifie ta connexion Meta." });
    }
});

module.exports = router;
