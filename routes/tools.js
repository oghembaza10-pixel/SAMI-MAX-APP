// ==========================================================================
// SAMII OS — CONNECTER MES OUTILS + MES OUTILS
// ==========================================================================

const express = require("express");
const router   = express.Router();

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const MODULES = [
    { type: "facebook",  label: "Facebook",  icon: "facebook",       color: "#1877F2" },
    { type: "instagram", label: "Instagram", icon: "instagram",      color: "#E1306C" },
    { type: "whatsapp",  label: "WhatsApp",  icon: "message-circle", color: "#25D366" },
    { type: "telegram",  label: "Telegram",  icon: "send",           color: "#229ED9" },
    { type: "tiktok",    label: "TikTok",    icon: "music-2",        color: "#25F4EE" },
    { type: "linkedin",  label: "LinkedIn",  icon: "linkedin",       color: "#0A66C2" },
    { type: "x",         label: "X",         icon: "twitter",        color: "#E7E9EA" },
    { type: "youtube",   label: "YouTube",   icon: "youtube",        color: "#FF0000" },
    { type: "gmail",     label: "Gmail",     icon: "mail",           color: "#EA4335", comingSoon: true },
];

function renderPage({ title, subtitle, mode }) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title} — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .tools-shell { max-width: 900px; margin: 0 auto; padding: 40px 24px 80px; }
        .tools-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.6rem; margin-bottom: 6px; }
        .tools-shell p.sub { color: var(--text-muted); font-size: .88rem; margin-bottom: 26px; }

        .tools-tabs { display: flex; gap: 10px; margin-bottom: 26px; }
        .tools-tabs a {
            padding: 8px 16px; border-radius: 20px; font-size: .82rem; text-decoration: none;
            color: var(--text-muted); border: 1px solid rgba(255,255,255,0.08); transition: all .2s ease;
        }
        .tools-tabs a.active { color: var(--gold-og); border-color: rgba(197,160,89,0.4); background: rgba(197,160,89,0.06); }
        .tools-tabs a:hover { color: var(--cyan-tech); }

        .tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; }

        .tool-card {
            position: relative;
            background: var(--bg-glass); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.06);
            border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 10px;
            transition: all .25s ease;
        }
        .tool-card--off { opacity: .55; }
        .tool-card--off .tool-card__icon { background: rgba(255,255,255,0.05); color: var(--text-muted); }
        .tool-card--off h3 { color: var(--text-muted); }

        .tool-card--on {
            opacity: 1;
            border-color: color-mix(in srgb, var(--brand) 45%, transparent);
            box-shadow: 0 0 22px color-mix(in srgb, var(--brand) 18%, transparent);
        }
        .tool-card--on .tool-card__icon { background: color-mix(in srgb, var(--brand) 20%, transparent); color: var(--brand); }
        .tool-card--on h3 { color: #fff; }

        .tool-card__icon {
            width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center;
            justify-content: center; transition: all .25s ease;
        }
        .tool-card__icon i { width: 20px; height: 20px; }
        .tool-card h3 { font-size: .95rem; font-weight: 600; }

        .tool-badge {
            font-family: var(--font-mono); font-size: .62rem; padding: 3px 10px;
            border-radius: 20px; align-self: flex-start; display: flex; align-items: center; gap: 5px;
        }
        .tool-badge--on { background: rgba(61,220,132,0.14); color: #3ddc84; }
        .tool-badge--off { background: rgba(255,255,255,0.06); color: var(--text-muted); }
        .tool-badge__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        .tool-btn {
            padding: 9px; border-radius: 8px; border: none; font-weight: 700; font-size: .82rem;
            cursor: pointer; text-align: center; text-decoration: none; transition: all .2s ease;
        }
        .tool-btn--connect { background: var(--gold-og); color: #000; }
        .tool-btn--connect:hover { background: var(--gold-hover); }
        .tool-btn--disabled { background: rgba(255,255,255,0.05); color: var(--text-muted); cursor: not-allowed; pointer-events: none; }

        .shop-form { display: flex; gap: 8px; }
        .shop-form input {
            flex: 1; padding: 9px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);
            background: rgba(0,0,0,0.3); color: var(--text-main); font-size: .8rem;
        }
        .shop-form input:focus { outline: none; border-color: var(--cyan-tech); }

        .tools-empty { color: var(--text-muted); font-size: .88rem; text-align: center; padding: 40px 0; }
    </style>
</head>
<body>
<div class="tools-shell">
    <div class="tools-tabs">
        <a href="/connecter" class="${mode === "connecter" ? "active" : ""}">Connecter mes outils</a>
        <a href="/outils" class="${mode === "outils" ? "active" : ""}">Mes outils</a>
    </div>
    <h1>${title}</h1>
    <p class="sub">${subtitle}</p>
    <div class="tools-grid" id="tools-grid">
        <p class="tools-empty">Chargement...</p>
    </div>
</div>
<script src="https://unpkg.com/lucide@latest"></script>
<script>
const MODE = "${mode}";

async function loadTools() {
    let connecteurs = {};
    try {
        const res = await fetch("/api/connecteurs");
        const json = await res.json();
        connecteurs = json.connecteurs || {};
    } catch {}

    const modules = ${JSON.stringify(MODULES)};
    const grid = document.getElementById("tools-grid");

    const shopifyCard = \`
        <div class="tool-card tool-card--off" style="--brand:#95BF47;">
            <div class="tool-card__icon"><i data-lucide="shopping-bag"></i></div>
            <h3>Shopify</h3>
            <span class="tool-badge tool-badge--off"><span class="tool-badge__dot"></span>Non connecté</span>
            <form class="shop-form" onsubmit="event.preventDefault(); window.location.href='/auth/shopify?shop=' + document.getElementById('shop-input').value.trim();">
                <input id="shop-input" placeholder="maboutique.myshopify.com" required>
                <button class="tool-btn tool-btn--connect" type="submit">Connecter</button>
            </form>
        </div>
    \`;

    let html = MODE === "connecter" ? shopifyCard : "";

    modules.forEach(m => {
        const state = connecteurs[m.type];
        const isConnected = state?.actif === true;

        if (MODE === "outils" && !isConnected) return;
        if (m.comingSoon && MODE === "outils") return;

        const stateClass = isConnected ? "tool-card--on" : "tool-card--off";
        const badgeClass = isConnected ? "tool-badge--on" : "tool-badge--off";
        const badgeText  = isConnected ? "Connecté" : (m.comingSoon ? "Bientôt disponible" : "Non connecté");

        let actionHtml = "";
        if (MODE === "connecter" && !isConnected) {
            actionHtml = m.comingSoon
                ? \`<span class="tool-btn tool-btn--disabled">Bientôt</span>\`
                : \`<a href="/connect/\${m.type}" class="tool-btn tool-btn--connect">Connecter</a>\`;
        }

        html += \`
        <div class="tool-card \${stateClass}" style="--brand:\${m.color}">
            <div class="tool-card__icon"><i data-lucide="\${m.icon}"></i></div>
            <h3>\${m.label}</h3>
            <span class="tool-badge \${badgeClass}"><span class="tool-badge__dot"></span>\${badgeText}</span>
            \${actionHtml}
        </div>\`;
    });

    grid.innerHTML = html || '<p class="tools-empty">Aucun outil connecté pour l\\'instant.</p>';
    if (typeof lucide !== "undefined") lucide.createIcons();
}

loadTools();
</script>
</body>
</html>`;
}

router.get("/connecter", requireAuth, (req, res) => {
    res.send(renderPage({
        title: "🔌 Connecter mes outils",
        subtitle: "Relie tes réseaux et ta boutique pour que SAMII puisse agir dessus.",
        mode: "connecter",
    }));
});

router.get("/outils", requireAuth, (req, res) => {
    res.send(renderPage({
        title: "🧰 Mes outils",
        subtitle: "Ce qui est déjà connecté à ton QG.",
        mode: "outils",
    }));
});

module.exports = router;
