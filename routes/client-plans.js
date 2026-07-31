// ==========================================================================
// SAMII OS — CLIENT : MEILLEURS PLANS — surprise à chaque clic, géolocalisé
// ==========================================================================
const express = require("express");
const router  = express.Router();
const gemini  = require("../services/geminiService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const CATEGORIES = [
    { id: "weekend",  icon: "🏖️", label: "Week-end pas cher", prompt: "un week-end pas cher à faire (destination proche, hébergement abordable, activité)" },
    { id: "resto",    icon: "🍽️", label: "Bon plan resto", prompt: "un bon plan restaurant (promo, happy hour, menu abordable, nouvelle adresse qui buzz)" },
    { id: "produit",  icon: "🛍️", label: "Deal produit", prompt: "une bonne affaire ou promo sur un produit populaire du moment (tech, mode, maison)" },
    { id: "sortie",   icon: "🎉", label: "Sortie du moment", prompt: "un évènement, concert, expo ou sortie intéressante en ce moment" },
    { id: "voyage",   icon: "✈️", label: "Voyage abordable", prompt: "une destination de voyage abordable en ce moment (vol pas cher, période creuse intéressante)" },
    { id: "loisir",   icon: "🎮", label: "Loisir/Activité", prompt: "une activité de loisir intéressante et pas chère à essayer (sport, atelier, expérience)" },
];

