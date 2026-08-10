// ==========================================================================
// SAMII OS — ŒIL CONCURRENTIEL (T-004) — Prix marché + fournisseurs
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

function extractJson(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        return JSON.parse(match[0]);
    } catch {
        return null;
    }
}

router.get("/", requireAuth, async (req, res) => {
    const workspace = await getWorkspaceOrRedirect(req, res);
    if (!workspace) return;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Œil Concurrentiel — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .oeil-shell { max-width: 820px; margin: 0 auto; padding: 40px 24px 80px; }
        .oeil-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .oeil-back:hover { color: var(--cyan-tech); }

        .oeil-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .oeil-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(95,212,255,0.2), rgba(197,160,89,0.08));
            border: 1px solid rgba(95,212,255,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
            box-shadow: 0 0 20px rgba(95,212,255,0.18);
        }
        .oeil-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .oeil-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 20px; line-height: 1.6; }

        .oeil-note {
            display: flex; gap: 10px; align-items: flex-start;
            padding: 12px 16px; margin-bottom: 22px; border-radius: 12px;
            background: rgba(197,160,89,0.06); border: 1px solid rgba(197,160,89,0.25);
            font-size: .78rem; color: var(--text-muted); line-height: 1.6;
        }

        .oeil-mode-switch {
            display: flex; gap: 8px; margin-bottom: 20px;
            background: rgba(0,0,0,0.3); border-radius: 12px; padding: 4px;
            border: 1px solid rgba(255,255,255,0.08);
        }
        .oeil-mode-btn {
            flex: 1; padding: 10px; border-radius: 9px; border: none;
            background: transparent; color: var(--text-muted); cursor: pointer;
            font-family: var(--font-body); font-size: .82rem; font-weight: 600;
            transition: all .2s ease;
        }
        .oeil-mode-btn.active { background: var(--gold-og); color: #000; }

        .oeil-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 14px 0 6px; }
        input, textarea {
            width: 100%; padding: 11px 13px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem; font-family: var(--font-body);
            transition: border-color .25s ease, box-shadow .25s ease, background .25s ease;
        }
        textarea { resize: vertical; min-height: 70px; }
        input:focus, textarea:focus {
            outline: none; border-color: var(--cyan-tech);
            box-shadow: 0 0 0 3px rgba(95,212,255,0.15), 0 0 20px rgba(95,212,255,0.25);
            background: rgba(95,212,255,0.04);
        }
        .oeil-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .oeil-field-prix { display: block; }
        .oeil-field-prix.hidden { display: none; }
        .oeil-field-question { display: none; }
        .oeil-field-question.visible { display: block; }

        button.oeil-submit {
            width: 100%; padding: 14px; margin-top: 18px;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000; font-size: .95rem;
            transition: transform .2s ease, box-shadow .2s ease;
        }
        button.oeil-submit:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(197,160,89,0.25); }
        button.oeil-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }

        .oeil-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }

        /* ── RÉSULTATS ── */
        .oeil-results { margin-top: 28px; display: none; flex-direction: column; gap: 18px; }

        .oeil-verdict {
            padding: 18px 20px; border-radius: 14px;
            display: flex; align-items: center; gap: 14px;
        }
        .oeil-verdict--bas    { background: rgba(61,220,132,0.08); border: 1px solid rgba(61,220,132,0.3); }
        .oeil-verdict--bien   { background: rgba(95,212,255,0.08); border: 1px solid rgba(95,212,255,0.3); }
        .oeil-verdict--haut   { background: rgba(229,85,85,0.08); border: 1px solid rgba(229,85,85,0.3); }
        .oeil-verdict-icon { font-size: 1.6rem; flex-shrink: 0; }
        .oeil-verdict-text h3 { font-size: .95rem; color: #fff; margin-bottom: 3px; }
        .oeil-verdict-text p { font-size: .82rem; color: var(--text-muted); line-height: 1.5; }

        .oeil-table-title {
            display: flex; align-items: center; gap: 8px;
            font-family: var(--font-mono); font-size: .72rem; text-transform: uppercase; letter-spacing: .1em;
            color: var(--cyan-tech); margin-bottom: 4px;
        }
        .oeil-table-title::before, .oeil-table-title::after {
            content: ''; flex: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(95,212,255,0.35), transparent);
        }

        .oeil-comp-list { display: flex; flex-direction: column; gap: 10px; }
        .oeil-comp-item {
            display: flex; align-items: center; gap: 14px;
            background: var(--bg-panel); border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px; padding: 12px 16px;
            animation: oeil-fade-in .45s ease both;
        }
        @keyframes oeil-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .oeil-comp-item__name { flex: 1; min-width: 0; }
        .oeil-comp-item__name .src { color: #fff; font-size: .85rem; font-weight: 600; }
        .oeil-comp-item__name .type { color: var(--text-muted); font-size: .72rem; }
        .oeil-comp-item__price { font-family: var(--font-mono); font-weight: 700; color: var(--gold-og); font-size: .95rem; flex-shrink: 0; }
        .oeil-comp-item a { color: var(--cyan-tech); text-decoration: none; font-size: .75rem; flex-shrink: 0; }

        .oeil-reponse { color: var(--text-main); font-size: .88rem; line-height: 1.7; background: var(--bg-panel); border: 1px solid rgba(95,212,255,0.15); border-radius: 14px; padding: 18px 20px; }

        @media (max-width: 560px) {
            .oeil-row { grid-template-columns: 1fr; }
            .oeil-comp-item { flex-wrap: wrap; }
        }
    </style>
</head>
<body data-theme="og">
<div class="oeil-shell">
    <a href="/samii" class="oeil-back">← Retour à SAMII</a>

    <div class="oeil-title">
        <div class="oeil-icon-box">👁️</div>
        <h1>Œil Concurrentiel</h1>
    </div>
    <p class="sub">Compare ton prix au marché, ou pose directement une question à SAMII.</p>

    <div class="oeil-note">
        ℹ️ Les prix et fournisseurs sont des estimations basées sur des recherches web — vérifie toujours avant de contractualiser.
    </div>

    <div class="oeil-mode-switch">
        <button type="button" class="oeil-mode-btn active" data-mode="produit">📦 Analyser un produit</button>
        <button type="button" class="oeil-mode-btn" data-mode="question">💬 Poser une question</button>
    </div>

    <div class="oeil-card">
        <form id="form-oeil">
            <div id="bloc-produit">
                <label>Quel produit ?</label>
                <input name="produit" placeholder="Ex : veste d'hiver homme, coque iPhone 15...">

                <div class="oeil-row">
                    <div>
                        <label>Ton prix actuel (optionnel)</label>
                        <input name="prix_actuel" placeholder="Ex : 2500 DZD">
                    </div>
                    <div>
                        <label>Marché / pays</label>
                        <input name="marche" placeholder="Ex : Algérie">
                    </div>
                </div>
            </div>

            <div id="bloc-question" style="display:none;">
                <label>Ta question sur les prix</label>
                <textarea name="question" placeholder="Ex : est-ce que 3000 DZD est un bon prix pour des écouteurs sans fil en Algérie ?"></textarea>
            </div>

            <button type="submit" class="oeil-submit">👁️ Lancer l'analyse</button>
        </form>
        <div class="oeil-msg" id="msg"></div>
    </div>

    <div class="oeil-results" id="results">
        <div id="verdict-block"></div>
        <div id="reponse-block"></div>
        <div id="comparatif-block"></div>
        <div id="fournisseurs-block"></div>
        <div id="sources-block" style="font-size:.78rem;color:var(--text-muted);"></div>
    </div>
</div>

<script>
let currentMode = 'produit';

document.querySelectorAll('.oeil-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.oeil-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
        document.getElementById('bloc-produit').style.display = currentMode === 'produit' ? 'block' : 'none';
        document.getElementById('bloc-question').style.display = currentMode === 'question' ? 'block' : 'none';
    });
});

