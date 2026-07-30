// ==========================================================================
// SAMII OS — CHASSEUR DE STOCK (T-024) — Fournisseurs mondiaux
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

const SEARCH_LINKS = {
    aliexpress: (q) => `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(q)}`,
    alibaba:    (q) => `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(q)}`,
    "1688":     (q) => `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(q)}`,
    dhgate:     (q) => `https://www.dhgate.com/wholesale/search.do?searchkey=${encodeURIComponent(q)}`,
};

router.get("/", requireAuth, async (req, res) => {
    const workspace = await getWorkspaceOrRedirect(req, res);
    if (!workspace) return;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Chasseur de Stock — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .cs-shell { max-width: 860px; margin: 0 auto; padding: 40px 24px 80px; }
        .cs-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .cs-back:hover { color: var(--cyan-tech); }

        .cs-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .cs-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(197,160,89,0.22), rgba(95,212,255,0.06));
            border: 1px solid rgba(197,160,89,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
            box-shadow: 0 0 20px rgba(197,160,89,0.18);
        }
        .cs-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .cs-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 20px; line-height: 1.6; }

        .cs-note {
            display: flex; gap: 10px; align-items: flex-start;
            padding: 12px 16px; margin-bottom: 22px; border-radius: 12px;
            background: rgba(197,160,89,0.06); border: 1px solid rgba(197,160,89,0.25);
            font-size: .78rem; color: var(--text-muted); line-height: 1.6;
        }

        .cs-regions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
        .cs-region-btn {
            display: flex; flex-direction: column; align-items: center; gap: 6px;
            padding: 16px 10px; border-radius: 14px;
            background: var(--bg-panel); border: 1px solid rgba(255,255,255,0.08);
            color: var(--text-muted); cursor: pointer; text-align: center;
            font-family: var(--font-body); transition: all .2s ease;
        }
        .cs-region-btn .flag { font-size: 1.5rem; }
        .cs-region-btn .label { font-weight: 700; color: var(--text-main); font-size: .82rem; }
        .cs-region-btn.active { border-color: var(--cyan-tech); background: rgba(95,212,255,0.06); box-shadow: 0 0 20px rgba(95,212,255,0.12); }
        .cs-region-btn.active .label { color: var(--cyan-tech); }

        .cs-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 14px 0 6px; }
        input {
            width: 100%; padding: 11px 13px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem; font-family: var(--font-body);
            transition: border-color .25s ease, box-shadow .25s ease, background .25s ease;
        }
        input:focus {
            outline: none; border-color: var(--cyan-tech);
            box-shadow: 0 0 0 3px rgba(95,212,255,0.15), 0 0 20px rgba(95,212,255,0.25);
            background: rgba(95,212,255,0.04);
        }
        .cs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        button.cs-submit {
            width: 100%; padding: 14px; margin-top: 18px;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000; font-size: .95rem;
            transition: transform .2s ease, box-shadow .2s ease;
        }
        button.cs-submit:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(197,160,89,0.25); }
        button.cs-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }

        .cs-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }

        /* ── RÉSULTATS ── */
        .cs-results { margin-top: 28px; display: none; flex-direction: column; gap: 14px; }
        .cs-results-title {
            display: flex; align-items: center; gap: 8px;
            font-family: var(--font-mono); font-size: .72rem; text-transform: uppercase; letter-spacing: .1em;
            color: var(--gold-og); margin-bottom: 4px;
        }
        .cs-results-title::before, .cs-results-title::after {
            content: ''; flex: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(197,160,89,0.35), transparent);
        }

        .cs-supplier {
            position: relative;
            display: flex; align-items: center; gap: 18px;
            background: radial-gradient(circle at 0% 0%, rgba(197,160,89,0.06), transparent 60%), var(--bg-panel);
            border: 1px solid rgba(197,160,89,0.15);
            border-radius: 16px;
            padding: 18px 20px;
            overflow: hidden;
            animation: cs-fade-in .5s ease both;
        }
        .cs-supplier::before {
            content: ''; position: absolute; inset: 0;
            background: linear-gradient(120deg, transparent 40%, rgba(197,160,89,0.05) 50%, transparent 60%);
            background-size: 200% 100%;
            animation: cs-shine 4s ease-in-out infinite;
            pointer-events: none;
        }
        @keyframes cs-shine { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes cs-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .cs-supplier__logo {
            width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            font-family: var(--font-display); font-weight: 700; font-size: 1.1rem; color: #fff;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
            position: relative; z-index: 1;
        }
        .cs-supplier__body { flex: 1; min-width: 0; position: relative; z-index: 1; }
        .cs-supplier__body h3 { color: #fff; font-size: 1rem; font-weight: 700; margin-bottom: 4px; }
        .cs-supplier__body p { color: var(--text-muted); font-size: .8rem; line-height: 1.5; margin-bottom: 8px; }

        .cs-supplier__meta { display: flex; flex-wrap: wrap; gap: 8px; }
        .cs-meta-chip {
            font-family: var(--font-mono); font-size: .7rem;
            padding: 3px 10px; border-radius: 20px;
            background: rgba(95,212,255,0.08); border: 1px solid rgba(95,212,255,0.25);
            color: var(--cyan-tech);
        }
        .cs-meta-chip--moq { background: rgba(61,220,132,0.08); border-color: rgba(61,220,132,0.3); color: #3ddc84; }

        .cs-supplier__link {
            flex-shrink: 0; position: relative; z-index: 1;
            display: inline-flex; align-items: center; gap: 6px;
            padding: 9px 16px; border-radius: 10px;
            background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
            color: var(--text-main); text-decoration: none; font-size: .8rem; font-weight: 600;
            transition: all .2s ease;
        }
        .cs-supplier__link:hover { border-color: var(--cyan-tech); color: var(--cyan-tech); }

        @media (max-width: 620px) {
            .cs-regions { grid-template-columns: repeat(3, 1fr); }
            .cs-row { grid-template-columns: 1fr; }
            .cs-supplier { flex-wrap: wrap; }
            .cs-supplier__link { width: 100%; justify-content: center; }
        }
    </style>
</head>
<body>
<div class="cs-shell">
    <a href="/samii" class="cs-back">← Retour à SAMII</a>

    <div class="cs-title">
        <div class="cs-icon-box">📦</div>
        <h1>Chasseur de Stock</h1>
    </div>
    <p class="sub">Choisis ta région d'approvisionnement — SAMII te trouve des fournisseurs avec prix de gros et minimum de commande.</p>

    <div class="cs-note">
        ℹ️ Prix et minimums sont des estimations basées sur des recherches web — vérifie toujours directement avec le fournisseur.
    </div>

    <div class="cs-regions" id="cs-regions">
        <button type="button" class="cs-region-btn active" data-region="chine">
            <span class="flag">🇨🇳</span>
            <span class="label">Chine</span>
        </button>
        <button type="button" class="cs-region-btn" data-region="dubai">
            <span class="flag">🇦🇪</span>
            <span class="label">Dubaï</span>
        </button>
        <button type="button" class="cs-region-btn" data-region="maghreb">
            <span class="flag">🌍</span>
            <span class="label">Maghreb</span>
        </button>
    </div>

    <div class="cs-card">
        <form id="form-cs">
            <input type="hidden" name="region" id="input-region" value="chine">

            <label>Quel produit cherches-tu à approvisionner ?</label>
            <input name="produit" placeholder="Ex : coques de téléphone, vêtements en coton, accessoires électroniques..." required>

            <div class="cs-row">
                <div>
                    <label>Quantité souhaitée (optionnel)</label>
                    <input name="quantite" placeholder="Ex : 100 pièces">
                </div>
                <div>
                    <label>Budget max par unité (optionnel)</label>
                    <input name="budget" placeholder="Ex : 5 USD">
                </div>
            </div>

            <button type="submit" class="cs-submit">📦 Chercher des fournisseurs</button>
        </form>
        <div class="cs-msg" id="msg"></div>
    </div>

    <div class="cs-results" id="results">
        <div class="cs-results-title">Fournisseurs trouvés</div>
        <div id="results-list"></div>
        <div id="sources-block" style="font-size:.78rem;color:var(--text-muted);"></div>
    </div>
</div>

<script>
document.querySelectorAll('.cs-region-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.cs-region-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('input-region').value = btn.dataset.region;
    });
});

