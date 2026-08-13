// ==========================================================================
// SAMII OS — ORACLE FINANCIER (T-015) — Prévisions de revenus
// ==========================================================================
const express = require("express");
const router  = express.Router();
const db      = require("../services/db");
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.redirect("/hub");

    const workspace = await workspaceService.getById(workspaceId);
    if (!workspace) return res.redirect("/hub");

    let previsions = null;

    try {
        // Lisait auparavant une table Airtable "COMMANDES" qui n'est plus la
        // source réelle des commandes — la projection était donc toujours
        // vide, quelle que soit l'activité réelle du marchand.
        const commandes = await db.query(
            `SELECT montant, date_commande FROM commandes WHERE workspace_id = $1 ORDER BY date_commande DESC LIMIT 500`,
            [workspaceId]
        );

        // Regroupe les revenus par jour sur les 30 derniers jours
        const parJour = {};
        const maintenant = Date.now();
        const ilYa30Jours = maintenant - (30 * 24 * 60 * 60 * 1000);

        commandes.forEach(c => {
            if (!c.date_commande) return;
            const date = new Date(c.date_commande).getTime();
            if (date < ilYa30Jours) return;

            const jour = new Date(c.date_commande).toISOString().slice(0, 10);
            parJour[jour] = (parJour[jour] || 0) + (Number(c.montant) || 0);
        });

        const joursAvecDonnees = Object.keys(parJour).length;

        if (joursAvecDonnees >= 5) {
            const totalRevenus30j = Object.values(parJour).reduce((s, v) => s + v, 0);
            const moyenneJournaliere = totalRevenus30j / 30;

            // Compare les 15 premiers jours vs les 15 derniers pour capter une tendance
            const jours = Object.keys(parJour).sort();
            const milieu = Math.floor(jours.length / 2);
            const premiereMoitie = jours.slice(0, milieu).reduce((s, j) => s + parJour[j], 0);
            const secondeMoitie = jours.slice(milieu).reduce((s, j) => s + parJour[j], 0);

            let tendance = "stable";
            let facteurTendance = 1;
            if (premiereMoitie > 0) {
                const variation = (secondeMoitie - premiereMoitie) / premiereMoitie;
                if (variation > 0.15) { tendance = "hausse"; facteurTendance = 1 + Math.min(variation, 0.5); }
                else if (variation < -0.15) { tendance = "baisse"; facteurTendance = 1 + Math.max(variation, -0.5); }
            }

            const projectionMoisProchain = moyenneJournaliere * 30 * facteurTendance;
            const optimiste = projectionMoisProchain * 1.2;
            const pessimiste = projectionMoisProchain * 0.75;

            previsions = {
                moyenneJournaliere: moyenneJournaliere.toFixed(2),
                tendance,
                projection: projectionMoisProchain.toFixed(2),
                optimiste: optimiste.toFixed(2),
                pessimiste: pessimiste.toFixed(2),
                joursAvecDonnees,
            };
        }
    } catch (err) {
        console.error("❌ Oracle Financier :", err.message);
    }

    const tendanceIcon = { hausse: "📈", baisse: "📉", stable: "➡️" };
    const tendanceLabel = { hausse: "En hausse", baisse: "En baisse", stable: "Stable" };
    const tendanceCouleur = { hausse: "#3ddc84", baisse: "#e55", stable: "#5FD4FF" };

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Oracle Financier — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .oracle-shell { max-width: 720px; margin: 0 auto; padding: 40px 24px 80px; }
        .oracle-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .oracle-back:hover { color: var(--cyan-tech); }

        .oracle-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .oracle-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(197,160,89,0.22), rgba(95,212,255,0.06));
            border: 1px solid rgba(197,160,89,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
            box-shadow: 0 0 20px rgba(197,160,89,0.18);
        }
        .oracle-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .oracle-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 26px; line-height: 1.6; }

        .oracle-empty { color: var(--text-muted); font-size: .85rem; text-align: center; padding: 30px 0; }

        .oracle-main {
            background: radial-gradient(circle at 50% 0%, rgba(197,160,89,0.1), transparent 60%), var(--bg-panel);
            border: 1px solid rgba(197,160,89,0.25); border-radius: 20px; padding: 32px; text-align: center;
            margin-bottom: 20px;
        }
        .oracle-main__label { font-family: var(--font-mono); font-size: .72rem; text-transform: uppercase; letter-spacing: .1em; color: var(--gold-og); margin-bottom: 10px; }
        .oracle-main__value { font-family: var(--font-mono); font-weight: 700; font-size: 2.2rem; color: #fff; }
        .oracle-tendance { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: .85rem; font-weight: 600; }

        .oracle-range { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .oracle-range-item {
            background: var(--bg-glass); backdrop-filter: blur(10px);
            border: var(--border-soft); border-radius: 14px; padding: 18px; text-align: center;
        }
        .oracle-range-item .val { font-family: var(--font-mono); font-weight: 700; font-size: 1.3rem; }
        .oracle-range-item .lbl { font-size: .72rem; color: var(--text-muted); margin-top: 4px; }
        .oracle-range-item--opti .val { color: #3ddc84; }
        .oracle-range-item--pessi .val { color: #e55; }

        .oracle-note {
            display: flex; gap: 10px; align-items: flex-start;
            padding: 14px 16px; border-radius: 12px;
            background: rgba(95,212,255,0.06); border: 1px solid rgba(95,212,255,0.2);
            font-size: .78rem; color: var(--text-muted); line-height: 1.6;
        }

        @media (max-width: 560px) {
            .oracle-range { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body data-theme="og">
<div class="oracle-shell">
    <a href="/samii" class="oracle-back">← Retour à SAMII</a>

    <div class="oracle-title">
        <div class="oracle-icon-box">🔮</div>
        <h1>Oracle Financier</h1>
    </div>
    <p class="sub">La projection de tes revenus, basée sur ta tendance des 30 derniers jours.</p>

    ${previsions ? `
    <div class="oracle-main">
        <div class="oracle-main__label">Projection prochain mois (${workspace.devise || 'DZD'})</div>
        <div class="oracle-main__value">${previsions.projection}</div>
        <div class="oracle-tendance" style="color:${tendanceCouleur[previsions.tendance]}">
            ${tendanceIcon[previsions.tendance]} ${tendanceLabel[previsions.tendance]}
        </div>
    </div>

    <div class="oracle-range">
        <div class="oracle-range-item oracle-range-item--pessi">
            <div class="val">${previsions.pessimiste}</div>
            <div class="lbl">Scénario prudent</div>
        </div>
        <div class="oracle-range-item oracle-range-item--opti">
            <div class="val">${previsions.optimiste}</div>
            <div class="lbl">Scénario optimiste</div>
        </div>
    </div>

    <div class="oracle-note">
        🔮 Basé sur ${previsions.joursAvecDonnees} jour(s) d'activité récente, moyenne de ${previsions.moyenneJournaliere} ${workspace.devise || 'DZD'}/jour. Ce n'est pas une garantie, juste une projection à partir de ta tendance actuelle.
    </div>
    ` : `<div class="oracle-empty">Pas encore assez d'historique de commandes pour établir une projection fiable. Reviens quand tu auras plus d'activité (au moins 5 jours de commandes).</div>`}
</div>
</body>
</html>`);
});

module.exports = router;