function verdictBlock(verdict) {
    if (!verdict) return '';
    const map = {
        bas:  { cls: 'bas',  icon: '📉', title: 'Ton prix est en dessous du marché' },
        bien: { cls: 'bien', icon: '✅', title: 'Ton prix est bien placé' },
        haut: { cls: 'haut', icon: '📈', title: 'Ton prix est au-dessus du marché' },
    };
    const v = map[verdict.statut] || map.bien;
    return \`
        <div class="oeil-verdict oeil-verdict--\${v.cls}">
            <div class="oeil-verdict-icon">\${v.icon}</div>
            <div class="oeil-verdict-text">
                <h3>\${v.title}</h3>
                <p>\${verdict.explication || ''}</p>
            </div>
        </div>
    \`;
}

function comparatifBlock(list) {
    if (!list || !list.length) return '';
    const items = list.map((c, i) => \`
        <div class="oeil-comp-item" style="animation-delay:\${i * 0.08}s">
            <div class="oeil-comp-item__name">
                <div class="src">\${c.source || 'Vendeur'}</div>
                <div class="type">\${c.type || ''}</div>
            </div>
            <div class="oeil-comp-item__price">\${c.prix || '—'}</div>
        </div>
    \`).join('');
    return \`<div><div class="oeil-table-title">Prix constatés sur le marché</div><div class="oeil-comp-list">\${items}</div></div>\`;
}

function fournisseursBlock(list) {
    if (!list || !list.length) return '';
    const items = list.map((f, i) => \`
        <div class="oeil-comp-item" style="animation-delay:\${i * 0.08}s">
            <div class="oeil-comp-item__name">
                <div class="src">\${f.nom || 'Fournisseur'}</div>
                <div class="type">\${f.origine || ''}</div>
            </div>
            <div class="oeil-comp-item__price">\${f.prix_gros || '—'}</div>
            \${f.lien ? \`<a href="\${f.lien}" target="_blank">Voir →</a>\` : ''}
        </div>
    \`).join('');
    return \`<div><div class="oeil-table-title">Fournisseurs / grossistes potentiels</div><div class="oeil-comp-list">\${items}</div></div>\`;
}

function renderSources(sources) {
    const el = document.getElementById('sources-block');
    if (!sources || !sources.length) { el.innerHTML = ''; return; }
    el.innerHTML = '🔗 Sources consultées : ' + sources.map(s =>
        \`<a href="\${s.uri}" target="_blank" style="color:var(--cyan-tech);text-decoration:none;">\${s.title}</a>\`
    ).join(' · ');
}

document.getElementById('form-oeil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg     = document.getElementById('msg');
    const results = document.getElementById('results');
    const btn     = e.target.querySelector('button');
    const data    = Object.fromEntries(new FormData(e.target));
    data.mode     = currentMode;

    btn.disabled = true;
    msg.textContent = '👁️ SAMII analyse le marché...';
    results.style.display = 'none';

    try {
        const res  = await fetch('/samii/oeil-concurrentiel', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const json = await res.json();

        if (json.success && json.data) {
            msg.textContent = '';
            document.getElementById('verdict-block').innerHTML = verdictBlock(json.data.verdict);
            document.getElementById('reponse-block').innerHTML = json.data.reponse
                ? \`<div class="oeil-reponse">\${json.data.reponse}</div>\` : '';
            document.getElementById('comparatif-block').innerHTML = comparatifBlock(json.data.comparatif);
            document.getElementById('fournisseurs-block').innerHTML = fournisseursBlock(json.data.fournisseurs);
            renderSources(json.sources || []);
            results.style.display = 'flex';
        } else {
            msg.textContent = json.error || '❌ SAMII n\\'a pas pu générer l\\'analyse. Réessaie.';
        }
    } catch (err) {
        msg.textContent = '❌ Erreur réseau. Réessaie.';
    } finally {
        btn.disabled = false;
    }
});
</script>
</body>
</html>`);
});

