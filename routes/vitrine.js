// ==========================================================================
// SAMII OS — VITRINE — Page publique de profil (client ou marchand)
// ==========================================================================
const express = require("express");
const router  = express.Router();
const axios   = require("axios");
const airtable = require("../services/airtable");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_USERS      = process.env.TABLE_UTILISATEURS || "UTILISATEURS";

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

async function getUserById(userId) {
    const res = await axios.get(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}/${userId}`,
        { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    );
    return res.data;
}

// ── PAGE PUBLIQUE — visible par tout le monde, pas besoin d'être connecté ──
router.get("/:userId", async (req, res) => {
    try {
        const record = await getUserById(req.params.userId);
        const f = record.fields;

        let annonces = [];
        try {
            annonces = await airtable.find("ANNONCES", `{vendeur_id}="${req.params.userId}"`, 50);
        } catch (err) {
            console.warn("⚠️ Annonces vitrine :", err.message);
        }

        const annoncesHtml = annonces.map(a => `
            <div class="vt-annonce">
                <h4>${a.fields.titre}</h4>
                <p>${a.fields.description || ''}</p>
                <span class="vt-chip">💰 ${a.fields.prix || '—'}</span>
            </div>
        `).join("");

        const nomComplet = `${f.prenom || ""} ${f.nom || ""}`.trim() || "Utilisateur OG Empire";
        const initiale = nomComplet.charAt(0).toUpperCase();
        const estPremium = f.abonnement === "premium";

        res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${nomComplet} — OG Empire</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: radial-gradient(ellipse 900px 500px at 15% -5%, rgba(157,92,255,0.1), transparent 60%), #05030c;
            color: #F1F0EC; font-family: 'Inter', sans-serif; min-height: 100vh;
        }
        .vt-shell { max-width: 680px; margin: 0 auto; padding: 50px 24px 80px; }

        .vt-header { text-align: center; margin-bottom: 30px; }
        .vt-avatar {
            width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 16px;
            background: ${f.photo_profil_url ? `url('${f.photo_profil_url}') center/cover` : 'linear-gradient(135deg, #9d5cff, #5FD4FF)'};
            display: flex; align-items: center; justify-content: center;
            font-family: 'Cinzel', serif; font-size: 2.2rem; font-weight: 700; color: #fff;
            border: 3px solid rgba(157,92,255,0.4); box-shadow: 0 0 40px rgba(157,92,255,0.25);
        }
        .vt-header h1 { font-family: 'Cinzel', serif; font-size: 1.5rem; color: #fff; }
        .vt-badges { display: flex; justify-content: center; gap: 8px; margin-top: 10px; }
        .vt-badge { font-size: .7rem; padding: 4px 12px; border-radius: 20px; font-family: 'JetBrains Mono', monospace; }
        .vt-badge--premium { background: rgba(197,160,89,0.15); color: #C5A059; border: 1px solid rgba(197,160,89,0.4); }
        .vt-badge--pays { background: rgba(95,212,255,0.1); color: #5FD4FF; border: 1px solid rgba(95,212,255,0.25); }

        .vt-bio { text-align: center; color: #8b86a3; font-size: .9rem; line-height: 1.7; margin: 20px auto 0; max-width: 480px; }

        .vt-section-title {
            font-family: 'JetBrains Mono', monospace; font-size: .72rem; text-transform: uppercase; letter-spacing: .1em;
            color: #8b86a3; margin: 40px 0 16px; text-align: center;
        }
        .vt-annonces { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
        .vt-annonce { background: rgba(255,255,255,0.03); border: 1px solid rgba(157,92,255,0.2); border-radius: 14px; padding: 16px; }
        .vt-annonce h4 { color: #fff; font-size: .9rem; margin-bottom: 6px; }
        .vt-annonce p { color: #8b86a3; font-size: .78rem; line-height: 1.5; margin-bottom: 8px; }
        .vt-chip { font-size: .74rem; padding: 3px 10px; border-radius: 20px; background: rgba(95,212,255,0.08); color: #5FD4FF; }
        .vt-empty { text-align: center; color: #8b86a3; font-size: .85rem; padding: 20px; }

        .vt-footer { text-align: center; margin-top: 50px; }
        .vt-footer a { color: #9d5cff; text-decoration: none; font-family: 'JetBrains Mono', monospace; font-size: .78rem; }
    </style>
</head>
<body>
<div class="vt-shell">
    <div class="vt-header">
        <div class="vt-avatar">${!f.photo_profil_url ? initiale : ''}</div>
        <h1>${nomComplet}</h1>
        <div class="vt-badges">
            ${estPremium ? '<span class="vt-badge vt-badge--premium">👑 Premium</span>' : ''}
            ${f.pays ? `<span class="vt-badge vt-badge--pays">📍 ${f.pays}</span>` : ''}
        </div>
        ${f.bio_vitrine ? `<p class="vt-bio">${f.bio_vitrine}</p>` : ''}
    </div>

    <div class="vt-section-title">Annonces</div>
    <div class="vt-annonces">
        ${annonces.length ? annoncesHtml : '<div class="vt-empty">Aucune annonce publiée pour l\\'instant.</div>'}
    </div>

    <div class="vt-footer">
        <a href="/">⬡ OG · EMPIRE</a>
    </div>
</div>
</body>
</html>`);

    } catch (err) {
        console.error("❌ GET /vitrine/:userId :", err.message);
        res.status(404).send("Vitrine introuvable.");
    }
});

