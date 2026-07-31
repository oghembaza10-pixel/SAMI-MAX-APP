// ==========================================================================
// SAMII OS — MARKETPLACE — Annuaire des marchands OG Empire
// ==========================================================================
const express = require("express");
const router  = express.Router();
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/", requireAuth, async (req, res) => {
    const { metier, ville } = req.query;
    const isClient = req.session?.typeCompte === "client";
    const styleClient = isClient;

    let marchands = await workspaceService.getAllActive();

    if (metier) {
        marchands = marchands.filter(m => (m.metier || "").toLowerCase().includes(metier.toLowerCase()));
    }
    if (ville) {
        marchands = marchands.filter(m => (m.pays || "").toLowerCase().includes(ville.toLowerCase()));
    }

    const cardsHtml = marchands.map(m => `
        <div class="mk-card">
            <div class="mk-card__avatar">${(m.nom || "?").charAt(0).toUpperCase()}</div>
            <div class="mk-card__body">
                <h3>${m.nom}</h3>
                <span class="mk-card__metier">${m.metier || "Non renseigné"}</span>
                <p>${m.description || ""}</p>
                <div class="mk-card__meta">
                    <span class="mk-chip">📍 ${m.pays || "—"}</span>
                </div>
            </div>
        </div>
    `).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Marketplace — OG Empire</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${styleClient ? '/css/client-style.css' : '/css/qg-style.css'}">
    <style>
        .mk-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; padding: 24px 36px 0; }
        .mk-back:hover { color: var(--cyan-tech); }

        .mk-hero { padding: 30px 36px 20px; }
        .mk-hero h1 { font-family: var(--font-display); color: #fff; font-size: 1.6rem; }
        .mk-hero p { color: var(--text-muted); font-size: .88rem; margin-top: 8px; }

        .mk-search { display: flex; gap: 10px; padding: 0 36px 26px; flex-wrap: wrap; }
        .mk-search input {
            flex: 1; min-width: 180px; padding: 12px 14px; border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem;
        }
        .mk-search button {
            padding: 12px 24px; border-radius: 10px; border: none; font-weight: 700; cursor: pointer;
            background: var(--gold-og, #9d5cff); color: #000;
        }

        .mk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; padding: 0 36px 60px; max-width: 1200px; }
        .mk-card { display: flex; gap: 14px; background: var(--bg-panel, var(--bg-glass)); border: var(--border-soft); border-radius: 16px; padding: 18px; }
        .mk-card__avatar {
            width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
            background: linear-gradient(135deg, #9d5cff, #5FD4FF);
            display: flex; align-items: center; justify-content: center;
            font-family: var(--font-display); font-weight: 700; font-size: 1.2rem; color: #fff;
        }
        .mk-card__body h3 { color: #fff; font-size: .95rem; }
        .mk-card__metier { color: var(--cyan-tech); font-size: .74rem; font-family: var(--font-mono); }
        .mk-card__body p { color: var(--text-muted); font-size: .8rem; margin: 6px 0; line-height: 1.5; }
        .mk-chip { font-size: .74rem; padding: 3px 9px; border-radius: 20px; background: rgba(95,212,255,0.08); border: 1px solid rgba(95,212,255,0.2); color: var(--cyan-tech); }
        .mk-empty { color: var(--text-muted); text-align: center; padding: 40px; grid-column: 1/-1; }
    </style>
</head>
<body>
    <a href="${styleClient ? '/client-qg' : '/hub'}" class="mk-back">← Retour</a>
    <div class="mk-hero">
        <h1>🏪 Marketplace</h1>
        <p>Découvre les marchands OG Empire près de toi.</p>
    </div>
    <form class="mk-search" method="GET">
        <input type="text" name="metier" placeholder="Métier (ex : e-commerce, restaurant...)" value="${metier || ''}">
        <input type="text" name="ville" placeholder="Pays / ville" value="${ville || ''}">
        <button type="submit">🔍 Chercher</button>
    </form>
    <div class="mk-grid">
        ${marchands.length ? cardsHtml : '<div class="mk-empty">Aucun marchand trouvé pour cette recherche.</div>'}
    </div>
</body>
</html>`);
});

module.exports = router;
