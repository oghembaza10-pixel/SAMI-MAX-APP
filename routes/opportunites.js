// ==========================================================================
// SAMII OS — RADAR OPPORTUNITÉS (T-023)
// Analyse de tendances produits, sans recherche web live (Option A).
// ==========================================================================
const express = require("express");
const router  = express.Router();
const gemini  = require("../services/geminiService");
const workspaceService = require("../services/workspaceService");

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

router.get("/", requireAuth, async (req, res) => {
    const workspace = await getWorkspaceOrRedirect(req, res);
    if (!workspace) return;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Radar Opportunités — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .radar-shell { max-width: 640px; margin: 0 auto; padding: 40px 24px 80px; }
        .radar-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .radar-back:hover { color: var(--cyan-tech); }
        .radar-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.4rem; margin-bottom: 6px; }
        .radar-shell p.sub { color: var(--text-muted); font-size: .85rem; margin-bottom: 24px; line-height: 1.6; }
        .radar-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; color: var(--text-muted); margin: 14px 0 6px; }
        input, textarea { width: 100%; padding: 11px 13px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: var(--text-main); font-size: .88rem; font-family: var(--font-body); }
        textarea { resize: vertical; min-height: 70px; }
        input:focus, textarea:focus { outline: none; border-color: var(--cyan-tech); }
        button { width: 100%; padding: 13px; margin-top: 18px; background: var(--gold-og); border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000; }
        .radar-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }
        .radar-result { margin-top: 20px; padding: 18px; border-radius: 12px; background: rgba(197,160,89,0.06); border: 1px solid rgba(197,160,89,0.2); font-size: .87rem; line-height: 1.7; color: var(--text-main); white-space: pre-wrap; display: none; }
    </style>
</head>
<body>
<div class="radar-shell">
    <a href="/samii" class="radar-back">← Retour à SAMII</a>
    <h1>📡 Radar Opportunités</h1>
    <p class="sub">Dis à SAMII ce que tu vends et où tu veux vendre — il te propose des pistes concrètes.</p>
    <div class="radar-card">
        <form id="form-radar">
            <label>Qu'est-ce que tu vends (ou veux vendre) ?</label>
            <input name="produit" placeholder="Ex : vêtements, cosmétiques, électronique..." required>

            <label>Marché cible (pays / région)</label>
            <input name="marche" placeholder="Ex : Algérie, Maroc, France..." required>

            <label>Précisions supplémentaires (optionnel)</label>
            <textarea name="details" placeholder="Ex : budget limité, je vends surtout en ligne, je cible les jeunes..."></textarea>

            <button type="submit">📡 Lancer le Radar</button>
        </form>
        <div class="radar-msg" id="msg"></div>
        <div class="radar-result" id="result"></div>
    </div>
</div>
<script>
document.getElementById('form-radar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg    = document.getElementById('msg');
    const result = document.getElementById('result');
    const data   = Object.fromEntries(new FormData(e.target));

    msg.textContent = '📡 SAMII analyse les opportunités...';
    result.style.display = 'none';

    const res  = await fetch('/samii/opportunites', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const json = await res.json();

    if (json.success) {
        msg.textContent = '';
        result.textContent = json.reply;
        result.style.display = 'block';
    } else {
        msg.textContent = json.error || '❌ Erreur. Réessaie.';
    }
});
</script>
</body>
</html>`);
});

router.post("/", requireAuth, async (req, res) => {
    try {
        const { produit, marche, details } = req.body;
        if (!produit || !marche) {
            return res.json({ success: false, error: "Produit et marché sont obligatoires." });
        }

        const prompt = `Tu es SAMII, le stratège commercial de OG Empire. Un marchand te demande de repérer des opportunités produits.

Produit / secteur actuel : ${produit}
Marché cible : ${marche}
${details ? `Précisions : ${details}` : ""}

Propose 3 à 5 pistes concrètes et actionnables : produits ou variantes qui pourraient bien marcher sur ce marché, en tenant compte des tendances générales que tu connais. Sois direct, concret, pas de blabla. Format : liste courte avec pour chaque piste une phrase d'explication.`;

        const result = await gemini.chat({
            message: prompt,
            context: { source: "radar_opportunites", workspaceId: req.session.workspaceId },
            useTools: false,
        });

        const reply = result.type === "text" ? result.text : "SAMII n'a pas pu générer de réponse, réessaie.";

        res.json({ success: true, reply });

    } catch (err) {
        console.error("❌ POST /samii/opportunites :", err.message);
        res.json({ success: false, error: "Erreur lors de l'analyse. Réessaie." });
    }
});

module.exports = router;