function initiales(nom) {
    return (nom || 'F').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function renderSuppliers(list) {
    const container = document.getElementById('results-list');
    container.innerHTML = '';
    list.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'cs-supplier';
        div.style.animationDelay = (i * 0.1) + 's';
        div.innerHTML = \`
            <div class="cs-supplier__logo">\${initiales(s.plateforme)}</div>
            <div class="cs-supplier__body">
                <h3>\${s.plateforme || 'Fournisseur'}</h3>
                <p>\${s.description || ''}</p>
                <div class="cs-supplier__meta">
                    <span class="cs-meta-chip">💰 \${s.prix_unitaire || '—'}</span>
                    \${s.moq ? \`<span class="cs-meta-chip cs-meta-chip--moq">📦 Min. \${s.moq}</span>\` : ''}
                </div>
            </div>
            <a href="\${s.lien}" target="_blank" class="cs-supplier__link">Voir →</a>
        \`;
        container.appendChild(div);
    });
}

function renderSources(sources) {
    const el = document.getElementById('sources-block');
    if (!sources || !sources.length) { el.innerHTML = ''; return; }
    el.innerHTML = '🔗 Sources consultées : ' + sources.map(s =>
        \`<a href="\${s.uri}" target="_blank" style="color:var(--cyan-tech);text-decoration:none;">\${s.title}</a>\`
    ).join(' · ');
}

document.getElementById('form-cs').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg     = document.getElementById('msg');
    const results = document.getElementById('results');
    const btn     = e.target.querySelector('button');
    const data    = Object.fromEntries(new FormData(e.target));

    btn.disabled = true;
    msg.textContent = '📦 SAMII cherche des fournisseurs...';
    results.style.display = 'none';

    try {
        const res  = await fetch('/samii/chasseur-stock', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const json = await res.json();

        if (json.success && json.fournisseurs?.length) {
            msg.textContent = '';
            renderSuppliers(json.fournisseurs);
            renderSources(json.sources || []);
            results.style.display = 'flex';
        } else {
            msg.textContent = json.error || '❌ SAMII n\\'a pas trouvé de fournisseurs. Réessaie.';
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
        const { region, produit, quantite, budget } = req.body;

        if (!produit || !produit.trim()) {
            return res.json({ success: false, error: "Indique le produit à approvisionner." });
        }

        const regionsLabel = {
            chine: "des fournisseurs et grossistes chinois (AliExpress, Alibaba, 1688, DHgate)",
            dubai: "des fournisseurs et grossistes basés à Dubaï / Émirats Arabes Unis",
            maghreb: "des fournisseurs et grossistes basés au Maghreb (Algérie, Maroc, Tunisie)",
        };

        const prompt = "Tu es SAMII, expert en approvisionnement pour OG Empire. Un marchand cherche des fournisseurs.\n\n"
            + `Produit recherché : ${produit}\n`
            + (quantite ? `Quantité souhaitée : ${quantite}\n` : "")
            + (budget ? `Budget max par unité : ${budget}\n` : "")
            + `Région ciblée : ${regionsLabel[region] || regionsLabel.chine}\n\n`
            + "Utilise la recherche web pour identifier 4 à 6 pistes concrètes de fournisseurs ou plateformes adaptées à ce produit et cette région.\n\n"
            + "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, dans ce format exact :\n"
            + "{\n"
            + '  "fournisseurs": [\n'
            + '    { "plateforme": "Nom de la plateforme ou du fournisseur", "description": "une phrase sur ce qu\'il propose", "prix_unitaire": "fourchette de prix estimée avec devise", "moq": "quantité minimum de commande si connue, sinon vide", "lien": "URL de recherche pertinente" }\n'
            + "  ]\n"
            + "}\n\n"
            + "Sois concret et réaliste dans les estimations de prix.";

        const result = await gemini.chatWithSearch({
            message: prompt,
            context: { source: "chasseur_stock", workspaceId: req.session.workspaceId },
        });

        const rawText = result.type === "text" ? result.text : "";
        const data = extractJson(rawText);

        if (!data || !data.fournisseurs) {
            return res.json({ success: false, error: "SAMII n'a pas pu structurer sa réponse. Réessaie." });
        }

        // Sécurise les liens : si Gemini n'a pas donné de lien exploitable,
        // on remplace par un vrai lien de recherche garanti fonctionnel.
        const fallbackKey = region === "chine" ? "aliexpress" : null;
        data.fournisseurs = data.fournisseurs.map(f => {
            if (!f.lien || !f.lien.startsWith("http")) {
                if (fallbackKey && SEARCH_LINKS[fallbackKey]) {
                    f.lien = SEARCH_LINKS[fallbackKey](produit);
                } else {
                    f.lien = `https://www.google.com/search?q=${encodeURIComponent(f.plateforme + " " + produit)}`;
                }
            }
            return f;
        });

        res.json({ success: true, fournisseurs: data.fournisseurs, sources: result.sources || [] });

    } catch (err) {
        console.error("❌ POST /samii/chasseur-stock :", err.message);
        res.json({ success: false, error: "Erreur lors de la recherche. Réessaie." });
    }
});

module.exports = router;
