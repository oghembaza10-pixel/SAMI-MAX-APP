// ==========================================================================
// SAMII OS — LIVRAISONS — Demander un livreur (côté marchand)
// ==========================================================================
// Un marchand demande un livreur pour une commande — la demande est
// diffusée en temps réel à tous les livreurs en ligne (voir routes/
// livreur.js), qui peuvent l'accepter en premier arrivé, premier servi.
const express = require("express");
const router  = express.Router();
const db = require("../services/db");
const socketService = require("../services/socketService");
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

const STATUT_LABEL = {
    en_attente: "🟡 En attente d'un livreur",
    assignee: "🔵 Livreur en route pour récupérer",
    recuperee: "🟣 Colis récupéré, en livraison",
    livree: "✅ Livrée",
};

router.get("/", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.redirect("/hub");
    const workspace = await workspaceService.getById(workspaceId);

    const demandes = await db.query(
        `SELECT * FROM livraisons WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [workspaceId]
    );

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Livraisons — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <script src="/socket.io/socket.io.js"></script>
    <style>
        .lr-shell { max-width: 680px; margin: 0 auto; padding: 40px 24px 100px; }
        .lr-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .lr-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .lr-icon-box { width: 44px; height: 44px; border-radius: 12px; background: radial-gradient(circle, rgba(95,212,255,0.2), rgba(197,160,89,0.08)); border: 1px solid rgba(95,212,255,0.4); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; }
        .lr-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .lr-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 24px; }
        .lr-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 22px; margin-bottom: 16px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 12px 0 6px; }
        input { width: 100%; padding: 11px 13px; border-radius: 9px; box-sizing: border-box; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: var(--text-main); font-size: .88rem; font-family: var(--font-body); }
        button.lr-btn { padding: 12px 18px; border-radius: 10px; border: none; font-weight: 700; cursor: pointer; font-size: .88rem; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #000; width: 100%; margin-top: 14px; }
        button.lr-btn:disabled { opacity: .5; cursor: not-allowed; }
        .lr-item { border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; font-size: .84rem; }
        .lr-item .statut { font-weight: 700; margin-bottom: 6px; }
        .lr-item .addr { color: var(--text-muted); }
        .lr-empty { color: var(--text-muted); font-size: .85rem; text-align: center; padding: 20px 0; }
        .lr-msg { text-align: center; margin-top: 10px; font-size: .82rem; color: #e55; min-height: 18px; }
        .lr-msg.ok { color: #3ddc84; }
        .lr-geo { font-size: .75rem; color: var(--text-muted); margin-top: 6px; }
        .lr-geo a { color: var(--cyan-tech); cursor: pointer; }
    </style>
</head>
<body data-theme="og">
<div class="lr-shell">
    <a href="/qg" class="lr-back">← Retour au QG</a>
    <div class="lr-title">
        <div class="lr-icon-box">🚚</div>
        <h1>Demander un livreur</h1>
    </div>
    <p class="sub">Envoie une demande — tous les livreurs SAMII en ligne la reçoivent instantanément, le premier disponible l'accepte.</p>

    <div class="lr-card">
        <form id="form-demande">
            <label>Adresse de récupération (ton point de retrait)</label>
            <input name="adresse_recuperation" value="${escapeHtml(workspace?.description || "")}" placeholder="Ex : 12 rue des Frères, Alger" required>
            <div class="lr-geo">
                Position utilisée pour trier par distance : ${workspace?.latitude ? "✅ définie" : "⚠️ non définie"} —
                <a id="btn-position">utiliser ma position actuelle</a>
            </div>

            <label>Adresse de livraison (client)</label>
            <input name="adresse_livraison" placeholder="Ex : 5 avenue de l'Indépendance, Alger" required>

            <label>Nom du client</label>
            <input name="client_nom" placeholder="Ex : Ahmed">

            <label>Téléphone du client</label>
            <input name="client_telephone" placeholder="Ex : 0555123456">

            <button type="submit" class="lr-btn">🚚 Envoyer la demande</button>
        </form>
        <div class="lr-msg" id="msg"></div>
    </div>

    <div class="lr-card">
        <div style="font-family:var(--font-mono);font-size:.7rem;text-transform:uppercase;color:var(--gold-og);margin-bottom:10px;">Mes demandes</div>
        <div id="liste-demandes">
            ${demandes.length ? demandes.map(d => `
                <div class="lr-item" data-id="${d.id}">
                    <div class="statut">${STATUT_LABEL[d.statut] || d.statut}</div>
                    <div class="addr">${escapeHtml(d.adresse_recuperation)} → ${escapeHtml(d.adresse_livraison)}</div>
                </div>
            `).join("") : '<div class="lr-empty">Aucune demande pour l\'instant.</div>'}
        </div>
    </div>
</div>

<script>
const socket = typeof io !== "undefined" ? io() : null;
socket?.emit("join", ${JSON.stringify(workspaceId)});

document.getElementById("btn-position")?.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
        await fetch("/livraisons/position-boutique", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        });
        document.querySelector(".lr-geo").innerHTML = "✅ Position enregistrée.";
    });
});

document.getElementById("form-demande").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("msg");
    const btn = e.target.querySelector("button");
    const data = Object.fromEntries(new FormData(e.target));
    btn.disabled = true;
    msg.textContent = "Envoi...";
    msg.className = "lr-msg";
    try {
        const res = await fetch("/livraisons/demander", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        const json = await res.json();
        if (json.success) {
            msg.textContent = "✅ Demande envoyée aux livreurs en ligne.";
            msg.className = "lr-msg ok";
            setTimeout(() => location.reload(), 1200);
        } else {
            msg.textContent = json.error || "Erreur.";
        }
    } catch {
        msg.textContent = "Erreur réseau.";
    } finally {
        btn.disabled = false;
    }
});

socket?.on("livraison.acceptee", () => location.reload());
socket?.on("livraison.recuperee", () => location.reload());
socket?.on("livraison.livree", () => location.reload());
</script>
</body>
</html>`);
});

