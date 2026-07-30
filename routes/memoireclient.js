// ==========================================================================
// SAMII OS — MÉMOIRE CLIENT (T-006) — Historique relationnel enrichi
// ==========================================================================
const express = require("express");
const router  = express.Router();
const airtable = require("../services/airtable");
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

function getMontant(c) {
    return parseFloat(c.montant || c.Total || 0) || 0;
}

router.get("/", requireAuth, async (req, res) => {
    const workspace = await getWorkspaceOrRedirect(req, res);
    if (!workspace) return;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Mémoire Client — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .mc-shell { max-width: 780px; margin: 0 auto; padding: 40px 24px 80px; }
        .mc-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .mc-back:hover { color: var(--cyan-tech); }

        .mc-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .mc-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(95,212,255,0.2), rgba(197,160,89,0.08));
            border: 1px solid rgba(95,212,255,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
            box-shadow: 0 0 20px rgba(95,212,255,0.18);
        }
        .mc-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .mc-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 20px; line-height: 1.6; }

        .mc-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
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

        button.mc-submit {
            width: 100%; padding: 14px; margin-top: 18px;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000; font-size: .95rem;
            transition: transform .2s ease, box-shadow .2s ease;
        }
        button.mc-submit:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(197,160,89,0.25); }
        button.mc-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }

        .mc-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }

        /* ── FICHE CLIENT ── */
        .mc-fiche { margin-top: 28px; display: none; flex-direction: column; gap: 16px; }

        .mc-header {
            display: flex; align-items: center; gap: 16px;
            background: var(--bg-panel); border: 1px solid rgba(197,160,89,0.2);
            border-radius: 16px; padding: 20px 22px;
        }
        .mc-avatar {
            width: 56px; height: 56px; border-radius: 50%; flex-shrink: 0;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover));
            display: flex; align-items: center; justify-content: center;
            font-family: var(--font-display); font-weight: 700; font-size: 1.3rem; color: #000;
        }
        .mc-header__info { flex: 1; min-width: 0; }
        .mc-header__info h2 { color: #fff; font-size: 1.1rem; margin-bottom: 4px; }
        .mc-header__info p { color: var(--text-muted); font-size: .8rem; }
        .mc-badges { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }
        .mc-badge { font-family: var(--font-mono); font-size: .68rem; padding: 3px 10px; border-radius: 20px; border: 1px solid; }
        .mc-badge--vip { color: var(--gold-og); border-color: rgba(197,160,89,0.4); background: rgba(197,160,89,0.08); }
        .mc-badge--black { color: #e55; border-color: rgba(229,85,85,0.4); background: rgba(229,85,85,0.08); }

        .mc-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .mc-stat {
            background: var(--bg-panel); border: 1px solid rgba(255,255,255,0.08);
            border-radius: 14px; padding: 16px; text-align: center;
        }
        .mc-stat .val { font-family: var(--font-mono); font-weight: 700; font-size: 1.3rem; color: var(--cyan-tech); }
        .mc-stat .lbl { font-size: .72rem; color: var(--text-muted); margin-top: 4px; }

        .mc-analyse {
            background: rgba(95,212,255,0.05); border: 1px solid rgba(95,212,255,0.2);
            border-radius: 14px; padding: 18px 20px; color: var(--text-main); font-size: .87rem; line-height: 1.65;
        }

        .mc-history-title {
            display: flex; align-items: center; gap: 8px;
            font-family: var(--font-mono); font-size: .72rem; text-transform: uppercase; letter-spacing: .1em;
            color: var(--gold-og); margin-bottom: 4px;
        }
        .mc-history-title::before, .mc-history-title::after {
            content: ''; flex: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(197,160,89,0.35), transparent);
        }
        .mc-history-list { display: flex; flex-direction: column; gap: 8px; }
        .mc-history-item {
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
            background: var(--bg-panel); border: 1px solid rgba(255,255,255,0.06);
            border-radius: 10px; padding: 10px 14px; font-size: .82rem;
        }
        .mc-history-item .prod { color: var(--text-main); flex: 1; min-width: 0; }
        .mc-history-item .meta { color: var(--text-muted); font-family: var(--font-mono); font-size: .74rem; text-align: right; flex-shrink: 0; }

        @media (max-width: 560px) {
            .mc-stats { grid-template-columns: 1fr 1fr; }
            .mc-header { flex-wrap: wrap; }
        }
    </style>
</head>
<body>
<div class="mc-shell">
    <a href="/samii" class="mc-back">← Retour à SAMII</a>

    <div class="mc-title">
        <div class="mc-icon-box">🧠</div>
        <h1>Mémoire Client</h1>
    </div>
    <p class="sub">Cherche un client par nom ou téléphone — SAMII te fait sa fiche complète.</p>

    <div class="mc-card">
        <form id="form-mc">
            <label>Nom ou numéro de téléphone du client</label>
            <input name="recherche" placeholder="Ex : Ahmed, 0555123456..." required>

            <button type="submit" class="mc-submit">🧠 Chercher le client</button>
        </form>
        <div class="mc-msg" id="msg"></div>
    </div>

    <div class="mc-fiche" id="fiche"></div>
</div>

<script>
function initiales(nom) {
    return (nom || '?').trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function renderFiche(data) {
    const fiche = document.getElementById('fiche');

    const badges = [];
    if (data.vip) badges.push('<span class="mc-badge mc-badge--vip">👑 VIP</span>');
    if (data.blacklist) badges.push('<span class="mc-badge mc-badge--black">🚫 Blacklist</span>');

    const historyItems = (data.historique || []).map(h => \`
        <div class="mc-history-item">
            <span class="prod">\${h.produit || '—'}</span>
            <span class="meta">\${h.date || ''} · \${h.montant || '0'}</span>
        </div>
    \`).join('') || '<p style="color:var(--text-muted);font-size:.82rem;">Aucune commande enregistrée.</p>';

    fiche.innerHTML = \`
        <div class="mc-header">
            <div class="mc-avatar">\${initiales(data.nom)}</div>
            <div class="mc-header__info">
                <h2>\${data.nom || 'Client'}</h2>
                <p>\${data.telephone || ''}</p>
            </div>
            <div class="mc-badges">\${badges.join('')}</div>
        </div>

        <div class="mc-stats">
            <div class="mc-stat">
                <div class="val">\${data.total_commandes || 0}</div>
                <div class="lbl">Commandes</div>
            </div>
            <div class="mc-stat">
                <div class="val">\${data.total_depense || 0}</div>
                <div class="lbl">Total dépensé</div>
            </div>
            <div class="mc-stat">
                <div class="val">\${data.frequence || '—'}</div>
                <div class="lbl">Fréquence</div>
            </div>
        </div>

        <div class="mc-analyse">🧠 <b>Analyse SAMII :</b> \${data.analyse || 'Pas assez de données pour une analyse.'}</div>

        <div>
            <div class="mc-history-title">Historique des commandes</div>
            <div class="mc-history-list">\${historyItems}</div>
        </div>
    \`;
    fiche.style.display = 'flex';
}

document.getElementById('form-mc').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg   = document.getElementById('msg');
    const fiche = document.getElementById('fiche');
    const btn   = e.target.querySelector('button');
    const data  = Object.fromEntries(new FormData(e.target));

    btn.disabled = true;
    msg.textContent = '🧠 SAMII cherche le client...';
    fiche.style.display = 'none';

    try {
        const res  = await fetch('/samii/memoire-client', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const json = await res.json();

        if (json.success && json.client) {
            msg.textContent = '';
            renderFiche(json.client);
        } else {
            msg.textContent = json.error || '❌ Client introuvable.';
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
        const { recherche } = req.body;
        if (!recherche || !recherche.trim()) {
            return res.json({ success: false, error: "Indique un nom ou un numéro." });
        }

        const workspaceId = req.session.workspaceId;
        const term = recherche.trim();

        const clients = await airtable.find("CLIENTS",
            `AND({workspace_id}="${workspaceId}", OR(SEARCH("${term}",{Nom}), SEARCH("${term}",{Nom Client}), SEARCH("${term}",{Téléphone})))`,
            5
        );

        if (!clients.length) {
            return res.json({ success: false, error: "Aucun client trouvé avec ce nom ou numéro." });
        }

        const clientRecord = clients[0];
        const cf = clientRecord.fields;
        const nom = cf["Nom"] || cf["Nom Client"] || "Client";
        const telephone = cf["Téléphone"] || "";

        const commandes = await airtable.find("COMMANDES",
            `AND({Boutique}="${workspaceId}", {Téléphone}="${telephone}")`,
            50
        );

        const total_commandes = commandes.length;
        const total_depense = commandes.reduce((s, c) => s + getMontant(c.fields), 0);

        const dates = commandes
            .map(c => c.fields["Date Commande"])
            .filter(Boolean)
            .sort();

        let frequence = "—";
        if (dates.length >= 2) {
            const first = new Date(dates[0]);
            const last  = new Date(dates[dates.length - 1]);
            const joursTotal = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
            const moyenneJours = Math.round(joursTotal / (dates.length - 1));
            frequence = `~${moyenneJours}j`;
        }

        const historique = commandes
            .sort((a, b) => (b.fields["Date Commande"] || "").localeCompare(a.fields["Date Commande"] || ""))
            .slice(0, 10)
            .map(c => ({
                produit: c.fields["Produit"] || "—",
                date: (c.fields["Date Commande"] || "").slice(0, 10),
                montant: getMontant(c.fields).toFixed(2),
            }));

        let analyse = "Client sans historique suffisant pour une analyse.";
        if (total_commandes > 0) {
            const prompt = "Tu es SAMII. Voici les données d'un client :\n"
                + `Nombre de commandes : ${total_commandes}\n`
                + `Total dépensé : ${total_depense.toFixed(2)}\n`
                + `Fréquence d'achat moyenne : ${frequence}\n`
                + `VIP : ${cf.VIP ? "oui" : "non"}\n`
                + `Blacklist : ${cf.Blacklist ? "oui" : "non"}\n\n`
                + "En 1 à 2 phrases courtes, donne ton analyse de ce profil client (fidèle, à risque, nouveau, à relancer, etc.) et une recommandation concrète pour le marchand. Réponds directement en texte, sans JSON, sans formatage markdown.";

            const result = await gemini.chat({
                message: prompt,
                context: { source: "memoire_client", workspaceId },
                useTools: false,
            });
            analyse = result.type === "text" ? result.text : analyse;
        }

        res.json({
            success: true,
            client: {
                nom,
                telephone,
                vip: cf.VIP === true,
                blacklist: cf.Blacklist === true,
                total_commandes,
                total_depense: total_depense.toFixed(2),
                frequence,
                analyse,
                historique,
            },
        });

    } catch (err) {
        console.error("❌ POST /samii/memoire-client :", err.message);
        res.json({ success: false, error: "Erreur lors de la recherche. Réessaie." });
    }
});

module.exports = router;
