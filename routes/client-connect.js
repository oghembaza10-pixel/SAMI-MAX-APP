// ==========================================================================
// SAMII OS — CLIENT CONNECT — Réseaux sociaux du particulier
// ==========================================================================
const express = require("express");
const router  = express.Router();
const connectorService = require("../services/connectorService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const RESEAUX_CLIENT = [
    { id: "instagram", label: "Instagram",         icon: "instagram",      color: "#E1306C", available: true },
    { id: "facebook",  label: "Facebook",          icon: "facebook",       color: "#1877F2", available: true },
    { id: "telegram",  label: "Telegram",          icon: "send",           color: "#229ED9", available: true },
    { id: "whatsapp",  label: "WhatsApp",          icon: "message-circle", color: "#25D366", available: true, mode: "impression" },
    { id: "tiktok",    label: "TikTok",            icon: "music",          color: "#010101", available: true, mode: "impression" },
];

router.get("/", requireAuth, async (req, res) => {
    // On utilise l'ID utilisateur comme identifiant de connecteurs (pas de workspace pour un Client)
    const userId = req.session.userId;
    const connecteurs = await connectorService.getByWorkspace(userId);

    const cardsHtml = RESEAUX_CLIENT.map(r => {
        const connecteur = connecteurs.find(c => c.type === r.id);
        const isConnected = connecteur && connecteur.actif;
        const badge = isConnected && r.mode === "impression"
            ? `<span class="cc-badge cc-badge--soon">🟡 Connecté · bientôt actif</span>`
            : isConnected
                ? `<span class="cc-badge cc-badge--on">✅ Connecté</span>`
                : `<span class="cc-badge cc-badge--off">🔴 Non connecté</span>`;

        return `
        <div class="cc-card" style="--tool-color:${r.color}">
            <div class="cc-card__icon"><i data-lucide="${r.icon}"></i></div>
            <div class="cc-card__body">
                <h3>${r.label}</h3>
                ${badge}
            </div>
            ${isConnected
                ? `<button class="cc-btn cc-btn--off" data-tool="${r.id}" data-action="disconnect">Déconnecter</button>`
                : `<a href="/client-qg/connect/${r.id}" class="cc-btn cc-btn--on">Connecter →</a>`
            }
        </div>`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Mes réseaux — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/client-style.css">
    <style>
        .cc-shell { max-width: 700px; margin: 0 auto; padding: 40px 24px 80px; }
        .cc-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .cc-back:hover { color: var(--cyan-tech); }
        .cc-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .cc-icon-box {
            width: 46px; height: 46px; border-radius: 13px;
            background: radial-gradient(circle, rgba(157,92,255,0.28), rgba(95,212,255,0.08));
            border: 1px solid rgba(157,92,255,0.45);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.35rem; flex-shrink: 0;
        }
        .cc-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.55rem; }
        .cc-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 22px; line-height: 1.6; }

        .cc-note {
            display: flex; gap: 10px; padding: 14px 16px; margin-bottom: 22px; border-radius: 12px;
            background: rgba(197,160,89,0.08); border: 1px solid rgba(197,160,89,0.3);
            font-size: .78rem; color: var(--text-muted); line-height: 1.6;
        }

        .cc-list { display: flex; flex-direction: column; gap: 10px; }
        .cc-card {
            display: flex; align-items: center; gap: 14px;
            background: var(--bg-glass); backdrop-filter: blur(10px);
            border: var(--border-soft); border-radius: 14px; padding: 16px 18px;
        }
        .cc-card__icon {
            width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
            background: color-mix(in srgb, var(--tool-color) 15%, transparent);
            color: var(--tool-color); display: flex; align-items: center; justify-content: center;
        }
        .cc-card__body { flex: 1; min-width: 0; }
        .cc-card__body h3 { color: #fff; font-size: .92rem; margin-bottom: 4px; }
        .cc-badge { font-family: var(--font-mono); font-size: .68rem; padding: 3px 10px; border-radius: 20px; }
        .cc-badge--on { background: rgba(61,220,132,0.12); color: #3ddc84; }
        .cc-badge--off { background: rgba(255,255,255,0.06); color: var(--text-muted); }
        .cc-badge--soon { background: rgba(197,160,89,0.1); color: #C5A059; }
        .cc-btn {
            padding: 9px 16px; border-radius: 8px; font-size: .8rem; font-weight: 700;
            text-decoration: none; border: none; cursor: pointer; flex-shrink: 0;
        }
        .cc-btn--on { background: #9d5cff; color: #fff; }
        .cc-btn--off { background: rgba(229,85,85,0.12); color: #e55; border: 1px solid rgba(229,85,85,0.3); }
    </style>
</head>
<body>
<div class="cc-shell">
    <a href="/client-qg" class="cc-back">← Retour à mon espace</a>

    <div class="cc-title">
        <div class="cc-icon-box">📡</div>
        <h1>Mes réseaux</h1>
    </div>
    <p class="sub">Connecte tes comptes — SAMII pourra bientôt gérer tes réseaux pour toi.</p>

    <div class="cc-note">
        ℹ️ Certains réseaux (WhatsApp, TikTok) sont en attente de validation officielle. Connecte-toi dès maintenant — SAMII activera la gestion automatique dès que l'API sera disponible.
    </div>

    <div class="cc-list">${cardsHtml}</div>
</div>

<script src="https://unpkg.com/lucide@latest"></script>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

document.querySelectorAll('[data-action="disconnect"]').forEach(btn => {
    btn.addEventListener('click', async () => {
        const toolId = btn.dataset.tool;
        await fetch('/client-qg/connect/disconnect', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toolId }),
        });
        window.location.reload();
    });
});
</script>
</body>
</html>`);
});

// ── Connexion simple (impression) pour WhatsApp/TikTok, en attendant les vraies API ──
router.get("/:reseau", requireAuth, (req, res) => {
    const reseau = RESEAUX_CLIENT.find(r => r.id === req.params.reseau);
    if (!reseau) return res.redirect("/client-qg/connect");

    if (reseau.id === "instagram" || reseau.id === "facebook") {
        return res.redirect("/auth/meta");
    }
    if (reseau.id === "telegram") {
        return res.redirect("/connect/telegram");
    }

    // Mode impression pour WhatsApp/TikTok
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Connecter ${reseau.label} — SAMII</title>
    <link rel="stylesheet" href="/css/client-style.css">
</head>
<body>
<div style="max-width:420px;margin:60px auto;padding:0 24px;">
    <div style="background:#0d0a1a;border:1px solid rgba(157,92,255,0.3);border-radius:16px;padding:32px;text-align:center;">
        <h2 style="color:#fff;margin-bottom:10px;">Connecter ${reseau.label}</h2>
        <p style="color:#8b86a3;font-size:.85rem;margin-bottom:20px;">Entre ton identifiant — SAMII gérera ce réseau dès que l'API sera activée.</p>
        <form id="form-connect">
            <input type="text" name="identifiant" placeholder="@pseudo ou numéro" required
                   style="width:100%;padding:11px;border-radius:9px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:#fff;margin-bottom:14px;">
            <button type="submit" style="width:100%;padding:13px;background:#9d5cff;border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer;">Connecter →</button>
        </form>
        <a href="/client-qg/connect" style="display:block;margin-top:16px;color:#8b86a3;text-decoration:none;font-size:.82rem;">← Retour</a>
    </div>
</div>
<script>
document.getElementById('form-connect').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await fetch('/client-qg/connect/${reseau.id}/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    window.location.href = '/client-qg/connect';
});
</script>
</body>
</html>`);
});

router.post("/:reseau/save", requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        await connectorService.save(userId, req.params.reseau, {
            identifiant: req.body.identifiant,
            mode: "impression",
        });
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: "Erreur." });
    }
});

router.post("/disconnect", requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        await connectorService.disconnect(userId, req.body.toolId);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: "Erreur." });
    }
});

module.exports = router;
