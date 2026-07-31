// ==========================================================================
// SAMII OS — CLIENT : TRANSPORT — Bus, train, TGV, métro
// ==========================================================================
const express = require("express");
const router  = express.Router();
const gemini  = require("../services/geminiService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/", requireAuth, (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Transport — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/client-style.css">
    <style>
        .tr-shell { max-width: 700px; margin: 0 auto; padding: 40px 24px 80px; }
        .tr-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .tr-back:hover { color: var(--cyan-tech); }

        .tr-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .tr-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(157,92,255,0.25), rgba(95,212,255,0.08));
            border: 1px solid rgba(157,92,255,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
        }
        .tr-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .tr-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 22px; line-height: 1.6; }

        .tr-types { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
        .tr-type-btn {
            display: flex; flex-direction: column; align-items: center; gap: 6px;
            padding: 14px 6px; border-radius: 12px;
            background: var(--bg-panel); border: 1px solid rgba(255,255,255,0.08);
            color: var(--text-muted); cursor: pointer; text-align: center; font-family: var(--font-body);
            transition: all .2s ease;
        }
        .tr-type-btn .icon { font-size: 1.3rem; }
        .tr-type-btn .label { font-weight: 700; color: var(--text-main); font-size: .74rem; }
        .tr-type-btn.active { border-color: var(--violet, #9d5cff); background: rgba(157,92,255,0.08); box-shadow: 0 0 18px rgba(157,92,255,0.15); }
        .tr-type-btn.active .label { color: var(--violet, #9d5cff); }

        .tr-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 14px 0 6px; }
        input, select {
            width: 100%; padding: 11px 13px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem; font-family: var(--font-body);
        }
        select option { background: #0d0a1a; }
        input:focus, select:focus { outline: none; border-color: var(--cyan-tech); box-shadow: 0 0 0 3px rgba(95,212,255,0.15); }
        .tr-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        button.tr-submit {
            width: 100%; padding: 14px; margin-top: 18px;
            background: linear-gradient(135deg, #9d5cff, #b47fff);
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #fff; font-size: .95rem;
        }
        button.tr-submit:disabled { opacity: .6; cursor: not-allowed; }
        .tr-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }

        .tr-results { margin-top: 26px; display: none; flex-direction: column; gap: 14px; }
        .tr-result-card {
            background: var(--bg-panel); border: 1px solid rgba(157,92,255,0.2);
            border-radius: 14px; padding: 18px 20px; color: var(--text-main); font-size: .87rem; line-height: 1.7;
            white-space: pre-wrap;
        }
        .tr-sources { font-size: .78rem; color: var(--text-muted); }
    </style>
</head>
<body>
<div class="tr-shell">
    <a href="/client-qg" class="tr-back">← Retour à mon espace</a>

    <div class="tr-title">
        <div class="tr-icon-box">🚌</div>
        <h1>Transport</h1>
    </div>
    <p class="sub">Choisis ton pays et ton moyen de transport — SAMII cherche les infos pour toi.</p>

    <div class="tr-types" id="tr-types">
        <button type="button" class="tr-type-btn active" data-type="bus">
            <span class="icon">🚌</span><span class="label">Bus</span>
        </button>
        <button type="button" class="tr-type-btn" data-type="train">
            <span class="icon">🚆</span><span class="label">Train</span>
        </button>
        <button type="button" class="tr-type-btn" data-type="tgv">
            <span class="icon">⚡</span><span class="label">TGV</span>
        </button>
        <button type="button" class="tr-type-btn" data-type="metro">
            <span class="icon">🚇</span><span class="label">Métro/Tram</span>
        </button>
    </div>

    <div class="tr-card">
        <form id="form-tr">
            <input type="hidden" name="type" id="input-type" value="bus">

            <label>Pays</label>
            <select name="pays">
                <option value="DZ">Algérie</option>
                <option value="MA">Maroc</option>
                <option value="TN">Tunisie</option>
                <option value="FR">France</option>
                <option value="BE">Belgique</option>
                <option value="CA">Canada</option>
            </select>

            <div class="tr-row">
                <div>
                    <label>Ville de départ</label>
                    <input name="depart" placeholder="Ex : Alger" required>
                </div>
                <div>
                    <label>Ville d'arrivée (optionnel)</label>
                    <input name="arrivee" placeholder="Ex : Oran">
                </div>
            </div>

            <button type="submit" class="tr-submit">🚌 Chercher</button>
        </form>
        <div class="tr-msg" id="msg"></div>
    </div>

    <div class="tr-results" id="results">
        <div class="tr-result-card" id="result-content"></div>
        <div class="tr-sources" id="sources"></div>
    </div>
</div>

<script>
let currentType = 'bus';
document.querySelectorAll('.tr-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tr-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.dataset.type;
        document.getElementById('input-type').value = currentType;
    });
});

document.getElementById('form-tr').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg     = document.getElementById('msg');
    const results = document.getElementById('results');
    const btn     = e.target.querySelector('button');
    const data    = Object.fromEntries(new FormData(e.target));

    btn.disabled = true;
    msg.textContent = '🚌 SAMII cherche les infos...';
    results.style.display = 'none';

    try {
        const res  = await fetch('/client-qg/transport/chercher', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const json = await res.json();

        if (json.success) {
            msg.textContent = '';
            document.getElementById('result-content').textContent = json.reponse;
            const srcEl = document.getElementById('sources');
            srcEl.innerHTML = (json.sources || []).length
                ? '🔗 ' + json.sources.map(s => \`<a href="\${s.uri}" target="_blank" style="color:var(--cyan-tech);text-decoration:none;">\${s.title}</a>\`).join(' · ')
                : '';
            results.style.display = 'flex';
        } else {
            msg.textContent = json.error || '❌ Erreur. Réessaie.';
        }
    } catch (err) {
        msg.textContent = '❌ Erreur réseau.';
    } finally {
        btn.disabled = false;
    }
});
</script>
</body>
</html>`);
});

router.post("/chercher", requireAuth, async (req, res) => {
    try {
        const { type, pays, depart, arrivee } = req.body;
        if (!depart) return res.json({ success: false, error: "Indique ta ville de départ." });

        const typesLabel = {
            bus: "bus", train: "train", tgv: "TGV / train à grande vitesse", metro: "métro ou tramway",
        };

        const prompt = "Tu es SAMII, assistant transport pour un particulier.\n\n"
            + `Type de transport : ${typesLabel[type] || "transport"}\n`
            + `Pays : ${pays}\n`
            + `Départ : ${depart}\n`
            + (arrivee ? `Arrivée : ${arrivee}\n` : "")
            + "\nUtilise la recherche web pour trouver des informations concrètes et actuelles : horaires probables, fréquence, prix approximatif, opérateur/compagnie officielle si connue. Réponds directement, en 4-6 lignes claires, sans JSON ni markdown.";

        const result = await gemini.chatWithSearch({
            message: prompt,
            context: { source: "client_transport" },
        });

        res.json({
            success: true,
            reponse: result.text,
            sources: result.sources || [],
        });

    } catch (err) {
        console.error("❌ POST /client-qg/transport/chercher :", err.message);
        res.json({ success: false, error: "Erreur lors de la recherche. Réessaie." });
    }
});

module.exports = router;
