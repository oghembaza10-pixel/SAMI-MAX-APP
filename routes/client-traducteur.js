// ==========================================================================
// SAMII OS — CLIENT : TRADUCTEUR — n'importe quelle langue, argot inclus
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
    <title>Traducteur — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/client-style.css">
    <style>
        .tx-shell { max-width: 760px; margin: 0 auto; padding: 40px 24px 80px; }
        .tx-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .tx-back:hover { color: var(--cyan-tech); }

        .tx-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .tx-icon-box {
            width: 46px; height: 46px; border-radius: 13px;
            background: radial-gradient(circle, rgba(157,92,255,0.28), rgba(95,212,255,0.08));
            border: 1px solid rgba(157,92,255,0.45);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.35rem; flex-shrink: 0;
            box-shadow: 0 0 24px rgba(157,92,255,0.2);
        }
        .tx-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.55rem; }
        .tx-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 26px; line-height: 1.6; }

        /* ── Sélecteur de langues façon "swap" ── */
        .tx-lang-bar {
            display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
        }
        .tx-lang-select {
            flex: 1; padding: 12px 14px; border-radius: 12px;
            background: var(--bg-panel); border: 1px solid rgba(157,92,255,0.25);
            color: #fff; font-size: .88rem; font-weight: 600; cursor: pointer;
            appearance: none; text-align: center;
        }
        .tx-lang-select option { background: #0d0a1a; }
        .tx-swap-btn {
            width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
            background: rgba(157,92,255,0.12); border: 1px solid rgba(157,92,255,0.3);
            color: #9d5cff; display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: transform .3s ease;
        }
        .tx-swap-btn:hover { transform: rotate(180deg); background: rgba(157,92,255,0.2); }
        .tx-swap-btn svg { width: 18px; height: 18px; }

        /* ── Zones de texte façon carte double ── */
        .tx-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
        .tx-panel {
            position: relative;
            background: var(--bg-glass); backdrop-filter: blur(14px);
            border: var(--border-soft); border-radius: 16px; padding: 18px;
            min-height: 180px; display: flex; flex-direction: column;
            transition: border-color .3s ease;
        }
        .tx-panel:focus-within { border-color: rgba(157,92,255,0.5); box-shadow: 0 0 20px rgba(157,92,255,0.12); }
        .tx-panel textarea {
            flex: 1; background: none; border: none; outline: none; resize: none;
            color: var(--text-main); font-size: .95rem; font-family: var(--font-body); line-height: 1.6;
        }
        .tx-panel textarea::placeholder { color: var(--text-muted); }
        .tx-panel--result { background: rgba(157,92,255,0.04); }
        .tx-panel__meta { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
        .tx-charcount { font-family: var(--font-mono); font-size: .68rem; color: var(--text-muted); }
        .tx-copy-btn {
            background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
            color: var(--text-muted); font-size: .68rem; padding: 4px 10px; border-radius: 20px;
            cursor: pointer; font-family: var(--font-mono); transition: all .2s ease;
        }
        .tx-copy-btn:hover { color: var(--cyan-tech); border-color: var(--cyan-tech); }
        .tx-copy-btn.copied { color: #3ddc84; border-color: #3ddc84; }

        .tx-loading { display: none; align-items: center; gap: 8px; color: var(--text-muted); font-size: .85rem; }
        .tx-loading.active { display: flex; }
        .tx-loading .dot { width: 5px; height: 5px; border-radius: 50%; background: #9d5cff; animation: tx-bounce 1.2s infinite ease-in-out; }
        .tx-loading .dot:nth-child(2) { animation-delay: .15s; }
        .tx-loading .dot:nth-child(3) { animation-delay: .3s; }
        @keyframes tx-bounce { 0%,60%,100% { opacity:.3; transform:translateY(0);} 30% { opacity:1; transform:translateY(-4px);} }

        button.tx-submit {
            width: 100%; padding: 15px; margin-top: 6px;
            background: linear-gradient(135deg, #9d5cff, #b47fff);
            border: none; border-radius: 12px; font-weight: 700; cursor: pointer; color: #fff; font-size: .95rem;
            box-shadow: 0 8px 24px rgba(157,92,255,0.3);
            transition: transform .2s ease;
        }
        button.tx-submit:hover { transform: translateY(-1px); }
        button.tx-submit:disabled { opacity: .5; cursor: not-allowed; transform: none; }

        .tx-note {
            display: flex; gap: 10px; align-items: flex-start; margin-top: 20px;
            padding: 12px 16px; border-radius: 12px;
            background: rgba(95,212,255,0.06); border: 1px solid rgba(95,212,255,0.2);
            font-size: .78rem; color: var(--text-muted); line-height: 1.6;
        }

        @media (max-width: 600px) {
            .tx-panels { grid-template-columns: 1fr; }
            .tx-swap-btn { transform: rotate(90deg); }
            .tx-swap-btn:hover { transform: rotate(270deg); }
        }
    </style>
</head>
<body>
<div class="tx-shell">
    <a href="/client-qg" class="tx-back">← Retour à mon espace</a>

    <div class="tx-title">
        <div class="tx-icon-box">🌐</div>
        <h1>Traducteur</h1>
    </div>
    <p class="sub">Argot, jargon administratif, expressions locales — SAMII comprend tout, dans toutes les langues.</p>

    <div class="tx-lang-bar">
        <select class="tx-lang-select" id="lang-source">
            <option value="auto">🔍 Détection auto</option>
            <option value="fr">Français</option>
            <option value="ar">Arabe</option>
            <option value="en">Anglais</option>
            <option value="es">Espagnol</option>
            <option value="de">Allemand</option>
            <option value="it">Italien</option>
            <option value="zh">Chinois</option>
            <option value="tr">Turc</option>
            <option value="pt">Portugais</option>
            <option value="nl">Néerlandais</option>
        </select>

        <button type="button" class="tx-swap-btn" id="btn-swap" title="Inverser">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
            </svg>
        </button>

        <select class="tx-lang-select" id="lang-target">
            <option value="fr">Français</option>
            <option value="ar">Arabe</option>
            <option value="en" selected>Anglais</option>
            <option value="es">Espagnol</option>
            <option value="de">Allemand</option>
            <option value="it">Italien</option>
            <option value="zh">Chinois</option>
            <option value="tr">Turc</option>
            <option value="pt">Portugais</option>
            <option value="nl">Néerlandais</option>
        </select>
    </div>

    <div class="tx-panels">
        <div class="tx-panel">
            <textarea id="texte-source" placeholder="Écris ou colle ton texte ici — même de l'argot, ça marche." maxlength="1000"></textarea>
            <div class="tx-panel__meta">
                <span class="tx-charcount" id="charcount">0 / 1000</span>
            </div>
        </div>
        <div class="tx-panel tx-panel--result">
            <textarea id="texte-resultat" placeholder="La traduction apparaîtra ici..." readonly></textarea>
            <div class="tx-panel__meta">
                <div class="tx-loading" id="tx-loading">
                    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                </div>
                <button type="button" class="tx-copy-btn" id="btn-copy">Copier</button>
            </div>
        </div>
    </div>

    <button type="button" class="tx-submit" id="btn-traduire">🌐 Traduire</button>

    <div class="tx-note">
        💡 Fonctionne aussi pour du langage familier, des termes juridiques ou administratifs — décris le contexte si besoin (ex: "c'est un terme médical").
    </div>
</div>

<script>
const langNoms = {
    fr: 'Français', ar: 'Arabe', en: 'Anglais', es: 'Espagnol', de: 'Allemand',
    it: 'Italien', zh: 'Chinois', tr: 'Turc', pt: 'Portugais', nl: 'Néerlandais', auto: 'Détection auto'
};

const texteSource   = document.getElementById('texte-source');
const texteResultat = document.getElementById('texte-resultat');
const charcount     = document.getElementById('charcount');
const langSource    = document.getElementById('lang-source');
const langTarget    = document.getElementById('lang-target');
const btnSwap       = document.getElementById('btn-swap');
const btnTraduire   = document.getElementById('btn-traduire');
const btnCopy       = document.getElementById('btn-copy');
const loadingEl     = document.getElementById('tx-loading');

texteSource.addEventListener('input', () => {
    charcount.textContent = texteSource.value.length + ' / 1000';
});

btnSwap.addEventListener('click', () => {
    if (langSource.value === 'auto') return;
    const tmp = langSource.value;
    langSource.value = langTarget.value;
    langTarget.value = tmp;

    const tmpText = texteSource.value;
    texteSource.value = texteResultat.value;
    texteResultat.value = tmpText;
    charcount.textContent = texteSource.value.length + ' / 1000';
});

btnTraduire.addEventListener('click', async () => {
    const texte = texteSource.value.trim();
    if (!texte) return;

    btnTraduire.disabled = true;
    loadingEl.classList.add('active');
    texteResultat.value = '';

    try {
        const res = await fetch('/client-qg/traducteur/traduire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                texte,
                langueSource: langSource.value,
                langueCible: langTarget.value,
            }),
        });
        const json = await res.json();

        if (json.success) {
            texteResultat.value = json.traduction;
        } else {
            texteResultat.value = '❌ ' + (json.error || 'Erreur de traduction.');
        }
    } catch (err) {
        texteResultat.value = '❌ Erreur réseau.';
    } finally {
        btnTraduire.disabled = false;
        loadingEl.classList.remove('active');
    }
});

btnCopy.addEventListener('click', () => {
    if (!texteResultat.value) return;
    navigator.clipboard.writeText(texteResultat.value).then(() => {
        const original = btnCopy.textContent;
        btnCopy.textContent = '✅ Copié';
        btnCopy.classList.add('copied');
        setTimeout(() => { btnCopy.textContent = original; btnCopy.classList.remove('copied'); }, 1800);
    });
});
</script>
</body>
</html>`);
});

router.post("/traduire", requireAuth, async (req, res) => {
    try {
        const { texte, langueSource, langueCible } = req.body;
        if (!texte || !texte.trim()) {
            return res.json({ success: false, error: "Écris un texte à traduire." });
        }

        const langNoms = {
            fr: "français", ar: "arabe", en: "anglais", es: "espagnol", de: "allemand",
            it: "italien", zh: "chinois", tr: "turc", pt: "portugais", nl: "néerlandais", auto: "détectée automatiquement",
        };

        const prompt = "Tu es un traducteur expert. Traduis le texte suivant.\n\n"
            + `Langue source : ${langueSource === "auto" ? "à détecter automatiquement" : langNoms[langueSource] || langueSource}\n`
            + `Langue cible : ${langNoms[langueCible] || langueCible}\n\n`
            + `Texte : "${texte}"\n\n`
            + "Comprends aussi l'argot, le langage familier, les termes administratifs ou juridiques, les abréviations courantes. "
            + "Réponds UNIQUEMENT avec la traduction, sans explication, sans guillemets, sans préambule.";

        const result = await gemini.chat({
            message: prompt,
            context: { source: "client_traducteur" },
            useTools: false,
        });

        const traduction = result.type === "text" ? result.text.trim() : null;

        if (!traduction) {
            return res.json({ success: false, error: "SAMII n'a pas pu traduire. Réessaie." });
        }

        res.json({ success: true, traduction });

    } catch (err) {
        console.error("❌ POST /client-qg/traducteur/traduire :", err.message);
        res.json({ success: false, error: "Erreur lors de la traduction. Réessaie." });
    }
});

module.exports = router;
