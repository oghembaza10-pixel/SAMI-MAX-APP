// ==========================================================================
// SAMII OS — MODES DE SAMII (routes/samii-mode.js)
// ==========================================================================
// Applique T-020 (Centre de Commandement), T-021 (Forteresse),
// T-033 (Couronnement) : 5 postures possibles, changement toujours initié
// par le Général, jamais par SAMII lui-même.
// ==========================================================================

const express = require("express");
const router   = express.Router();
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const MODES = [
    { id: "ombre",    label: "🌑 Ombre",    desc: "SAMII observe et suggère uniquement. Rien ne s'exécute sans ta confirmation, sur chaque action." },
    { id: "copilote", label: "🚀 Copilote", desc: "SAMII exécute seul les actions réversibles. Il demande confirmation dès qu'il y a de l'argent ou de la visibilité publique en jeu." },
    { id: "strategiste", label: "⚔️ Stratège", desc: "SAMII agit seul dans les limites que tu fixes (budget, règles). Il ne t'alerte que pour les exceptions." },
    { id: "autonome", label: "🛡️ Autonome",  desc: "SAMII gère le quotidien seul. Résumé périodique au lieu d'une confirmation à chaque action." },
    { id: "souverain", label: "👑 Souverain", desc: "Autonomie quasi-totale sur la stratégie validée avec toi. Seules les décisions critiques ou irréversibles remontent." },
];

router.get("/mode", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.redirect("/hub");

    const workspace   = await workspaceService.getById(workspaceId);
    const currentMode = workspace?.samii?.mode || "copilote";

    const cardsHtml = MODES.map(m => `
        <label class="mode-card ${m.id === currentMode ? "active" : ""}">
            <input type="radio" name="mode" value="${m.id}" ${m.id === currentMode ? "checked" : ""}>
            <div class="mode-card__body">
                <h3>${m.label}</h3>
                <p>${m.desc}</p>
            </div>
        </label>
    `).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Mode de SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .mode-shell { max-width: 640px; margin: 0 auto; padding: 40px 24px 80px; }
        .mode-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; margin-bottom: 6px; }
        .mode-shell p.sub { color: var(--text-muted); font-size: .88rem; margin-bottom: 26px; }
        .mode-card {
            display: flex; gap: 14px; align-items: flex-start;
            background: var(--bg-glass); backdrop-filter: blur(12px);
            border: var(--border-soft); border-radius: 14px; padding: 18px;
            margin-bottom: 12px; cursor: pointer; transition: border-color .2s ease, box-shadow .2s ease;
        }
        .mode-card:hover { border-color: rgba(95,212,255,0.3); }
        .mode-card.active { border-color: var(--cyan-tech); box-shadow: 0 0 20px rgba(95,212,255,0.15); }
        .mode-card input { margin-top: 4px; accent-color: var(--cyan-tech); }
        .mode-card h3 { font-size: .98rem; color: #fff; margin-bottom: 4px; }
        .mode-card p { font-size: .82rem; color: var(--text-muted); line-height: 1.5; }
        .mode-submit {
            width: 100%; padding: 13px; margin-top: 16px; background: var(--gold-og);
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000;
        }
        .mode-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #3ddc84; min-height: 20px; }
    </style>
</head>
<body>
<div class="mode-shell">
    <h1>Mode de SAMII</h1>
    <p class="sub">Toi seul décides du niveau d'autonomie de SAMII. Il ne peut jamais changer ce réglage lui-même.</p>

    <form id="form-mode">
        ${cardsHtml}
        <button type="submit" class="mode-submit">Valider ce mode</button>
    </form>
    <div class="mode-msg" id="msg"></div>
</div>

<script>
document.querySelectorAll('.mode-card input').forEach(input => {
    input.addEventListener('change', () => {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
        input.closest('.mode-card').classList.add('active');
    });
});

document.getElementById('form-mode').addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = new FormData(e.target).get('mode');
    const msg  = document.getElementById('msg');
    msg.textContent = '⏳ Mise à jour...';

    const res  = await fetch('/samii/mode', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ mode }),
    });
    const json = await res.json();
   if (json.success) {
    msg.textContent = '✅ Mode mis à jour ! Redirection...';
    setTimeout(() => window.location.reload(), 900);
} else {
    msg.textContent = '❌ Erreur.';
} 
});
</script>
</body>
</html>`);
});

router.post("/mode", requireAuth, async (req, res) => {
    try {
        const { mode } = req.body;
        const validIds = MODES.map(m => m.id);

        if (!validIds.includes(mode)) {
            return res.json({ success: false, error: "Mode invalide." });
        }

        const workspaceId = req.session.workspaceId;
        const workspace    = await workspaceService.getById(workspaceId);
        if (!workspace) return res.json({ success: false, error: "Workspace introuvable." });

        await workspaceService.update(workspace.recordId, {
            samii: JSON.stringify({ ...workspace.samii, mode }),
        });

        res.json({ success: true, mode });
    } catch (err) {
        console.error("❌ POST /samii/mode :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

function canActAutonomously(mode) {
    return ["strategiste", "autonome", "souverain"].includes(mode);
}

module.exports = router;
module.exports.canActAutonomously = canActAutonomously;
module.exports.MODES = MODES;
