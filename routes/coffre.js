// ==========================================================================
// SAMII OS — LE COFFRE OG (objets consommables : Forteresse, Boost)
// ==========================================================================

const express = require("express");
const router   = express.Router();
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const ITEMS = {
    forteresse: {
        label: "Forteresse",
        icon: "shield",
        desc: "Protège ta réputation pendant 7 jours — le temps de gérer un problème client en coulisses.",
        durationDays: 7,
    },
    boost: {
        label: "Boost Visibilité",
        icon: "zap",
        desc: "Augmente ta visibilité pendant 3 jours.",
        durationDays: 3,
    },
};

function isActive(item) {
    return item?.activeUntil && new Date(item.activeUntil) > new Date();
}

router.get("/", requireAuth, async (req, res) => {
    const workspace = await workspaceService.getById(req.session.workspaceId);
    if (!workspace) return res.redirect("/hub");

    console.log("🔍 DEBUG coffre reçu :", JSON.stringify(workspace.coffre));
const coffre = workspace.coffre || { forteresse: {}, boost: {} };

    const cardsHtml = Object.entries(ITEMS).map(([key, item]) => {
        const state = coffre[key] || { charges: 0, activeUntil: null };
        const active = isActive(state);

        return `
        <div class="coffre-card ${active ? "coffre-card--active" : ""}">
            <div class="coffre-card__icon"><i data-lucide="${item.icon}"></i></div>
            <h3>${item.label}</h3>
            <p>${item.desc}</p>
            <div class="coffre-card__status">
                ${active
                    ? `<span class="coffre-badge coffre-badge--on">Actif jusqu'au ${new Date(state.activeUntil).toLocaleDateString("fr-FR")}</span>`
                    : `<span class="coffre-badge">${state.charges || 0} charge(s) disponible(s)</span>`
                }
            </div>
            ${!active ? `<button class="coffre-btn" data-item="${key}" ${state.charges > 0 ? "" : "disabled"}>
                ${state.charges > 0 ? "Activer" : "Aucune charge"}
            </button>` : `<button class="coffre-btn" disabled>Déjà actif</button>`}
        </div>`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Coffre OG — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .coffre-shell { max-width: 640px; margin: 0 auto; padding: 40px 24px 80px; }
        .coffre-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; margin-bottom: 6px; }
        .coffre-shell p.sub { color: var(--text-muted); font-size: .85rem; margin-bottom: 26px; }
        .coffre-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
        .coffre-card {
            background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft);
            border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 10px;
        }
        .coffre-card--active { border-color: rgba(61,220,132,0.4); box-shadow: 0 0 20px rgba(61,220,132,0.12); }
        .coffre-card__icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(197,160,89,0.12); color: var(--gold-og); display: flex; align-items: center; justify-content: center; }
        .coffre-card h3 { color: #fff; font-size: 1rem; }
        .coffre-card p { color: var(--text-muted); font-size: .8rem; line-height: 1.5; }
        .coffre-badge { font-family: var(--font-mono); font-size: .68rem; padding: 3px 10px; border-radius: 20px; background: rgba(197,160,89,0.1); color: var(--gold-og); border: 1px solid rgba(197,160,89,0.2); align-self: flex-start; }
        .coffre-badge--on { background: rgba(61,220,132,0.1); color: #3ddc84; border-color: rgba(61,220,132,0.3); }
        .coffre-btn { padding: 10px; border-radius: 8px; border: none; background: var(--gold-og); color: #000; font-weight: 700; cursor: pointer; margin-top: 6px; }
        .coffre-btn:disabled { background: rgba(255,255,255,0.08); color: var(--text-muted); cursor: not-allowed; }
        .coffre-msg { text-align: center; margin-top: 16px; font-size: .85rem; color: #3ddc84; min-height: 20px; }
    </style>
</head>
<body>
<div class="coffre-shell">
    <h1>🗝️ Coffre OG</h1>
    <p class="sub">Tes objets stratégiques — activables quand tu en as besoin.</p>
    <div class="coffre-grid">${cardsHtml}</div>
    <div class="coffre-msg" id="msg"></div>
</div>
<script src="https://unpkg.com/lucide@latest"></script>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

document.querySelectorAll(".coffre-btn[data-item]").forEach(btn => {
    btn.addEventListener("click", async () => {
        const item = btn.dataset.item;
        btn.disabled = true;
        btn.textContent = "Activation...";
        const res = await fetch("/coffre/activate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item }),
        });
        const json = await res.json();
        const msg = document.getElementById("msg");
        if (json.success) {
            msg.textContent = "✅ Objet activé !";
            setTimeout(() => window.location.reload(), 900);
        } else {
            msg.textContent = json.error || "❌ Erreur.";
            btn.disabled = false;
            btn.textContent = "Activer";
        }
    });
});
</script>
</body>
</html>`);
});

router.post("/activate", requireAuth, async (req, res) => {
    try {
        const { item } = req.body;
        if (!ITEMS[item]) return res.json({ success: false, error: "Objet inconnu." });

        const workspace = await workspaceService.getById(req.session.workspaceId);
        if (!workspace) return res.json({ success: false, error: "Workspace introuvable." });

        const coffre = workspace.coffre || {};
        const state = coffre[item] || { charges: 0, activeUntil: null };

        if (isActive(state)) {
            return res.json({ success: false, error: "Déjà actif." });
        }
        if (!state.charges || state.charges <= 0) {
            return res.json({ success: false, error: "Aucune charge disponible." });
        }

        const durationMs = ITEMS[item].durationDays * 24 * 60 * 60 * 1000;
        coffre[item] = {
            charges: state.charges - 1,
            activeUntil: new Date(Date.now() + durationMs).toISOString(),
        };

        await workspaceService.update(workspace.recordId, {
            coffre: JSON.stringify(coffre),
        });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /coffre/activate :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