// ── FORMULAIRE PRIVÉ D'ÉDITION ──────────────────────────────
router.get("/modifier/moi", requireAuth, async (req, res) => {
    const record = await getUserById(req.session.userId);
    const f = record.fields;
    const isClient = req.session.typeCompte === "client";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Modifier ma vitrine</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${isClient ? '/css/client-style.css' : '/css/qg-style.css'}">
    <style>
        .vm-shell { max-width: 560px; margin: 0 auto; padding: 40px 24px 80px; }
        .vm-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .vm-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; margin-bottom: 24px; }
        .vm-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 14px 0 6px; }
        input, textarea, select {
            width: 100%; padding: 11px 13px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem; font-family: var(--font-body);
        }
        textarea { resize: vertical; min-height: 90px; }
        button { width: 100%; padding: 14px; margin-top: 18px; background: var(--gold-og, #9d5cff); border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000; }
        .vm-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }
        .vm-msg.ok { color: #3ddc84; }
    </style>
</head>
<body>
<div class="vm-shell">
    <a href="${isClient ? '/client-qg' : '/qg'}" class="vm-back">← Retour</a>
    <h1>✨ Modifier ma vitrine</h1>
    <div class="vm-card">
        <form id="form-vitrine">
            <label>Photo de profil (lien vers une image)</label>
            <input name="photo_profil_url" value="${f.photo_profil_url || ''}" placeholder="https://...">

            <label>Bio / présentation</label>
            <textarea name="bio_vitrine" placeholder="Parle un peu de toi ou de ton activité...">${f.bio_vitrine || ''}</textarea>

            <label>Pays</label>
            <input name="pays" value="${f.pays || ''}" placeholder="Ex : Algérie">

            <label>Langue préférée</label>
            <select name="langue_preferee">
                <option value="fr" ${f.langue_preferee === 'fr' ? 'selected' : ''}>Français</option>
                <option value="ar" ${f.langue_preferee === 'ar' ? 'selected' : ''}>Arabe</option>
                <option value="en" ${f.langue_preferee === 'en' ? 'selected' : ''}>Anglais</option>
            </select>

            <button type="submit">Enregistrer</button>
        </form>
        <div class="vm-msg" id="msg"></div>
    </div>
</div>
<script>
document.getElementById('form-vitrine').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = '⏳ Enregistrement...';
    msg.className = 'vm-msg';

    const res = await fetch('/vitrine/modifier/moi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) {
        msg.textContent = '✅ Vitrine mise à jour !';
        msg.className = 'vm-msg ok';
    } else {
        msg.textContent = json.error || '❌ Erreur.';
    }
});
</script>
</body>
</html>`);
});

router.post("/modifier/moi", requireAuth, async (req, res) => {
    try {
        const { photo_profil_url, bio_vitrine, pays, langue_preferee } = req.body;

        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}/${req.session.userId}`,
            { fields: { photo_profil_url: photo_profil_url || "", bio_vitrine: bio_vitrine || "", pays: pays || "", langue_preferee: langue_preferee || "fr" } },
            { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" } }
        );

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /vitrine/modifier/moi :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
