// ==========================================================================
// SAMII OS — AUTOMATISATIONS — Tableau de pilotage on/off
// ==========================================================================
const express = require("express");
const router  = express.Router();
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const AUTOMATISATIONS = [
    {
        id: "ambassadeur",
        icon: "heart-handshake",
        nom: "Ambassadeur",
        desc: "Offres de fidélité automatiques envoyées à tes clients VIP, tous les 30 jours max.",
        frequence: "Chaque jour à 10h00",
    },
    {
        id: "serenite",
        icon: "leaf",
        nom: "Sérénité",
        desc: "Bilan quotidien de ton activité envoyé sur Telegram, chaque soir.",
        frequence: "Chaque jour à 22h00",
    },
    {
        id: "bouclierAntiFraude",
        icon: "shield-alert",
        nom: "Bouclier Anti-Fraude",
        desc: "Alerte séparée dès qu'une commande à montant élevé ou suspecte arrive.",
        frequence: "En temps réel",
    },
];

router.get("/", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.redirect("/hub");

    const workspace = await workspaceService.getById(workspaceId);
    if (!workspace) return res.redirect("/hub");

    const etats = workspace.automatisations || {};

    const cardsHtml = AUTOMATISATIONS.map(a => {
        const actif = etats[a.id] !== false;
        return `
        <div class="auto-card">
            <div class="auto-card__icon"><i data-lucide="${a.icon}"></i></div>
            <div class="auto-card__body">
                <h3>${a.nom}</h3>
                <p>${a.desc}</p>
                <span class="auto-card__freq">⏱ ${a.frequence}</span>
            </div>
            <label class="auto-toggle">
                <input type="checkbox" data-auto="${a.id}" ${actif ? "checked" : ""}>
                <span class="auto-toggle__slider"></span>
            </label>
        </div>`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Automatisations — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .auto-shell { max-width: 740px; margin: 0 auto; padding: 40px 24px 80px; }
        .auto-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .auto-back:hover { color: var(--cyan-tech); }

        .auto-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .auto-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(197,160,89,0.22), rgba(95,212,255,0.06));
            border: 1px solid rgba(197,160,89,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
            box-shadow: 0 0 20px rgba(197,160,89,0.18);
        }
        .auto-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .auto-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 26px; line-height: 1.6; }

        .auto-list { display: flex; flex-direction: column; gap: 14px; }
        .auto-card {
            display: flex; align-items: center; gap: 16px;
            background: var(--bg-glass); backdrop-filter: blur(12px);
            border: var(--border-soft); border-radius: 16px; padding: 20px 22px;
            transition: border-color .2s ease;
        }
        .auto-card__icon {
            width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
            background: rgba(197,160,89,0.1); color: var(--gold-og);
            display: flex; align-items: center; justify-content: center;
        }
        .auto-card__body { flex: 1; min-width: 0; }
        .auto-card__body h3 { color: #fff; font-size: .95rem; margin-bottom: 4px; }
        .auto-card__body p { color: var(--text-muted); font-size: .8rem; line-height: 1.5; margin-bottom: 6px; }
        .auto-card__freq {
            font-family: var(--font-mono); font-size: .68rem; color: var(--cyan-tech);
            background: rgba(95,212,255,0.08); border: 1px solid rgba(95,212,255,0.2);
            padding: 2px 10px; border-radius: 20px;
        }

        /* ── TOGGLE ── */
        .auto-toggle { position: relative; display: inline-block; width: 46px; height: 26px; flex-shrink: 0; }
        .auto-toggle input { opacity: 0; width: 0; height: 0; }
        .auto-toggle__slider {
            position: absolute; cursor: pointer; inset: 0;
            background: rgba(255,255,255,0.1); border-radius: 30px;
            transition: background .25s ease;
        }
        .auto-toggle__slider::before {
            content: ''; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px;
            background: #fff; border-radius: 50%; transition: transform .25s ease;
        }
        .auto-toggle input:checked + .auto-toggle__slider { background: linear-gradient(135deg, #3ddc84, #24a85c); }
        .auto-toggle input:checked + .auto-toggle__slider::before { transform: translateX(20px); }

        .auto-msg { text-align: center; margin-top: 18px; font-size: .85rem; color: #3ddc84; min-height: 20px; }

        @media (max-width: 560px) {
            .auto-card { flex-wrap: wrap; }
        }
    </style>
</head>
<body>
<div class="auto-shell">
    <a href="/samii" class="auto-back">← Retour à SAMII</a>

    <div class="auto-title">
        <div class="auto-icon-box">⚡</div>
        <h1>Automatisations</h1>
    </div>
    <p class="sub">SAMII travaille pour toi en arrière-plan. Active ou désactive chaque automatisation selon tes besoins.</p>

    <div class="auto-list">${cardsHtml}</div>
    <div class="auto-msg" id="msg"></div>
</div>

<script src="https://unpkg.com/lucide@latest"></script>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

document.querySelectorAll('[data-auto]').forEach(input => {
    input.addEventListener('change', async () => {
        const id = input.dataset.auto;
        const actif = input.checked;
        const msg = document.getElementById('msg');
        msg.textContent = '⏳ Mise à jour...';

        try {
            const res = await fetch('/automatisations/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, actif }),
            });
            const json = await res.json();
            msg.textContent = json.success ? '✅ Enregistré.' : '❌ Erreur.';
            setTimeout(() => { msg.textContent = ''; }, 2000);
        } catch (err) {
            msg.textContent = '❌ Erreur réseau.';
            input.checked = !actif;
        }
    });
});
</script>
</body>
</html>`);
});

router.post("/toggle", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session.workspaceId;
        const { id, actif } = req.body;

        const validIds = AUTOMATISATIONS.map(a => a.id);
        if (!validIds.includes(id)) {
            return res.json({ success: false, error: "Automatisation inconnue." });
        }

        const workspace = await workspaceService.getById(workspaceId);
        if (!workspace) return res.json({ success: false, error: "Workspace introuvable." });

        const automatisations = { ...workspace.automatisations, [id]: !!actif };

        await workspaceService.update(workspace.recordId, {
            automatisations: JSON.stringify(automatisations),
        });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /automatisations/toggle :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
