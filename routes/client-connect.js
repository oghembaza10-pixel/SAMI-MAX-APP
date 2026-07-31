// ==========================================================================
// SAMII OS — CLIENT : CONNECTER MES RÉSEAUX
// ==========================================================================
const express = require("express");
const router  = express.Router();
const connectorService = require("../services/connectorService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const RESEAUX = [
    { id: "telegram_client",  label: "Telegram",  icon: "send",            color: "#229ED9", mode: "reel" },
    { id: "whatsapp_client",  label: "WhatsApp",  icon: "message-circle",  color: "#25D366", mode: "impression" },
    { id: "facebook_client",  label: "Facebook",  icon: "facebook",        color: "#1877F2", mode: "impression" },
    { id: "instagram_client", label: "Instagram", icon: "instagram",       color: "#E1306C", mode: "impression" },
    { id: "tiktok_client",    label: "TikTok",    icon: "music",           color: "#010101", mode: "impression" },
];

router.get("/", requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const connecteurs = await connectorService.getByWorkspace(userId);

    const cardsHtml = RESEAUX.map(r => {
        const connecteur = connecteurs.find(c => c.type === r.id);
        const isConnected = connecteur && connecteur.actif;

        return `
        <div class="cn-card ${isConnected ? 'cn-card--connected' : ''}" style="--tool-color:${r.color}">
            <div class="cn-card__glow"></div>
            <div class="cn-card__header">
                <div class="cn-card__icon"><i data-lucide="${r.icon}"></i></div>
                <div class="cn-card__info">
                    <h3>${r.label}</h3>
                    ${isConnected
                        ? (r.mode === "impression"
                            ? `<span class="cn-badge cn-badge--soon">🟡 Connecté · bientôt synchronisé</span>`
                            : `<span class="cn-badge cn-badge--live">✅ Connecté</span>`)
                        : `<span class="cn-badge cn-badge--off">🔴 Non connecté</span>`
                    }
                </div>
            </div>
            <div class="cn-card__body">
                ${isConnected
                    ? `<button class="cn-btn cn-btn--disconnect" data-tool="${r.id}">Déconnecter</button>`
                    : `<a href="/client-qg/connect/${r.id}" class="cn-btn cn-btn--primary">Connecter ${r.label} →</a>`
                }
            </div>
        </div>`;
    }).join("");

    const totalConnectes = RESEAUX.filter(r => {
        const c = connecteurs.find(x => x.type === r.id);
        return c && c.actif;
    }).length;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Connecter mes réseaux — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/client-style.css">
    <style>
        .cn-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; padding: 24px 36px 0; }
        .cn-back:hover { color: var(--cyan-tech); }

        /* ── HERO futuriste ── */
        .cn-hero {
            position: relative; padding: 40px 36px 44px; overflow: hidden;
            border-bottom: var(--border-soft);
        }
        .cn-hero::before {
            content: '';
            position: absolute; inset: 0; pointer-events: none;
            background-image:
                linear-gradient(rgba(157,92,255,0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(95,212,255,0.06) 1px, transparent 1px);
            background-size: 52px 52px;
            mask-image: radial-gradient(ellipse 600px 350px at 25% 30%, black, transparent);
        }
        .cn-hero__glow {
            position: absolute; width: 400px; height: 400px; border-radius: 50%;
            background: #9d5cff; filter: blur(120px); opacity: .18;
            top: -100px; right: -80px; pointer-events: none;
        }
        .cn-hero__content { position: relative; z-index: 1; max-width: 640px; }
        .cn-eyebrow { font-family: var(--font-mono); letter-spacing: .16em; font-size: .7rem; color: var(--violet, #9d5cff); text-transform: uppercase; display: block; margin-bottom: 10px; }
        .cn-hero__content h1 { font-family: var(--font-display); font-size: clamp(1.5rem, 3vw, 2.1rem); color: #fff; text-shadow: 0 0 30px rgba(157,92,255,0.4); }
        .cn-hero__content p { margin-top: 10px; color: var(--text-muted); font-size: .92rem; line-height: 1.6; }

        .cn-status-pill {
            display: inline-flex; align-items: center; gap: 8px; margin-top: 18px;
            padding: 8px 16px; border-radius: 30px;
            background: rgba(157,92,255,0.1); border: 1px solid rgba(157,92,255,0.3);
            font-family: var(--font-mono); font-size: .78rem; color: #b47fff;
        }
        .cn-status-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: #3ddc84; box-shadow: 0 0 6px #3ddc84; }

        /* ── GRILLE ── */
        .cn-section { padding: 36px; }
        .cn-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 18px; max-width: 1100px; }

        .cn-card {
            position: relative;
            background: var(--bg-panel);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 18px; padding: 22px;
            overflow: hidden;
            transition: transform .3s ease, border-color .3s ease, box-shadow .3s ease;
        }
        .cn-card:hover { transform: translateY(-4px); border-color: color-mix(in srgb, var(--tool-color) 45%, transparent); }
        .cn-card--connected { border-color: color-mix(in srgb, var(--tool-color) 40%, transparent); box-shadow: 0 0 24px color-mix(in srgb, var(--tool-color) 15%, transparent); }

        .cn-card__glow {
            position: absolute; inset: 0; pointer-events: none;
            background: radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--tool-color) 12%, transparent), transparent 60%);
        }

        .cn-card__header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; position: relative; z-index: 1; }
        .cn-card__icon {
            width: 42px; height: 42px; border-radius: 12px;
            background: color-mix(in srgb, var(--tool-color) 16%, transparent);
            color: var(--tool-color);
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .cn-card__icon i { width: 20px; height: 20px; }
        .cn-card__info { flex: 1; min-width: 0; }
        .cn-card__info h3 { color: #fff; font-size: .95rem; font-weight: 700; }
        .cn-badge { display: inline-block; font-size: .66rem; padding: 3px 9px; border-radius: 20px; margin-top: 5px; font-family: var(--font-mono); }
        .cn-badge--live { background: rgba(61,220,132,0.12); color: #3ddc84; }
        .cn-badge--soon { background: rgba(197,160,89,0.12); color: #C5A059; }
        .cn-badge--off { background: rgba(255,255,255,0.06); color: var(--text-muted); }

        .cn-card__body { position: relative; z-index: 1; }
        .cn-btn {
            display: block; width: 100%; text-align: center; padding: 11px; border-radius: 9px;
            text-decoration: none; font-weight: 700; font-size: .84rem; border: none; cursor: pointer;
            box-sizing: border-box; transition: opacity .2s ease;
        }
        .cn-btn:hover { opacity: .88; }
        .cn-btn--primary { background: var(--tool-color); color: #fff; }
        .cn-btn--disconnect { background: rgba(229,85,85,0.12); color: #e55; border: 1px solid rgba(229,85,85,0.3); }

        @media (max-width: 700px) {
            .cn-back, .cn-hero, .cn-section { padding-left: 20px; padding-right: 20px; }
            .cn-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <a href="/client-qg" class="cn-back">← Retour à mon espace</a>

    <section class="cn-hero">
        <div class="cn-hero__glow"></div>
        <div class="cn-hero__content">
            <span class="cn-eyebrow">Centre de connexion</span>
            <h1>Connecter mes réseaux</h1>
            <p>Relie tes comptes — SAMII pourra bientôt y répondre à ta place, automatiquement.</p>
            <div class="cn-status-pill">
                <span class="dot"></span>
                ${totalConnectes} / ${RESEAUX.length} réseaux connectés
            </div>
        </div>
    </section>

    <section class="cn-section">
        <div class="cn-grid">${cardsHtml}</div>
    </section>

<script src="https://unpkg.com/lucide@latest"></script>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();
document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', async () => {
        await fetch('/client-qg/connect/disconnect', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toolId: btn.dataset.tool }),
        });
        window.location.reload();
    });
});
</script>
</body>
</html>`);
});

router.get("/telegram_client", requireAuth, (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Connecter Telegram</title><link rel="stylesheet" href="/css/client-style.css"></head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;">
    <div style="background:#0d0a1a;border:1px solid rgba(157,92,255,0.3);border-radius:16px;padding:40px;max-width:400px;text-align:center;">
        <div style="font-size:3rem;">✈️</div>
        <h2 style="color:#fff;margin-top:10px;">Connecter Telegram</h2>
        <p style="color:#888;font-size:.85rem;margin:10px 0 20px;">Un clic, connexion automatique.</p>
        <a href="https://t.me/SAMII_OGBot?start=client_${req.session.userId}" target="_blank"
           style="display:block;padding:13px;background:#229ED9;border-radius:10px;color:#fff;font-weight:700;text-decoration:none;">
            ✈️ Connecter avec Telegram
        </a>
        <a href="/client-qg/connect" style="display:block;margin-top:16px;color:#888;text-decoration:none;font-size:.82rem;">← Retour</a>
    </div>
</body>
</html>`);
});

