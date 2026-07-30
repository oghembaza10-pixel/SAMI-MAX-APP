// ==========================================================================
// SAMII OS — DIPLOMATE (T-005) — Messages clients, 3 propositions
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
    <title>Diplomate — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .dip-shell { max-width: 780px; margin: 0 auto; padding: 40px 24px 80px; }
        .dip-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .dip-back:hover { color: var(--cyan-tech); }

        .dip-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .dip-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(95,212,255,0.2), rgba(197,160,89,0.08));
            border: 1px solid rgba(95,212,255,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
            box-shadow: 0 0 20px rgba(95,212,255,0.18);
        }
        .dip-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .dip-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 20px; line-height: 1.6; }

        .dip-types { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 22px; }
        .dip-type-btn {
            display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
            padding: 16px; border-radius: 14px;
            background: var(--bg-panel); border: 1px solid rgba(255,255,255,0.08);
            color: var(--text-muted); cursor: pointer; text-align: left;
            font-family: var(--font-body); transition: all .2s ease;
        }
        .dip-type-btn .icon { font-size: 1.3rem; }
        .dip-type-btn .label { font-weight: 700; color: var(--text-main); font-size: .88rem; }
        .dip-type-btn.active { border-color: var(--cyan-tech); background: rgba(95,212,255,0.06); box-shadow: 0 0 20px rgba(95,212,255,0.12); }
        .dip-type-btn.active .label { color: var(--cyan-tech); }

        .dip-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 14px 0 6px; }
        textarea, input {
            width: 100%; padding: 11px 13px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem; font-family: var(--font-body);
            transition: border-color .25s ease, box-shadow .25s ease, background .25s ease;
        }
        textarea { resize: vertical; min-height: 80px; }
        textarea:focus, input:focus {
            outline: none; border-color: var(--cyan-tech);
            box-shadow: 0 0 0 3px rgba(95,212,255,0.15), 0 0 20px rgba(95,212,255,0.25);
            background: rgba(95,212,255,0.04);
        }

        button.dip-submit {
            width: 100%; padding: 14px; margin-top: 18px;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000; font-size: .95rem;
            transition: transform .2s ease, box-shadow .2s ease;
        }
        button.dip-submit:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(197,160,89,0.25); }
        button.dip-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }

        .dip-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }

        /* ── RÉSULTATS ── */
        .dip-results { margin-top: 28px; display: none; flex-direction: column; gap: 14px; }
        .dip-results-title {
            display: flex; align-items: center; gap: 8px;
            font-family: var(--font-mono); font-size: .72rem; text-transform: uppercase; letter-spacing: .1em;
            color: var(--cyan-tech); margin-bottom: 4px;
        }
        .dip-results-title::before, .dip-results-title::after {
            content: ''; flex: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(95,212,255,0.35), transparent);
        }

        .dip-option {
            position: relative;
            background: radial-gradient(circle at 100% 0%, rgba(95,212,255,0.06), transparent 60%), var(--bg-panel);
            border: 1px solid rgba(95,212,255,0.15);
            border-radius: 16px;
            padding: 18px 20px;
            animation: dip-fade-in .5s ease both;
        }
        @keyframes dip-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .dip-option__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .dip-option__title { display: flex; align-items: center; gap: 8px; font-size: .85rem; font-weight: 700; color: #fff; }
        .dip-option__badge {
            font-family: var(--font-mono); font-size: .62rem; text-transform: uppercase;
            padding: 2px 9px; border-radius: 20px; border: 1px solid rgba(197,160,89,0.4);
            color: var(--gold-og); background: rgba(197,160,89,0.08);
        }
        .dip-copy-btn {
            background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
            color: var(--text-muted); font-size: .7rem; padding: 5px 11px; border-radius: 20px;
            cursor: pointer; font-family: var(--font-mono); transition: all .2s ease;
        }
        .dip-copy-btn:hover { color: var(--cyan-tech); border-color: var(--cyan-tech); }
        .dip-copy-btn.copied { color: #3ddc84; border-color: #3ddc84; }
        .dip-option__body { color: var(--text-main); font-size: .85rem; line-height: 1.65; white-space: pre-wrap; }

        @media (max-width: 560px) {
            .dip-types { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
<div class="dip-shell">
    <a href="/samii" class="dip-back">← Retour à SAMII</a>

    <div class="dip-title">
        <div class="dip-icon-box">🕊️</div>
        <h1>Diplomate</h1>
    </div>
    <p class="sub">Choisis la situation — SAMII te propose 3 messages différents, prêts à envoyer.</p>

    <div class="dip-types" id="dip-types">
        <button type="button" class="dip-type-btn active" data-type="negatif">
            <span class="icon">😠</span>
            <span class="label">Avis négatif</span>
        </button>
        <button type="button" class="dip-type-btn" data-type="fidelite">
            <span class="icon">🎁</span>
            <span class="label">Message de fidélité</span>
        </button>
        <button type="button" class="dip-type-btn" data-type="relance">
            <span class="icon">📢</span>
            <span class="label">Relance client inactif</span>
        </button>
        <button type="button" class="dip-type-btn" data-type="annonce">
            <span class="icon">🎉</span>
            <span class="label">Annonce spéciale</span>
        </button>
    </div>

    <div class="dip-card">
        <form id="form-dip">
            <input type="hidden" name="type" id="input-type" value="negatif">

            <label id="label-contexte">Que dit l'avis / la situation ?</label>
            <textarea name="contexte" placeholder="Ex : le client dit que sa commande est arrivée en retard et abîmée..." required></textarea>

            <label>Précisions supplémentaires (optionnel)</label>
            <input name="details" placeholder="Ex : c'est un client fidèle, on a déjà remboursé, etc.">

            <button type="submit" class="dip-submit">🕊️ Proposer 3 messages</button>
        </form>
        <div class="dip-msg" id="msg"></div>
    </div>

    <div class="dip-results" id="results">
        <div class="dip-results-title">3 propositions</div>
        <div id="results-list"></div>
    </div>
</div>

<script>
const contexteLabels = {
    negatif: "Que dit l'avis / la situation ?",
    fidelite: "Pour quel client / quelle occasion ?",
    relance: "Depuis quand ce client n'a rien commandé ?",
    annonce: "Quelle est l'annonce à faire ?",
};
const contextePlaceholders = {
    negatif: "Ex : le client dit que sa commande est arrivée en retard et abîmée...",
    fidelite: "Ex : client fidèle depuis 1 an, vient de faire sa 10e commande...",
    relance: "Ex : n'a rien commandé depuis 3 mois, achetait souvent avant...",
    annonce: "Ex : nouvelle collection disponible, promo -20% ce week-end...",
};

document.querySelectorAll('.dip-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.dip-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.dataset.type;
        document.getElementById('input-type').value = type;
        document.getElementById('label-contexte').textContent = contexteLabels[type];
        document.querySelector('textarea[name="contexte"]').placeholder = contextePlaceholders[type];
    });
});

function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = '✅ Copié';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1800);
    });
}