// ── CRÉER UNE DEMANDE ────────────────────────────────────────
router.post("/demander", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session.workspaceId;
        if (!workspaceId) return res.json({ success: false, error: "Aucun workspace actif." });

        const { adresse_recuperation, adresse_livraison, client_nom, client_telephone, commande_id } = req.body;
        if (!adresse_recuperation || !adresse_livraison) {
            return res.json({ success: false, error: "Adresses manquantes." });
        }

        const workspace = await workspaceService.getById(workspaceId);
        const wsRows = await db.query(`SELECT latitude, longitude FROM workspaces WHERE id = $1`, [workspaceId]);
        const { latitude, longitude } = wsRows[0] || {};

        const inserted = await db.query(
            `INSERT INTO livraisons (workspace_id, commande_id, adresse_recuperation, adresse_livraison, lat_recuperation, lng_recuperation, client_nom, client_telephone)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [workspaceId, commande_id || null, adresse_recuperation.trim(), adresse_livraison.trim(), latitude || null, longitude || null, client_nom || "", client_telephone || ""]
        );

        socketService.emitToRoom("livreurs-online", "nouvelle-livraison", { id: inserted[0].id, workspaceId });

        res.json({ success: true, id: inserted[0].id });
    } catch (err) {
        console.error("❌ POST /livraisons/demander :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// ── POSITION DE LA BOUTIQUE (pour trier les livreurs par distance) ──
router.post("/position-boutique", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session.workspaceId;
        const { lat, lng } = req.body;
        if (!workspaceId || typeof lat !== "number" || typeof lng !== "number") return res.json({ success: false });
        await db.query(`UPDATE workspaces SET latitude = $1, longitude = $2 WHERE id = $3`, [lat, lng, workspaceId]);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /livraisons/position-boutique :", err.message);
        res.json({ success: false });
    }
});

module.exports = router;
