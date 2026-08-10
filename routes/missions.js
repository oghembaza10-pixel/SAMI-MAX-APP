// ==========================================================================
// SAMII OS — MISSIONS — Liste de tâches concrètes générées par SAMII
// ==========================================================================
const express = require("express");
const router  = express.Router();
const airtable = require("../services/airtable");
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function getMontant(c) {
    return parseFloat(c.montant || c.Total || 0) || 0;
}

async function genererMissions(workspaceId) {
    const missions = [];

    // ── Commandes en attente depuis plus de 24h ──
    try {
        const commandes = await airtable.find("COMMANDES", `AND({Boutique}="${workspaceId}",{Statut}="en attente")`, 50);
        const maintenant = Date.now();

        for (const c of commandes) {
            const f = c.fields;
            const dateCmd = f["Date Commande"] ? new Date(f["Date Commande"]).getTime() : null;
            if (!dateCmd) continue;
            const heuresDepuis = (maintenant - dateCmd) / (1000 * 60 * 60);
            if (heuresDepuis < 24) continue;

            const nomClient = f["nom client"] || f["Nom Client"] || "un client";
            const idCmd = f["ID Commande"] || c.id;

            missions.push({
                id: `cmd_${c.id}`,
                type: "commande",
                icon: "phone-call",
                texte: `Appeler ${nomClient} pour confirmer la commande #${idCmd}`,
                fait: false,
            });
        }
    } catch (err) {
        console.warn("⚠️ Missions (commandes) :", err.message);
    }

    // ── Clients VIP sans offre depuis longtemps ──
    try {
        const vipClients = await airtable.find("CLIENTS", `AND({workspace_id}="${workspaceId}",{VIP}=1)`, 20);
        for (const c of vipClients) {
            const f = c.fields;
            const nom = f["Nom"] || f["Nom Client"] || "un client VIP";
            const derniereOffre = f.derniere_offre_fidelite ? new Date(f.derniere_offre_fidelite) : null;
            const joursDepuis = derniereOffre ? (Date.now() - derniereOffre.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
            if (joursDepuis < 30) continue;

            missions.push({
                id: `vip_${c.id}`,
                type: "vip",
                icon: "crown",
                texte: `Penser à récompenser ${nom}, client fidèle sans offre récente`,
                fait: false,
            });
        }
    } catch (err) {
        console.warn("⚠️ Missions (VIP) :", err.message);
    }

    return missions;
}

router.get("/", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.redirect("/hub");

    const workspace = await workspaceService.getById(workspaceId);
    if (!workspace) return res.redirect("/hub");

    const missionsGenerees = await genererMissions(workspaceId);
    const missionsSauvegardees = workspace.missions || [];

    // Fusionne : garde l'état "fait" des missions déjà connues, ajoute les nouvelles
    const missionsFinales = missionsGenerees.map(m => {
        const existante = missionsSauvegardees.find(s => s.id === m.id);
        return existante ? { ...m, fait: existante.fait } : m;
    });

    // Sauvegarde la liste à jour (pour que les cases cochées persistent au prochain calcul)
    await workspaceService.update(workspace.recordId, {
        missions: JSON.stringify(missionsFinales),
    });

    const enCours = missionsFinales.filter(m => !m.fait);
    const terminees = missionsFinales.filter(m => m.fait);

    const missionHtml = (m) => `
        <label class="mission-item ${m.fait ? 'mission-item--done' : ''}">
            <input type="checkbox" data-mission="${m.id}" ${m.fait ? "checked" : ""}>
            <span class="mission-check"></span>
            <div class="mission-body">
                <i data-lucide="${m.icon}"></i>
                <span>${m.texte}</span>
            </div>
        </label>
    `;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Missions — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .mission-shell { max-width: 680px; margin: 0 auto; padding: 40px 24px 80px; }
        .mission-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .mission-back:hover { color: var(--cyan-tech); }

        .mission-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .mission-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(95,212,255,0.2), rgba(197,160,89,0.08));
            border: 1px solid rgba(95,212,255,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
            box-shadow: 0 0 20px rgba(95,212,255,0.18);
        }
        .mission-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .mission-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 26px; line-height: 1.6; }

        .mission-empty { color: var(--text-muted); font-size: .85rem; text-align: center; padding: 30px 0; }

        .mission-section-title {
            display: flex; align-items: center; gap: 8px;
            font-family: var(--font-mono); font-size: .72rem; text-transform: uppercase; letter-spacing: .1em;
            color: var(--cyan-tech); margin: 24px 0 12px;
        }
        .mission-section-title::before, .mission-section-title::after {
            content: ''; flex: 1; height: 1px; background: linear-gradient(to right, transparent, rgba(95,212,255,0.35), transparent);
        }

        .mission-list { display: flex; flex-direction: column; gap: 10px; }
        .mission-item {
            display: flex; align-items: center; gap: 14px;
            background: var(--bg-glass); backdrop-filter: blur(10px);
            border: var(--border-soft); border-radius: 14px; padding: 16px 18px;
            cursor: pointer; transition: all .2s ease;
        }
        .mission-item:hover { border-color: rgba(95,212,255,0.3); }
        .mission-item input { display: none; }
        .mission-check {
            width: 22px; height: 22px; border-radius: 7px; flex-shrink: 0;
            border: 2px solid rgba(255,255,255,0.15); position: relative;
            transition: all .2s ease;
        }
        .mission-item input:checked + .mission-check {
            background: linear-gradient(135deg, #3ddc84, #24a85c);
            border-color: transparent;
        }
        .mission-item input:checked + .mission-check::after {
            content: '✓'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            color: #000; font-weight: 700; font-size: .85rem;
        }
        .mission-body { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
        .mission-body i { width: 17px; height: 17px; color: var(--gold-og); flex-shrink: 0; }
        .mission-body span { color: var(--text-main); font-size: .87rem; }
        .mission-item--done .mission-body span { color: var(--text-muted); text-decoration: line-through; }
    </style>
</head>
<body data-theme="og">
<div class="mission-shell">
    <a href="/samii" class="mission-back">← Retour à SAMII</a>

    <div class="mission-title">
        <div class="mission-icon-box">🎯</div>
        <h1>Missions</h1>
    </div>
    <p class="sub">Les tâches concrètes que SAMII a repérées pour toi aujourd'hui.</p>

    ${enCours.length ? `
    <div class="mission-section-title">À faire (${enCours.length})</div>
    <div class="mission-list">${enCours.map(missionHtml).join("")}</div>
    ` : `<div class="mission-empty">✅ Aucune mission urgente en ce moment. Tout est sous contrôle.</div>`}

    ${terminees.length ? `
    <div class="mission-section-title">Terminées</div>
    <div class="mission-list">${terminees.map(missionHtml).join("")}</div>
    ` : ""}
</div>

<script src="https://unpkg.com/lucide@latest"></script>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

document.querySelectorAll('[data-mission]').forEach(input => {
    input.addEventListener('change', async () => {
        const id = input.dataset.mission;
        const fait = input.checked;
        try {
            await fetch('/missions/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, fait }),
            });
            setTimeout(() => window.location.reload(), 400);
        } catch (err) {
            input.checked = !fait;
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
        const { id, fait } = req.body;

        const workspace = await workspaceService.getById(workspaceId);
        if (!workspace) return res.json({ success: false, error: "Workspace introuvable." });

        const missions = (workspace.missions || []).map(m =>
            m.id === id ? { ...m, fait: !!fait } : m
        );

        await workspaceService.update(workspace.recordId, {
            missions: JSON.stringify(missions),
        });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /missions/toggle :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