function renderOptions(list) {
    const container = document.getElementById('results-list');
    container.innerHTML = '';
    list.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'dip-option';
        div.style.animationDelay = (i * 0.1) + 's';
        div.innerHTML = \`
            <div class="dip-option__header">
                <div class="dip-option__title">💬 Message \${i + 1} <span class="dip-option__badge">\${opt.style || ''}</span></div>
                <button type="button" class="dip-copy-btn" onclick='copyText(\${JSON.stringify(opt.texte)}, this)'>Copier</button>
            </div>
            <div class="dip-option__body">\${opt.texte}</div>
        \`;
        container.appendChild(div);
    });
}

document.getElementById('form-dip').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg     = document.getElementById('msg');
    const results = document.getElementById('results');
    const btn     = e.target.querySelector('button');
    const data    = Object.fromEntries(new FormData(e.target));

    btn.disabled = true;
    msg.textContent = '🕊️ SAMII rédige les messages...';
    results.style.display = 'none';

    try {
        const res  = await fetch('/samii/diplomate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const json = await res.json();

        if (json.success && json.messages?.length) {
            msg.textContent = '';
            renderOptions(json.messages);
            results.style.display = 'flex';
        } else {
            msg.textContent = json.error || '❌ SAMII n\\'a pas pu générer les messages. Réessaie.';
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
        const { type, contexte, details } = req.body;
        if (!contexte || !contexte.trim()) {
            return res.json({ success: false, error: "Décris la situation." });
        }

        const typesLabel = {
            negatif: "répondre à un avis négatif d'un client",
            fidelite: "envoyer un message de fidélité/remerciement à un client",
            relance: "relancer un client qui n'a pas commandé depuis un moment",
            annonce: "annoncer une nouveauté ou une promotion",
        };

        const prompt = `Tu es SAMII, diplomate et communicant pour OG Empire. Un marchand a besoin de ${typesLabel[type] || "rédiger un message client"}.

Contexte : ${contexte}
${details ? `Précisions : ${details}` : ""}

Propose exactement 3 messages différents, avec des styles distincts (par exemple un direct, un chaleureux, un plus formel — adapte selon la situation). Chaque message doit être complet, prêt à envoyer tel quel.

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, sans balises markdown, dans ce format exact :
[
  { "style": "Direct", "texte": "le message complet ici" },
  { "style": "Chaleureux", "texte": "le message complet ici" },
  { "style": "Formel", "texte": "le message complet ici" }
]`;

        const result = await gemini.chat({
            message: prompt,
            context: { source: "diplomate", workspaceId: req.session.workspaceId },
            useTools: false,
        });

        const rawText = result.type === "text" ? result.text : "";
        const match = rawText.match(/\[[\s\S]*\]/);
        const messages = match ? JSON.parse(match[0]) : null;

        if (!messages || !Array.isArray(messages)) {
            return res.json({ success: false, error: "SAMII n'a pas pu structurer sa réponse. Réessaie." });
        }

        res.json({ success: true, messages });

    } catch (err) {
        console.error("❌ POST /samii/diplomate :", err.message);
        res.json({ success: false, error: "Erreur lors de la génération. Réessaie." });
    }
});

module.exports = router;