["whatsapp_client", "facebook_client", "instagram_client", "tiktok_client"].forEach(id => {
    const reseau = RESEAUX.find(r => r.id === id);
    router.get(`/${id}`, requireAuth, (req, res) => {
        res.send(`<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Connecter ${reseau.label}</title><link rel="stylesheet" href="/css/client-style.css"></head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;">
    <div style="background:#0d0a1a;border:1px solid rgba(157,92,255,0.3);border-radius:16px;padding:40px;max-width:400px;text-align:center;">
        <h2 style="color:#fff;">Connecter ${reseau.label}</h2>
        <p style="color:#888;font-size:.85rem;margin:10px 0 20px;">Permissions officielles bientôt disponibles — connecte-toi dès maintenant en mode simplifié.</p>
        <form method="POST" action="/client-qg/connect/${id}/save">
            <input type="text" name="identifiant" placeholder="Ton pseudo/identifiant ${reseau.label}" required
                   style="width:100%;padding:11px;border-radius:9px;border:1px solid rgba(255,255,255,0.1);background:#000;color:#fff;margin-bottom:14px;">
            <button type="submit" style="width:100%;padding:13px;background:${reseau.color};border:none;border-radius:10px;color:#fff;font-weight:700;">Connecter ${reseau.label}</button>
        </form>
        <a href="/client-qg/connect" style="display:block;margin-top:16px;color:#888;text-decoration:none;font-size:.82rem;">← Retour</a>
    </div>
</body>
</html>`);
    });

    router.post(`/${id}/save`, requireAuth, async (req, res) => {
        await connectorService.save(req.session.userId, id, {
            identifiant: req.body.identifiant,
            mode: "impression",
            connectedAt: new Date().toISOString(),
        });
        res.redirect("/client-qg/connect");
    });
});

router.post("/disconnect", requireAuth, async (req, res) => {
    await connectorService.disconnect(req.session.userId, req.body.toolId);
    res.json({ success: true });
});

module.exports = router;
