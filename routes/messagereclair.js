// ==========================================================================
// SAMII OS — MESSAGER ÉCLAIR (T-009) — Suivi colis + notifications client
// ==========================================================================
const express = require("express");
const router  = express.Router();
const airtable = require("../services/airtable");
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

    const commandes = await airtable.find(
        "COMMANDES",
        `AND({Boutique}="${workspaceId}", {Statut}="confirmée", {numero_suivi}="")`,
        30
    );

    const rowsHtml = commandes.map(c => {
        const f = c.fields;
        return `
        <div class="me-row">
            <div class="me-row__info">
                <div class="me-row__id">#${f["ID Commande"] || c.id}</div>
                <div class="me-row__client">${f["nom client"] || f["Nom Client"] || "Client"}</div>
            </div>
            <select class="me-transporteur" data-cmd="${c.id}">
                <option value="yalidine">Yalidine (Algérie)</option>
                <option value="dhl">DHL</option>
                <option value="chronopost">Chronopost</option>
                <option value="colissimo">Colissimo</option>
                <option value="aramex">Aramex</option>
                <option value="sendit">Sendit (Maroc)</option>
                <option value="mallatech">Mallatech (Tunisie)</option>
                <option value="oto">OTO (Égypte/Golfe)</option>
                <option value="autre">Autre transporteur...</option>
            </select>
            <input type="text" class="me-transporteur-custom" data-cmd="${c.id}" placeholder="Nom du transporteur" style="display:none;">
            <input type="text" class="me-numero" data-cmd="${c.id}" placeholder="Numéro de suivi">
            <button type="button" class="me-btn-activer" data-cmd="${c.id}">Activer le suivi</button>
        </div>`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Messager Éclair — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .me-shell { max-width: 780px; margin: 0 auto; padding: 40px 24px 80px; }
        .me-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .me-back:hover { color: var(--cyan-tech); }

        .me-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .me-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(95,212,255,0.2), rgba(197,160,89,0.08));
            border: 1px solid rgba(95,212,255,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
            box-shadow: 0 0 20px rgba(95,212,255,0.18);
        }
        .me-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .me-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 26px; line-height: 1.6; }

        .me-note {
            display: flex; gap: 10px; align-items: flex-start;
            padding: 12px 16px; margin-bottom: 22px; border-radius: 12px;
            background: rgba(197,160,89,0.06); border: 1px solid rgba(197,160,89,0.25);
            font-size: .78rem; color: var(--text-muted); line-height: 1.6;
        }

        .me-empty { color: var(--text-muted); font-size: .85rem; text-align: center; padding: 30px 0; }

        .me-row {
            display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
            background: var(--bg-glass); backdrop-filter: blur(10px);
            border: var(--border-soft); border-radius: 14px; padding: 14px 16px; margin-bottom: 10px;
        }
        .me-row__info { flex: 1; min-width: 140px; }
        .me-row__id { color: #fff; font-size: .85rem; font-weight: 700; }
        .me-row__client { color: var(--text-muted); font-size: .78rem; }

        .me-transporteur, .me-numero, .me-transporteur-custom {
            padding: 9px 12px; border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .82rem; font-family: var(--font-body);
        }
        .me-numero, .me-transporteur-custom { flex: 1; min-width: 140px; }
        .me-transporteur option { background: #0a0d14; }

        .me-btn-activer {
            padding: 9px 16px; border-radius: 8px; border: none;
            background: var(--gold-og); color: #000; font-weight: 700; font-size: .8rem; cursor: pointer;
        }
        .me-btn-activer:disabled { opacity: .6; cursor: not-allowed; }
        .me-btn-activer.done { background: #3ddc84; }
    </style>
</head>
<body>
<div class="me-shell">
    <a href="/samii" class="me-back">← Retour à SAMII</a>

    <div class="me-title">
        <div class="me-icon-box">📬</div>
        <h1>Messager Éclair</h1>
    </div>
    <p class="sub">Active le suivi d'une commande confirmée — SAMII prévient le client à chaque étape, automatiquement.</p>

    <div class="me-note">
        ℹ️ Le suivi automatique en temps réel fonctionne dès maintenant pour Yalidine. Pour les autres transporteurs, le numéro de suivi est enregistré et prêt — la vérification automatique sera activée dès leur intégration.
    </div>

    ${commandes.length ? rowsHtml : `<div class="me-empty">Aucune commande confirmée en attente de suivi pour le moment.</div>`}
</div>

<script>
document.querySelectorAll('.me-transporteur').forEach(function(select) {
    select.addEventListener('change', function() {
        var cmdId = select.dataset.cmd;
        var custom = document.querySelector('.me-transporteur-custom[data-cmd="' + cmdId + '"]');
        custom.style.display = select.value === 'autre' ? 'block' : 'none';
    });
});

document.querySelectorAll('.me-btn-activer').forEach(function(btn) {
    btn.addEventListener('click', async function() {
        var cmdId = btn.dataset.cmd;
        var numero = document.querySelector('.me-numero[data-cmd="' + cmdId + '"]').value.trim();
        var selectTransp = document.querySelector('.me-transporteur[data-cmd="' + cmdId + '"]');
        var transporteur = selectTransp.value === 'autre'
            ? document.querySelector('.me-transporteur-custom[data-cmd="' + cmdId + '"]').value.trim()
            : selectTransp.value;

        if (!numero) { alert('Entre le numéro de suivi.'); return; }
        if (!transporteur) { alert('Indique le nom du transporteur.'); return; }

        btn.disabled = true;
        btn.textContent = '...';

        try {
            const res = await fetch('/samii/messager-eclair/activer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commandeId: cmdId, numero: numero, transporteur: transporteur }),
            });
            const json = await res.json();
            if (json.success) {
                btn.textContent = '✅ Suivi activé';
                btn.classList.add('done');
            } else {
                btn.disabled = false;
                btn.textContent = 'Activer le suivi';
                alert(json.error || 'Erreur.');
            }
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Activer le suivi';
            alert('Erreur réseau.');
        }
    });
});
</script>
</body>
</html>`);
});

router.post("/activer", requireAuth, async (req, res) => {
    try {
        const { commandeId, numero, transporteur } = req.body;
        if (!commandeId || !numero || !transporteur) {
            return res.json({ success: false, error: "Numéro de suivi et transporteur requis." });
        }

        await airtable.update("COMMANDES", commandeId, {
            numero_suivi: numero,
            transporteur: transporteur,
        });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /samii/messager-eclair/activer :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
