// ==========================================================================
// SAMII OS — RADAR PROSPECTS
// Trouve de vraies entreprises/boutiques publiques correspondant à un profil
// donné — recherche web réelle (sources cliquables), même moteur que Radar
// Opportunités / Œil Concurrentiel (gemini.chatWithSearch). Sert deux usages
// avec le même outil : un marchand qui cherche ses propres clients, ou
// OG Technology qui cherche des marchands à qui proposer SAMII.
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
        const match = text.match(/\[[\s\S]*\]/);
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
    <title>Radar Prospects — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .radar-shell { max-width: 760px; margin: 0 auto; padding: 40px 24px 80px; }
        .radar-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .radar-back:hover { color: var(--cyan-tech); }

        .radar-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .radar-title .radar-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(95,212,255,0.18), rgba(197,160,89,0.08));
            border: 1px solid rgba(95,212,255,0.35);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
            box-shadow: 0 0 20px rgba(95,212,255,0.15);
        }
        .radar-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .radar-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 26px; line-height: 1.6; }

        .radar-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 14px 0 6px; }
        input, textarea { width: 100%; padding: 11px 13px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: var(--text-main); font-size: .88rem; font-family: var(--font-body); }
        textarea { resize: vertical; min-height: 70px; }
        input:focus, textarea:focus { outline: none; border-color: var(--cyan-tech); box-shadow: 0 0 0 3px rgba(95,212,255,0.12); }
        button.radar-submit {
            width: 100%; padding: 14px; margin-top: 18px;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000; font-size: .95rem;
            transition: transform .2s ease, box-shadow .2s ease;
        }
        button.radar-submit:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(197,160,89,0.25); }
        button.radar-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }

        .radar-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }

        .radar-results { margin-top: 28px; display: none; flex-direction: column; gap: 16px; }
        .radar-results-title {
            display: flex; align-items: center; gap: 8px;
            font-family: var(--font-mono); font-size: .72rem; text-transform: uppercase; letter-spacing: .1em;
            color: var(--cyan-tech); margin-bottom: 4px;
        }
        .radar-results-title::before, .radar-results-title::after {
            content: ''; flex: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(95,212,255,0.35), transparent);
        }

        .opp-card {
            position: relative;
            display: flex; align-items: center; gap: 20px;
            background: radial-gradient(circle at 0% 0%, rgba(95,212,255,0.06), transparent 60%), var(--bg-panel);
            border: 1px solid rgba(95,212,255,0.15);
            border-radius: 16px;
            padding: 18px 22px;
            overflow: hidden;
            animation: opp-fade-in .5s ease both;
        }
        .opp-card::before {
            content: ''; position: absolute; inset: 0;
            background: linear-gradient(120deg, transparent 40%, rgba(95,212,255,0.05) 50%, transparent 60%);
            background-size: 200% 100%;
            animation: opp-shine 4s ease-in-out infinite;
            pointer-events: none;
        }
        @keyframes opp-shine { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes opp-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .opp-ring { position: relative; width: 74px; height: 74px; flex-shrink: 0; }
        .opp-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
        .opp-ring circle { fill: none; stroke-width: 6; }
        .opp-ring .opp-ring-bg { stroke: rgba(255,255,255,0.06); }
        .opp-ring .opp-ring-fill {
            stroke: url(#opp-gradient);
            stroke-linecap: round;
            stroke-dasharray: 188.5;
            stroke-dashoffset: 188.5;
            transition: stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1);
        }
        .opp-ring-value {
            position: absolute; inset: 0;
            display: flex; align-items: center; justify-content: center;
            font-family: var(--font-mono); font-weight: 700; font-size: 1.05rem; color: #fff;
        }
        .opp-ring-value span { font-size: .6rem; color: var(--text-muted); font-weight: 400; margin-left: 1px; }

        .opp-body { flex: 1; min-width: 0; position: relative; z-index: 1; }
        .opp-body h3 { color: #fff; font-size: 1rem; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .opp-body h3 a { color: var(--cyan-tech); font-size: .78rem; font-weight: 600; text-decoration: none; }
        .opp-badge {
            font-family: var(--font-mono); font-size: .62rem; letter-spacing: .04em;
            padding: 2px 9px; border-radius: 20px; text-transform: uppercase;
            border: 1px solid;
        }
        .opp-badge--fort   { color: #3ddc84; border-color: rgba(61,220,132,0.4); background: rgba(61,220,132,0.08); }
        .opp-badge--moyen  { color: var(--gold-og); border-color: rgba(197,160,89,0.4); background: rgba(197,160,89,0.08); }
        .opp-badge--faible { color: #e55; border-color: rgba(229,85,85,0.4); background: rgba(229,85,85,0.08); }
        .opp-body p { color: var(--text-muted); font-size: .82rem; line-height: 1.55; margin-top: 6px; }

        .opp-note {
            margin-top: 24px; padding: 14px 16px; border-radius: 12px;
            background: rgba(95,212,255,0.06); border: 1px solid rgba(95,212,255,0.2);
            font-size: .78rem; color: var(--text-muted); line-height: 1.6;
            display: flex; gap: 10px; align-items: flex-start;
        }

        @media (max-width: 560px) {
            .opp-card { flex-direction: column; align-items: flex-start; text-align: left; }
            .opp-ring { align-self: center; }
        }
    </style>
</head>
<body data-theme="og">
<div class="radar-shell">
    <a href="/samii" class="radar-back">← Retour à SAMII</a>

    <div class="radar-title">
        <div class="radar-icon-box">🔎</div>
        <h1>Radar Prospects</h1>
    </div>
    <p class="sub">Décris le genre de client (ou de marchand) que tu cherches — SAMII cherche sur le web de vraies entreprises ou boutiques publiques qui correspondent, avec leurs sources.</p>

    <div class="radar-card">
        <form id="form-radar">
            <label>Qui cherches-tu comme prospect ?</label>
            <input name="cible" placeholder="Ex : petites boutiques de vêtements en ligne, marchands sans assistant IA..." required>

            <label>Marché cible (pays / région)</label>
            <input name="marche" placeholder="Ex : Algérie, Maroc, France..." required>

            <label>Précisions supplémentaires (optionnel)</label>
            <textarea name="details" placeholder="Ex : plutôt actifs sur Instagram, petite structure, démarrage récent..."></textarea>

            <button type="submit" class="radar-submit">🔎 Lancer le Radar</button>
        </form>
        <div class="radar-msg" id="msg"></div>
    </div>

    <div class="radar-results" id="results">
        <div class="radar-results-title">Prospects détectés</div>
        <div id="results-list"></div>
        <div class="opp-note">
            ℹ️ SAMII ne remonte que des informations publiques d'entreprise (nom, site, page publique) — jamais de coordonnées personnelles privées. Vérifie toujours les sources avant de contacter qui que ce soit.
        </div>
    </div>
</div>

<svg width="0" height="0" style="position:absolute;">
    <defs>
        <linearGradient id="opp-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#5FD4FF"/>
            <stop offset="100%" stop-color="#C5A059"/>
        </linearGradient>
    </defs>
</svg>

<script>
function badgeClass(score) {
    if (score >= 70) return { cls: 'fort', label: 'Fort' };
    if (score >= 40) return { cls: 'moyen', label: 'Moyen' };
    return { cls: 'faible', label: 'Faible' };
}

function renderProspects(list) {
    const container = document.getElementById('results-list');
    container.innerHTML = '';

    list.forEach((p, i) => {
        const score = Math.max(0, Math.min(100, parseInt(p.score, 10) || 0));
        const badge = badgeClass(score);
        const circumference = 188.5;
        const offset = circumference - (circumference * score / 100);
        const nomAffiche = p.nom || 'Prospect';
        const lienHtml = p.lien ? \` — <a href="\${p.lien}" target="_blank" rel="noopener">voir →</a>\` : '';

        const card = document.createElement('div');
        card.className = 'opp-card';
        card.style.animationDelay = (i * 0.1) + 's';
        card.innerHTML = \`
            <div class="opp-ring">
                <svg viewBox="0 0 70 70">
                    <circle class="opp-ring-bg" cx="35" cy="35" r="30"></circle>
                    <circle class="opp-ring-fill" cx="35" cy="35" r="30" style="stroke-dashoffset:\${circumference}"></circle>
                </svg>
                <div class="opp-ring-value">\${score}<span>/100</span></div>
            </div>
            <div class="opp-body">
                <h3>\${nomAffiche} <span class="opp-badge opp-badge--\${badge.cls}">\${badge.label}</span>\${lienHtml}</h3>
                <p>\${p.explication || ''}</p>
            </div>
        \`;
        container.appendChild(card);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const ring = card.querySelector('.opp-ring-fill');
                ring.style.strokeDashoffset = offset;
            });
        });
    });
}

function renderSources(sources) {
    let el = document.getElementById('opp-sources');
    if (!el) {
        el = document.createElement('div');
        el.id = 'opp-sources';
        el.style.cssText = 'margin-top:16px;font-size:.78rem;color:var(--text-muted);';
        document.getElementById('results').appendChild(el);
    }
    if (!sources.length) { el.innerHTML = ''; return; }
    el.innerHTML = '🔗 Sources consultées : ' + sources.map(s =>
        \`<a href="\${s.uri}" target="_blank" style="color:var(--cyan-tech);text-decoration:none;">\${s.title}</a>\`
    ).join(' · ');
}

document.getElementById('form-radar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg     = document.getElementById('msg');
    const results = document.getElementById('results');
    const btn     = e.target.querySelector('button');
    const data    = Object.fromEntries(new FormData(e.target));

    btn.disabled = true;
    msg.textContent = '🔎 SAMII cherche des prospects...';
    results.style.display = 'none';

    try {
        const res  = await fetch('/samii/radar-prospects', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const json = await res.json();

        if (json.success && json.prospects?.length) {
            msg.textContent = '';
            renderProspects(json.prospects);
            renderSources(json.sources || []);
            results.style.display = 'flex';
        } else {
            msg.textContent = json.error || '❌ SAMII n\\'a pas pu générer de résultat. Réessaie.';
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
        const { cible, marche, details } = req.body;

        if (!cible?.trim() || !marche?.trim()) {
            return res.json({ success: false, error: "Le profil recherché et le marché cible sont obligatoires." });
        }

        const prompt = `Tu es SAMII, le stratège commercial de OG Technology. Un utilisateur cherche de vrais prospects (clients ou marchands potentiels) à contacter pour développer son activité.

Profil de prospect recherché : ${cible.trim()}
Marché cible : ${marche.trim()}
${details?.trim() ? `Précisions : ${details.trim()}` : ""}

Utilise la recherche web pour identifier entre 3 et 5 VRAIES entreprises, boutiques ou pages publiques qui correspondent à ce profil — jamais de noms inventés. Pour chacune, donne uniquement des informations publiques d'entreprise (nom, site web ou page publique si tu la trouves) — jamais de coordonnées personnelles privées (email/téléphone d'un individu).

Réponds UNIQUEMENT avec un tableau JSON valide, sans aucun texte autour, sans balises markdown, dans ce format exact :
[
  { "nom": "Nom de l'entreprise ou de la boutique", "lien": "URL publique si trouvée, sinon chaîne vide", "score": 82, "explication": "Une phrase expliquant pourquoi c'est un bon prospect, concrète et actionnable." }
]

Le score est un nombre entre 0 et 100 représentant la pertinence réelle du prospect selon ce qui est recherché. Sois honnête : tous les prospects ne doivent pas avoir un score élevé.`;

        const result = await gemini.chatWithSearch({
            message: prompt,
            context: { source: "radar_prospects", workspaceId: req.session.workspaceId },
        });

        const rawText = result.type === "text" ? result.text : "";
        const prospects = extractJson(rawText);

        if (!prospects || !Array.isArray(prospects)) {
            return res.json({ success: false, error: "SAMII n'a pas pu structurer sa réponse. Réessaie." });
        }

        res.json({ success: true, prospects, sources: result.sources || [] });

    } catch (err) {
        console.error("❌ POST /samii/radar-prospects :", err.message);
        res.json({ success: false, error: "Erreur lors de la recherche. Réessaie." });
    }
});

module.exports = router;
