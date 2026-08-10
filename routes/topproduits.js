// ==========================================================================
// SAMII OS — TOP PRODUITS — Top 5 du moment + Top 5 à venir, par marché
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

const DEVISES = {
    DZ: "DZD", MA: "MAD", TN: "TND", FR: "EUR", BE: "EUR",
    CA: "CAD", SN: "XOF", CI: "XOF",
};

router.get("/", requireAuth, async (req, res) => {
    const workspace = await getWorkspaceOrRedirect(req, res);
    if (!workspace) return;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Top Produits — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .top-shell { max-width: 900px; margin: 0 auto; padding: 40px 24px 80px; }
        .top-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .top-back:hover { color: var(--cyan-tech); }

        .top-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .top-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(95,212,255,0.2), rgba(197,160,89,0.08));
            border: 1px solid rgba(95,212,255,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
            box-shadow: 0 0 20px rgba(95,212,255,0.18);
        }
        .top-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .top-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 20px; line-height: 1.6; }

        .top-note {
            display: flex; gap: 10px; align-items: flex-start;
            padding: 12px 16px; margin-bottom: 22px; border-radius: 12px;
            background: rgba(197,160,89,0.06); border: 1px solid rgba(197,160,89,0.25);
            font-size: .78rem; color: var(--text-muted); line-height: 1.6;
        }

        .top-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 14px 0 6px; }
        select, input {
            width: 100%; padding: 11px 13px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem; font-family: var(--font-body);
            transition: border-color .25s ease, box-shadow .25s ease, background .25s ease;
        }
        select { cursor: pointer; }
        select option { background: #0a0d14; color: #F1F0EC; }
        select:focus, input:focus {
            outline: none; border-color: var(--cyan-tech);
            box-shadow: 0 0 0 3px rgba(95,212,255,0.15), 0 0 20px rgba(95,212,255,0.25);
            background: rgba(95,212,255,0.04);
        }
        .top-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        button.top-submit {
            width: 100%; padding: 14px; margin-top: 18px;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000; font-size: .95rem;
            transition: transform .2s ease, box-shadow .2s ease;
        }
        button.top-submit:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(197,160,89,0.25); }
        button.top-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }

        .top-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }

        /* ── RÉSULTATS ── */
        .top-results { margin-top: 30px; display: none; flex-direction: column; gap: 30px; }
        .top-section-title {
            display: flex; align-items: center; gap: 8px;
            font-family: var(--font-mono); font-size: .74rem; text-transform: uppercase; letter-spacing: .1em;
            margin-bottom: 14px;
        }
        .top-section-title--now { color: #3ddc84; }
        .top-section-title--now::before, .top-section-title--now::after { content: ''; flex: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(61,220,132,0.35), transparent); }
        .top-section-title--next { color: var(--cyan-tech); }
        .top-section-title--next::before, .top-section-title--next::after { content: ''; flex: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(95,212,255,0.35), transparent); }

        .top-list { display: flex; flex-direction: column; gap: 10px; }

        .top-item {
            position: relative;
            display: flex; align-items: center; gap: 16px;
            background: var(--bg-panel);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 14px;
            padding: 14px 18px;
            overflow: hidden;
            animation: top-fade-in .45s ease both;
        }
        @keyframes top-fade-in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }

        .top-rank {
            width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            font-family: var(--font-display); font-weight: 700; font-size: 1rem; color: #000;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
        }
        .top-item--now .top-rank { background: linear-gradient(135deg, #3ddc84, #24a85c); }
        .top-item--next .top-rank { background: linear-gradient(135deg, var(--cyan-tech), #2a8fc9); }

        .top-item__body { flex: 1; min-width: 0; }
        .top-item__body h3 { color: #fff; font-size: .92rem; font-weight: 700; margin-bottom: 2px; }
        .top-item__body p { color: var(--text-muted); font-size: .78rem; line-height: 1.5; }

        .top-item__revenue { text-align: right; flex-shrink: 0; }
        .top-item__revenue .val { font-family: var(--font-mono); font-weight: 700; font-size: 1.05rem; color: #fff; }
        .top-item__revenue .lbl { font-size: .65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }

        @media (max-width: 560px) {
            .top-row { grid-template-columns: 1fr; }
            .top-item { flex-wrap: wrap; }
            .top-item__revenue { text-align: left; margin-left: 52px; }
        }
    </style>
</head>
<body data-theme="og">
<div class="top-shell">
    <a href="/samii" class="top-back">← Retour à SAMII</a>

    <div class="top-title">
        <div class="top-icon-box">🏆</div>
        <h1>Top Produits</h1>
    </div>
    <p class="sub">Choisis ton marché — SAMII te donne le Top 5 du moment et le Top 5 de ce qui va cartonner bientôt.</p>

    <div class="top-note">
        ℹ️ Les chiffres affichés sont des <b>estimations</b> de SAMII basées sur des recherches web, pas des données de vente officielles vérifiées.
    </div>

    <div class="top-card">
        <form id="form-top">
            <div class="top-row">
                <div>
                    <label>Pays / Marché</label>
                    <select name="pays" id="select-pays">
                        <option value="DZ">Algérie</option>
                        <option value="MA">Maroc</option>
                        <option value="TN">Tunisie</option>
                        <option value="FR">France</option>
                        <option value="BE">Belgique</option>
                        <option value="CA">Canada</option>
                        <option value="SN">Sénégal</option>
                        <option value="CI">Côte d'Ivoire</option>
                    </select>
                </div>
                <div>
                    <label>Secteur (optionnel)</label>
                    <input name="secteur" placeholder="Ex : mode, électronique, beauté...">
                </div>
            </div>

            <button type="submit" class="top-submit">🏆 Voir le classement</button>
        </form>
        <div class="top-msg" id="msg"></div>
    </div>

    <div class="top-results" id="results">
        <div>
            <div class="top-section-title top-section-title--now">🔥 Top 5 du moment</div>
            <div class="top-list" id="list-now"></div>
        </div>
        <div>
            <div class="top-section-title top-section-title--next">🚀 Top 5 à venir</div>
            <div class="top-list" id="list-next"></div>
        </div>
        <div id="sources-block" style="font-size:.78rem;color:var(--text-muted);"></div>
    </div>
</div>

<script>
function renderList(containerId, items, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    items.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'top-item top-item--' + type;
        el.style.animationDelay = (i * 0.08) + 's';
        el.innerHTML = \`
            <div class="top-rank">\${i + 1}</div>
            <div class="top-item__body">
                <h3>\${item.nom || 'Produit'}</h3>
                <p>\${item.raison || ''}</p>
            </div>
            <div class="top-item__revenue">
                <div class="val">\${item.revenu_estime || '—'}</div>
                <div class="lbl">estimation</div>
            </div>
        \`;
        container.appendChild(el);
    });
}

function renderSources(sources) {
    const el = document.getElementById('sources-block');
    if (!sources || !sources.length) { el.innerHTML = ''; return; }
    el.innerHTML = '🔗 Sources consultées : ' + sources.map(s =>
        \`<a href="\${s.uri}" target="_blank" style="color:var(--cyan-tech);text-decoration:none;">\${s.title}</a>\`
    ).join(' · ');
}

document.getElementById('form-top').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg     = document.getElementById('msg');
    const results = document.getElementById('results');
    const btn     = e.target.querySelector('button');
    const data    = Object.fromEntries(new FormData(e.target));

    btn.disabled = true;
    msg.textContent = '🏆 SAMII analyse le marché...';
    results.style.display = 'none';

    try {
        const res  = await fetch('/samii/top-produits', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const json = await res.json();

        if (json.success && json.data) {
            msg.textContent = '';
            renderList('list-now', json.data.du_moment || [], 'now');
            renderList('list-next', json.data.a_venir || [], 'next');
            renderSources(json.sources || []);
            results.style.display = 'flex';
        } else {
            msg.textContent = json.error || '❌ SAMII n\\'a pas pu générer le classement. Réessaie.';
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
        const { pays, secteur } = req.body;
        if (!pays) {
            return res.json({ success: false, error: "Le pays est obligatoire." });
        }

        const devise = DEVISES[pays] || "USD";

        const prompt = `Tu es SAMII, le stratège commercial de OG Empire. Analyse le marché e-commerce du pays suivant.

Pays : ${pays}
${secteur ? `Secteur ciblé : ${secteur}` : "Tous secteurs confondus."}
Devise à utiliser pour les montants : ${devise}

Utilise la recherche web pour identifier les tendances actuelles de ce marché. Donne :
1. Un Top 5 des produits qui se vendent le mieux EN CE MOMENT
2. Un Top 5 des produits qui vont probablement bien se vendre BIENTÔT (tendance montante)

Pour chaque produit, estime un revenu mensuel potentiel réaliste pour un marchand moyen sur ce marché, exprimé en ${devise} (ex: "150 000 ${devise}/mois").

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, dans ce format exact :
{
  "du_moment": [
    { "nom": "Nom du produit", "revenu_estime": "150 000 ${devise}/mois", "raison": "Une phrase expliquant pourquoi ça marche actuellement." }
  ],
  "a_venir": [
    { "nom": "Nom du produit", "revenu_estime": "80 000 ${devise}/mois", "raison": "Une phrase expliquant pourquoi ça va probablement cartonner bientôt." }
  ]
}

Exactement 5 éléments dans chaque liste. Sois réaliste et honnête dans tes estimations, pas exagéré.`;

        const result = await gemini.chatWithSearch({
            message: prompt,
            context: { source: "top_produits", workspaceId: req.session.workspaceId },
        });

        const rawText = result.type === "text" ? result.text : "";
        const data = extractJson(rawText);

        if (!data || !data.du_moment || !data.a_venir) {
            return res.json({ success: false, error: "SAMII n'a pas pu structurer sa réponse. Réessaie." });
        }

        res.json({ success: true, data, sources: result.sources || [] });

    } catch (err) {
        console.error("❌ POST /samii/top-produits :", err.message);
        res.json({ success: false, error: "Erreur lors de l'analyse. Réessaie." });
    }
});

module.exports = router;