router.get("/", requireAuth, (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Meilleurs Plans — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/client-style.css">
    <style>
        .pl-shell { max-width: 700px; margin: 0 auto; padding: 40px 24px 80px; text-align: center; }
        .pl-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; float: left; }
        .pl-back:hover { color: var(--cyan-tech); }

        .pl-title { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 6px; margin-top: 50px; }
        .pl-icon-box {
            width: 50px; height: 50px; border-radius: 15px;
            background: radial-gradient(circle, rgba(157,92,255,0.3), rgba(95,212,255,0.1));
            border: 1px solid rgba(157,92,255,0.5);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.5rem; flex-shrink: 0;
            box-shadow: 0 0 30px rgba(157,92,255,0.25);
        }
        .pl-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.6rem; }
        .pl-shell p.sub { color: var(--text-muted); font-size: .88rem; margin: 10px 0 30px; line-height: 1.6; }

        .pl-ville-wrap { max-width: 340px; margin: 0 auto 26px; }
        .pl-ville-wrap input {
            width: 100%; padding: 13px 16px; border-radius: 12px;
            border: 1px solid rgba(157,92,255,0.3); background: rgba(0,0,0,0.3);
            color: #fff; font-size: .9rem; text-align: center; font-family: var(--font-body);
        }
        .pl-ville-wrap input:focus { outline: none; border-color: var(--cyan-tech); }
        .pl-ville-label { font-family: var(--font-mono); font-size: .68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; display: block; }

        /* ── Bouton "mystère" central ── */
        .pl-mystery-btn {
            width: 200px; height: 200px; border-radius: 50%; margin: 0 auto 30px;
            background: radial-gradient(circle at 30% 30%, rgba(157,92,255,0.35), rgba(10,10,20,0.9));
            border: 2px solid rgba(157,92,255,0.5);
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
            cursor: pointer; position: relative; overflow: hidden;
            box-shadow: 0 0 50px rgba(157,92,255,0.3), inset 0 0 30px rgba(157,92,255,0.1);
            transition: transform .25s ease;
        }
        .pl-mystery-btn:hover { transform: scale(1.04); }
        .pl-mystery-btn:active { transform: scale(0.97); }
        .pl-mystery-btn .emoji { font-size: 2.8rem; animation: pl-float 3s ease-in-out infinite; }
        .pl-mystery-btn .text { font-family: var(--font-mono); font-size: .75rem; color: var(--text-muted); letter-spacing: .1em; text-transform: uppercase; }
        @keyframes pl-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

        .pl-mystery-btn.spinning { animation: pl-spin 1.2s linear infinite; }
        @keyframes pl-spin { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }

        .pl-msg { font-size: .85rem; color: #e55; min-height: 24px; }

        /* ── Carte résultat, effet reveal ── */
        .pl-result {
            display: none; text-align: left; margin-top: 30px;
            background: radial-gradient(circle at 0% 0%, rgba(157,92,255,0.1), transparent 60%), var(--bg-panel);
            border: 1px solid rgba(157,92,255,0.3); border-radius: 20px; padding: 28px;
            animation: pl-reveal .6s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes pl-reveal { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .pl-result-header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
        .pl-result-icon { font-size: 2rem; }
        .pl-result-header h2 { color: #fff; font-size: 1.15rem; font-family: var(--font-display); }
        .pl-result-ville { color: var(--cyan-tech); font-size: .78rem; font-family: var(--font-mono); margin-bottom: 16px; }
        .pl-result-body { color: var(--text-main); font-size: .9rem; line-height: 1.75; white-space: pre-wrap; }
        .pl-sources { margin-top: 16px; font-size: .78rem; color: var(--text-muted); }

        .pl-again-btn {
            display: inline-block; margin-top: 20px; padding: 11px 22px;
            background: rgba(157,92,255,0.15); border: 1px solid rgba(157,92,255,0.4);
            color: #b47fff; border-radius: 30px; cursor: pointer; font-weight: 700; font-size: .82rem;
            font-family: var(--font-body);
        }
        .pl-again-btn:hover { background: rgba(157,92,255,0.25); }
    </style>
</head>
<body>
<div class="pl-shell">
    <a href="/client-qg" class="pl-back">← Retour à mon espace</a>

    <div class="pl-title">
        <div class="pl-icon-box">🎁</div>
        <h1>Meilleurs Plans</h1>
    </div>
    <p class="sub">Une nouvelle surprise à chaque fois, adaptée à ta ville — clique et découvre.</p>

    <div class="pl-ville-wrap">
        <span class="pl-ville-label">📍 Ta ville</span>
        <input type="text" id="input-ville" placeholder="Ex : Oran">
    </div>

    <div class="pl-mystery-btn" id="btn-mystery">
        <div class="emoji" id="mystery-emoji">🎲</div>
        <div class="text" id="mystery-text">Découvrir</div>
    </div>
    <div class="pl-msg" id="msg"></div>

    <div class="pl-result" id="result">
        <div class="pl-result-header">
            <span class="pl-result-icon" id="result-icon">🎁</span>
            <h2 id="result-label"></h2>
        </div>
        <div class="pl-result-ville" id="result-ville"></div>
        <div class="pl-result-body" id="result-body"></div>
        <div class="pl-sources" id="result-sources"></div>
        <button type="button" class="pl-again-btn" id="btn-again">🔁 Une autre surprise</button>
    </div>
</div>

<script>
const mysteryBtn   = document.getElementById('btn-mystery');
const mysteryEmoji = document.getElementById('mystery-emoji');
const mysteryText  = document.getElementById('mystery-text');
const msgEl        = document.getElementById('msg');
const resultEl     = document.getElementById('result');
const btnAgain     = document.getElementById('btn-again');
const inputVille   = document.getElementById('input-ville');

const villeSauvegardee = localStorage.getItem('samii-ville');
if (villeSauvegardee) inputVille.value = villeSauvegardee;

async function decouvrir() {
    const ville = inputVille.value.trim();
    if (!ville) {
        inputVille.focus();
        msgEl.textContent = "📍 Indique ta ville d'abord.";
        return;
    }
    localStorage.setItem('samii-ville', ville);

    mysteryBtn.classList.add('spinning');
    mysteryEmoji.textContent = '✨';
    mysteryText.textContent = 'Recherche...';
    msgEl.textContent = '';
    resultEl.style.display = 'none';

    try {
        const res  = await fetch('/client-qg/plans/decouvrir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ville }),
        });
        const json = await res.json();

        mysteryBtn.classList.remove('spinning');
        mysteryEmoji.textContent = '🎲';
        mysteryText.textContent = 'Découvrir';

        if (json.success) {
            document.getElementById('result-icon').textContent = json.icon;
            document.getElementById('result-label').textContent = json.label;
            document.getElementById('result-ville').textContent = '📍 ' + ville;
            document.getElementById('result-body').textContent = json.reponse;
            const srcEl = document.getElementById('result-sources');
            srcEl.innerHTML = (json.sources || []).length
                ? '🔗 ' + json.sources.map(s => \`<a href="\${s.uri}" target="_blank" style="color:var(--cyan-tech);text-decoration:none;">\${s.title}</a>\`).join(' · ')
                : '';
            resultEl.style.display = 'block';
        } else {
            msgEl.textContent = json.error || '❌ Erreur. Réessaie.';
        }
    } catch (err) {
        mysteryBtn.classList.remove('spinning');
        mysteryEmoji.textContent = '🎲';
        mysteryText.textContent = 'Découvrir';
        msgEl.textContent = '❌ Erreur réseau.';
    }
}

mysteryBtn.addEventListener('click', decouvrir);
btnAgain.addEventListener('click', decouvrir);
</script>
</body>
</html>`);
});

router.post("/decouvrir", requireAuth, async (req, res) => {
    try {
        const { ville } = req.body;
        if (!ville) return res.json({ success: false, error: "Indique ta ville." });

        const categorie = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

        const prompt = `Tu es SAMII, tu dévoiles ${categorie.prompt} à un utilisateur situé à ${ville}.\n\n`
            + `Trouve quelque chose de pertinent PRÈS de ${ville} ou accessible depuis cette ville (pas à l'autre bout du monde, sauf pour la catégorie "voyage" où une destination lointaine mais réaliste depuis ${ville} est acceptable). `
            + "Utilise la recherche web pour trouver quelque chose de concret et actuel. "
            + "Sois enthousiaste mais reste factuel — donne un vrai nom de lieu/produit/destination si possible, un prix approximatif, et pourquoi c'est un bon plan. "
            + "4-6 lignes, direct, sans JSON ni markdown.";

        const result = await gemini.chatWithSearch({
            message: prompt,
            context: { source: "client_plans" },
        });

        res.json({
            success: true,
            icon: categorie.icon,
            label: categorie.label,
            reponse: result.text,
            sources: result.sources || [],
        });

    } catch (err) {
        console.error("❌ POST /client-qg/plans/decouvrir :", err.message);
        res.json({ success: false, error: "Erreur lors de la recherche. Réessaie." });
    }
});

module.exports = router;