router.post("/", requireAuth, async (req, res) => {
    try {
        const { mode, produit, prix_actuel, marche, question } = req.body;

        let prompt;

        if (mode === "question") {
            if (!question || !question.trim()) {
                return res.json({ success: false, error: "Pose ta question." });
            }
            prompt = "Tu es SAMII, spécialiste veille concurrentielle pour OG Empire. Un marchand pose cette question sur les prix :\n\n"
                + `"${question}"\n\n`
                + "Utilise la recherche web pour répondre avec des informations concrètes et à jour.\n\n"
                + "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, dans ce format exact :\n"
                + "{\n"
                + '  "reponse": "ta réponse complète et concrète à la question",\n'
                + '  "comparatif": [\n'
                + '    { "source": "Nom du site/vendeur", "type": "Détail/gros", "prix": "montant avec devise" }\n'
                + "  ],\n"
                + '  "fournisseurs": []\n'
                + "}\n\n"
                + 'Le tableau "comparatif" peut être vide si non pertinent pour la question. Laisse "fournisseurs" vide dans ce mode.';

        } else {
            if (!produit || !produit.trim()) {
                return res.json({ success: false, error: "Indique le produit à analyser." });
            }

            const prixLigne = prix_actuel
                ? `Prix actuel du marchand : ${prix_actuel}`
                : 'Le marchand n\'a pas encore de prix, ne fais pas de verdict de comparaison, mets "verdict": null.';

            prompt = "Tu es SAMII, spécialiste veille concurrentielle pour OG Empire. Un marchand veut analyser le positionnement prix d'un produit.\n\n"
                + `Produit : ${produit}\n`
                + (marche ? `Marché : ${marche}\n` : "")
                + `${prixLigne}\n\n`
                + "Utilise la recherche web pour trouver :\n"
                + "1. Des prix constatés pour ce produit chez d'autres vendeurs/sites (comparatif détail)\n"
                + "2. Des fournisseurs ou grossistes potentiels (chinois type Alibaba/1688, ou européens), avec prix de gros estimés si trouvables\n\n"
                + "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, dans ce format exact :\n"
                + "{\n"
                + `  "verdict": ${prix_actuel ? '{ "statut": "bas|bien|haut", "explication": "phrase expliquant le positionnement par rapport au prix donné" }' : "null"},\n`
                + '  "comparatif": [\n'
                + '    { "source": "Nom du site/vendeur", "type": "Détail", "prix": "montant avec devise" }\n'
                + "  ],\n"
                + '  "fournisseurs": [\n'
                + '    { "nom": "Nom du fournisseur", "origine": "Chine / Europe / etc.", "prix_gros": "montant estimé", "lien": "URL si trouvée" }\n'
                + "  ]\n"
                + "}\n\n"
                + "Donne 3 à 5 éléments par liste quand c'est possible. Sois concret.";
        }

        const result = await gemini.chatWithSearch({
            message: prompt,
            context: { source: "oeil_concurrentiel", workspaceId: req.session.workspaceId },
        });

        const rawText = result.type === "text" ? result.text : "";
        const data = extractJson(rawText);

        if (!data) {
            return res.json({ success: false, error: "SAMII n'a pas pu structurer sa réponse. Réessaie." });
        }

        res.json({ success: true, data, sources: result.sources || [] });

    } catch (err) {
        console.error("❌ POST /samii/oeil-concurrentiel :", err.message);
        res.json({ success: false, error: "Erreur lors de l'analyse. Réessaie." });
    }
});

module.exports = router;
