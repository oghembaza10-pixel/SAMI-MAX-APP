// ==========================================================================
// SAMII OS — MIROIR (T-014) — Auto-diagnostic de l'activité
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

function getMontant(c) {
    return parseFloat(c.montant || c.Total || 0) || 0;
}

router.get("/", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.redirect("/hub");

    const workspace = await workspaceService.getById(workspaceId);
    if (!workspace) return res.redirect("/hub");

    let diagnostic = null;
    let stats = null;

    try {
        const commandes = await airtable.find("COMMANDES", `{Boutique}="${workspaceId}"`, 300);
        const clients = await airtable.find("CLIENTS", `{workspace_id}="${workspaceId}"`, 200);

        const total_commandes = commandes.length;
        const confirmees = commandes.filter(c => c.fields.Statut === "confirmée").length;
        const annulees = commandes.filter(c => c.fields.Statut === "annulée").length;
        const enAttente = commandes.filter(c => c.fields.Statut === "en attente").length;
        const total_revenus = commandes.reduce((s, c) => s + getMontant(c.fields), 0);
        const tauxConfirmation = total_commandes > 0 ? ((confirmees / total_commandes) * 100).toFixed(0) : "—";

        const vip = clients.filter(c => c.fields.VIP === true).length;
        const blacklist = clients.filter(c => c.fields.Blacklist === true).length;

        const auto = workspace.automatisations || {};
        const autoActives = Object.values(auto).filter(Boolean).length;
        const autoTotal = Object.keys(auto).length;

        const missionsEnCours = (workspace.missions || []).filter(m => !m.fait).length;

        stats = {
            total_commandes, confirmees, annulees, enAttente,
            total_revenus: total_revenus.toFixed(2),
            tauxConfirmation, vip, blacklist,
            autoActives, autoTotal, missionsEnCours,
        };

        if (total_commandes > 0) {
            const prompt = "Tu es SAMII, tu fais le diagnostic honnête de l'activité d'un marchand. Voici ses vraies statistiques :\n\n"
                + `Total commandes : ${total_commandes}\n`
                + `Confirmées : ${confirmees}\n`
                + `Annulées : ${annulees}\n`
                + `En attente : ${enAttente}\n`
                + `Taux de confirmation : ${tauxConfirmation}%\n`
                + `Revenus totaux : ${total_revenus.toFixed(2)}\n`
                + `Clients VIP : ${vip}\n`
                + `Clients en blacklist : ${blacklist}\n`
                + `Automatisations actives : ${autoActives}/${autoTotal}\n`
                + `Missions en attente : ${missionsEnCours}\n\n`
                + "Donne un diagnostic en 3 à 4 points courts et concrets : ce qui va bien, ce qui doit être amélioré, et une recommandation prioritaire claire. Sois direct et honnête, pas complaisant. Réponds en texte simple, sans JSON, sans markdown, avec des tirets pour chaque point.";

            const result = await gemini.chat({
                message: prompt,
                context: { source: "miroir", workspaceId },
                useTools: false,
            });
            diagnostic = result.type === "text" ? result.text : null;
        }
    } catch (err) {
        console.error("❌ Miroir :", err.message);
    }

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Miroir — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .miroir-shell { max-width: 780px; margin: 0 auto; padding: 40px 24px 80px; }
        .miroir-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .miroir-back:hover { color: var(--cyan-tech); }

        .miroir-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .miroir-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(95,212,255,0.2), rgba(197,160,89,0.08));
            border: 1px solid rgba(95,212,255,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
            box-shadow: 0 0 20px rgba(95,212,255,0.18);
        }
        .miroir-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .miroir-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 26px; line-height: 1.6; }

        .miroir-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 26px; }
        .miroir-stat {
            background: var(--bg-glass); backdrop-filter: blur(10px);
            border: var(--border-soft); border-radius: 14px; padding: 16px; text-align: center;
        }
        .miroir-stat .val { font-family: var(--font-mono); font-weight: 700; font-size: 1.3rem; color: var(--cyan-tech); }
        .miroir-stat .lbl { font-size: .68rem; color: var(--text-muted); margin-top: 4px; }

        .miroir-diag {
            background: radial-gradient(circle at 0% 0%, rgba(197,160,89,0.06), transparent 60%), var(--bg-panel);
            border: 1px solid rgba(197,160,89,0.2); border-radius: 16px; padding: 24px;
            color: var(--text-main); font-size: .9rem; line-height: 1.8; white-space: pre-wrap;
        }
        .miroir-diag-title {
            display: flex; align-items: center; gap: 8px;
            font-family: var(--font-mono); font-size: .72rem; text-transform: uppercase; letter-spacing: .1em;
            color: var(--gold-og); margin-bottom: 14px;
        }
        .miroir-empty { color: var(--text-muted); font-size: .85rem; text-align: center; padding: 30px 0; }

        @media (max-width: 560px) {
            .miroir-stats { grid-template-columns: repeat(2, 1fr); }
        }
    </style>
</head>
<body data-theme="og">
<div class="miroir-shell">
    <a href="/samii" class="miroir-back">← Retour à SAMII</a>

    <div class="miroir-title">
        <div class="miroir-icon-box">🪞</div>
        <h1>Miroir</h1>
    </div>
    <p class="sub">Le diagnostic honnête de ton activité, basé sur tes vraies données.</p>

    ${stats ? `
    <div class="miroir-stats">
        <div class="miroir-stat"><div class="val">${stats.total_commandes}</div><div class="lbl">Commandes</div></div>
        <div class="miroir-stat"><div class="val">${stats.tauxConfirmation}%</div><div class="lbl">Taux confirmation</div></div>
        <div class="miroir-stat"><div class="val">${stats.vip}</div><div class="lbl">Clients VIP</div></div>
        <div class="miroir-stat"><div class="val">${stats.autoActives}/${stats.autoTotal}</div><div class="lbl">Automatisations</div></div>
    </div>
    ` : ""}

    ${diagnostic ? `
    <div class="miroir-diag">
        <div class="miroir-diag-title">🪞 Diagnostic de SAMII</div>
        ${diagnostic}
    </div>
    ` : `<div class="miroir-empty">Pas encore assez de commandes pour établir un diagnostic. Reviens quand tu auras plus d'activité.</div>`}
</div>
</body>
</html>`);
});

module.exports = router;
