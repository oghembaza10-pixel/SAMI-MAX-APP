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
    { id: "souverain", label: "👑 Souverain", desc: "Une fois que tu prépares une action (ex: une campagne pub), SAMII la lance directement sans attendre ta validation finale. Tu restes celui qui initie chaque action." },
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
<body data-theme="og">
<div class="mode-shell">
    <a href="/qg" style="display:inline-flex;align-items:center;gap:6px;color:var(--text-muted);text-decoration:none;font-size:.82rem;margin-bottom:16px;">← Retour au QG</a>
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
    msg.textContent = '✅ Mode mis à jour ! Retour à SAMII...';
    setTimeout(() => window.location.href = '/samii', 900);
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

        // Autonome/Souverain (le vrai saut de validation) réservés à pro/societe —
        // sinon le marchand croirait avoir un pouvoir qu'il n'a pas réellement.
        if (["autonome", "souverain"].includes(mode) && !["pro", "societe"].includes(workspace.palierAbonnement)) {
            return res.json({ success: false, error: "Ce mode est réservé au palier Souverain. Passe à l'abonnement supérieur pour le débloquer." });
        }

        await workspaceService.update(workspace.recordId, {
            samii: JSON.stringify({ ...workspace.samii, mode }),
        });

        res.json({ success: true, mode });
    } catch (err) {
        console.error("❌ POST /samii/mode :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

const JOURS_SEMAINE = [
    { id: 1, label: "Lundi" }, { id: 2, label: "Mardi" }, { id: 3, label: "Mercredi" },
    { id: 4, label: "Jeudi" }, { id: 5, label: "Vendredi" }, { id: 6, label: "Samedi" }, { id: 0, label: "Dimanche" },
];
const RDV_CONFIG_DEFAUT = { jours_fermes: [5], heure_debut: "09:00", heure_fin: "18:00", duree_creneau_min: 30 };

// Ouvert à tout workspace, quel que soit le métier — un e-commerçant peut
// aussi recevoir des demandes de rendez-vous via le chat SAMII.
router.get("/rdv-config", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.redirect("/hub");

    const workspace = await workspaceService.getById(workspaceId);
    const config = { ...RDV_CONFIG_DEFAUT, ...(workspace?.rdv_config || {}) };

    const joursHtml = JOURS_SEMAINE.map(j => `
        <label class="jour-check">
            <input type="checkbox" name="jours_fermes" value="${j.id}" ${(config.jours_fermes || []).includes(j.id) ? "checked" : ""}>
            ${j.label}
        </label>
    `).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Calendrier RDV — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .rdv-shell { max-width: 520px; margin: 0 auto; padding: 40px 24px 80px; }
        .rdv-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; margin-bottom: 6px; }
        .rdv-shell p.sub { color: var(--text-muted); font-size: .88rem; margin-bottom: 26px; }
        .rdv-field { margin-bottom: 20px; }
        .rdv-field label.title { display:block; color: var(--gold-og); font-size: .82rem; font-weight:700; margin-bottom: 10px; }
        .jours-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .jour-check {
            display: flex; align-items: center; gap: 8px; background: var(--bg-glass); border: var(--border-soft);
            border-radius: 10px; padding: 10px 12px; cursor: pointer; color: var(--text-main); font-size: .85rem;
        }
        .jour-check input { accent-color: var(--gold-og); }
        .heures-row { display: flex; gap: 12px; }
        .heures-row > div { flex: 1; }
        input[type="time"], select {
            width: 100%; padding: 10px 12px; border-radius: 10px; background: var(--bg-glass);
            border: var(--border-soft); color: var(--text-main); font-size: .88rem;
        }
        .rdv-submit {
            width: 100%; padding: 13px; margin-top: 10px; background: var(--gold-og);
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000;
        }
        .rdv-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #3ddc84; min-height: 20px; }
    </style>
</head>
<body data-theme="og">
<div class="rdv-shell">
    <a href="/samii" style="display:inline-flex;align-items:center;gap:6px;color:var(--text-muted);text-decoration:none;font-size:.82rem;margin-bottom:16px;">← Retour à SAMII</a>
    <h1>📅 Calendrier des rendez-vous</h1>
    <p class="sub">Configure tes jours et horaires d'ouverture — SAMII proposera automatiquement ces créneaux aux clients qui demandent un rendez-vous sur Telegram.</p>

    <form id="form-rdv-config">
        <div class="rdv-field">
            <label class="title">Jours fermés</label>
            <div class="jours-grid">${joursHtml}</div>
        </div>
        <div class="rdv-field">
            <label class="title">Horaires d'ouverture</label>
            <div class="heures-row">
                <div><input type="time" name="heure_debut" value="${config.heure_debut}"></div>
                <div><input type="time" name="heure_fin" value="${config.heure_fin}"></div>
            </div>
        </div>
        <div class="rdv-field">
            <label class="title">Durée d'un créneau</label>
            <select name="duree_creneau_min">
                <option value="15" ${config.duree_creneau_min === 15 ? "selected" : ""}>15 minutes</option>
                <option value="30" ${config.duree_creneau_min === 30 ? "selected" : ""}>30 minutes</option>
                <option value="45" ${config.duree_creneau_min === 45 ? "selected" : ""}>45 minutes</option>
                <option value="60" ${config.duree_creneau_min === 60 ? "selected" : ""}>1 heure</option>
            </select>
        </div>
        <button type="submit" class="rdv-submit">Enregistrer</button>
    </form>
    <div class="rdv-msg" id="msg"></div>
</div>

<script>
document.getElementById('form-rdv-config').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const jours_fermes = Array.from(form.querySelectorAll('input[name="jours_fermes"]:checked')).map(el => Number(el.value));
    const heure_debut = form.heure_debut.value || '09:00';
    const heure_fin = form.heure_fin.value || '18:00';
    const duree_creneau_min = Number(form.duree_creneau_min.value) || 30;

    const msg = document.getElementById('msg');
    msg.textContent = '⏳ Enregistrement...';

    const res = await fetch('/samii/rdv-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jours_fermes, heure_debut, heure_fin, duree_creneau_min }),
    });
    const json = await res.json();
    msg.textContent = json.success ? '✅ Enregistré !' : '❌ Erreur.';
});
</script>
</body>
</html>`);
});

router.post("/rdv-config", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session.workspaceId;
        if (!workspaceId) return res.json({ success: false, error: "Workspace introuvable." });

        const { jours_fermes, heure_debut, heure_fin, duree_creneau_min } = req.body;
        const config = {
            jours_fermes: Array.isArray(jours_fermes) ? jours_fermes.map(Number).filter(n => n >= 0 && n <= 6) : [],
            heure_debut: /^\d{2}:\d{2}$/.test(heure_debut) ? heure_debut : "09:00",
            heure_fin: /^\d{2}:\d{2}$/.test(heure_fin) ? heure_fin : "18:00",
            duree_creneau_min: [15, 30, 45, 60].includes(Number(duree_creneau_min)) ? Number(duree_creneau_min) : 30,
        };

        await workspaceService.update(workspaceId, { rdv_config: config });
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /samii/rdv-config :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// Le vrai "saut de validation" (lancer une action sans attendre confirmation)
// est réservé au palier Souverain/Société — Gratuit et Actif peuvent choisir
// n'importe quel mode dans l'interface, mais seuls pro/societe en obtiennent
// l'effet réel. Ça crée une vraie différence de "pouvoir" entre Actif et
// Souverain, plutôt que les 3 modes "autonomes" se comportant à l'identique.
function canActAutonomously(mode, palier) {
    return ["strategiste", "autonome", "souverain"].includes(mode) && ["pro", "societe"].includes(palier);
}

module.exports = router;
module.exports.canActAutonomously = canActAutonomously;
module.exports.MODES = MODES;
