// ==========================================================================
// SAMII OS — LIVREUR — Espace livreur (type Uber Eats / Stuart)
// ==========================================================================
// N'importe quel compte SAMII peut devenir livreur (auto-inscription).
// Une fois en ligne, il reçoit en temps réel les demandes de livraison
// proches (voir routes/livraisons.js côté marchand) et peut accepter la
// première disponible — attribution atomique pour éviter que deux livreurs
// prennent la même course.
const express = require("express");
const router  = express.Router();
const db = require("../services/db");
const socketService = require("../services/socketService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// Distance à vol d'oiseau (km) — suffisant pour trier "le plus proche
// d'abord", pas besoin d'un vrai calcul d'itinéraire routier pour ça.
function distanceKm(lat1, lng1, lat2, lng2) {
    if ([lat1, lng1, lat2, lng2].some(v => v === null || v === undefined)) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getLivreur(userId) {
    const rows = await db.query(`SELECT * FROM livreurs WHERE id = $1`, [userId]);
    return rows[0] || null;
}

// ── PAGE PRINCIPALE ────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
    const livreur = await getLivreur(req.session.userId);

    const enCours = livreur ? await db.query(
        `SELECT * FROM livraisons WHERE livreur_id = $1 AND statut IN ('assignee', 'recuperee') ORDER BY assignee_le DESC LIMIT 1`,
        [req.session.userId]
    ) : [];

    const historique = livreur ? await db.query(
        `SELECT * FROM livraisons WHERE livreur_id = $1 AND statut = 'livree' ORDER BY livree_le DESC LIMIT 10`,
        [req.session.userId]
    ) : [];

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Espace Livreur — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <script src="/socket.io/socket.io.js"></script>
    <style>
        .lv-shell { max-width: 620px; margin: 0 auto; padding: 40px 24px 100px; }
        .lv-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .lv-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .lv-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(95,212,255,0.2), rgba(197,160,89,0.08));
            border: 1px solid rgba(95,212,255,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
        }
        .lv-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .lv-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 24px; line-height: 1.6; }

        .lv-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 22px; margin-bottom: 16px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 12px 0 6px; }
        input, select {
            width: 100%; padding: 11px 13px; border-radius: 9px; box-sizing: border-box;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem; font-family: var(--font-body);
        }
        button.lv-btn {
            padding: 12px 18px; border-radius: 10px; border: none; font-weight: 700; cursor: pointer; font-size: .88rem;
            background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); color: #000;
        }
        button.lv-btn:disabled { opacity: .5; cursor: not-allowed; }

        .lv-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .lv-toggle { position: relative; width: 56px; height: 30px; flex-shrink: 0; }
        .lv-toggle input { display: none; }
        .lv-toggle-track { position: absolute; inset: 0; background: rgba(255,255,255,0.15); border-radius: 20px; cursor: pointer; transition: .25s; }
        .lv-toggle-track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: #fff; transition: .25s; }
        .lv-toggle input:checked + .lv-toggle-track { background: #3ddc84; }
        .lv-toggle input:checked + .lv-toggle-track::after { transform: translateX(26px); }
        .lv-statut-label { font-weight: 700; font-size: .95rem; }
        .lv-statut-label.off { color: var(--text-muted); }
        .lv-statut-label.on { color: #3ddc84; }

        .lv-demande { border: 1px solid rgba(197,160,89,0.3); border-radius: 14px; padding: 16px; margin-bottom: 10px; }
        .lv-demande .dist { font-family: var(--font-mono); color: var(--gold-og); font-size: .78rem; margin-bottom: 6px; }
        .lv-demande .addr { color: var(--text-main); font-size: .87rem; margin: 4px 0; }
        .lv-demande .addr b { color: var(--text-muted); font-family: var(--font-mono); font-size: .68rem; text-transform: uppercase; margin-right: 6px; }
        .lv-empty { color: var(--text-muted); font-size: .85rem; text-align: center; padding: 24px 0; }

        .lv-course { border: 1px solid rgba(61,220,132,0.35); background: rgba(61,220,132,0.06); border-radius: 14px; padding: 18px; }
        .lv-hist-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: .82rem; color: var(--text-muted); }
        .lv-msg { text-align: center; margin-top: 10px; font-size: .82rem; color: #e55; min-height: 18px; }
    </style>
</head>
<body data-theme="og">
<div class="lv-shell">
    <a href="/hub" class="lv-back">← Retour</a>
    <div class="lv-title">
        <div class="lv-icon-box">🛵</div>
        <h1>Espace Livreur</h1>
    </div>
    <p class="sub">Passe en ligne pour recevoir des demandes de livraison des marchands SAMII, en temps réel.</p>

    ${!livreur ? `
    <div class="lv-card">
        <h3 style="color:#fff;margin-bottom:4px;">Devenir livreur</h3>
        <p style="color:var(--text-muted);font-size:.82rem;">Renseigne tes infos, c'est immédiat — pas de validation à attendre.</p>
        <form id="form-inscription">
            <label>Véhicule</label>
            <select name="vehicule">
                <option value="moto">🛵 Moto</option>
                <option value="voiture">🚗 Voiture</option>
                <option value="velo">🚲 Vélo</option>
                <option value="pied">🚶 À pied</option>
            </select>
            <label>Ville</label>
            <input name="ville" placeholder="Ex : Alger" required>
            <button type="submit" class="lv-btn" style="margin-top:16px;width:100%;">Devenir livreur</button>
        </form>
        <div class="lv-msg" id="msg-inscription"></div>
    </div>
    ` : `
    <div class="lv-card">
        <div class="lv-toggle-row">
            <span class="lv-statut-label ${livreur.en_ligne ? "on" : "off"}" id="statut-label">${livreur.en_ligne ? "🟢 En ligne" : "⚪ Hors ligne"}</span>
            <label class="lv-toggle">
                <input type="checkbox" id="toggle-en-ligne" ${livreur.en_ligne ? "checked" : ""}>
                <span class="lv-toggle-track"></span>
            </label>
        </div>
    </div>

    ${enCours[0] ? `
    <div class="lv-card lv-course">
        <div style="font-family:var(--font-mono);font-size:.7rem;text-transform:uppercase;color:#3ddc84;margin-bottom:10px;">Course en cours</div>
        <div class="addr"><b>Récupération</b>${escapeHtml(enCours[0].adresse_recuperation)}</div>
        <div class="addr"><b>Livraison</b>${escapeHtml(enCours[0].adresse_livraison)}</div>
        <div class="addr"><b>Client</b>${escapeHtml(enCours[0].client_nom)} — ${escapeHtml(enCours[0].client_telephone)}</div>
        <div style="margin-top:14px;display:flex;gap:10px;">
            ${enCours[0].statut === "assignee" ? `<button class="lv-btn" id="btn-recuperee" data-id="${enCours[0].id}">📦 Colis récupéré</button>` : ""}
            ${enCours[0].statut === "recuperee" ? `<button class="lv-btn" id="btn-livree" data-id="${enCours[0].id}">✅ Livré</button>` : ""}
        </div>
    </div>
    ` : `
    <div class="lv-card">
        <div style="font-family:var(--font-mono);font-size:.7rem;text-transform:uppercase;color:var(--gold-og);margin-bottom:10px;">Demandes disponibles</div>
        <div id="liste-demandes"><div class="lv-empty">Passe en ligne pour voir les demandes.</div></div>
    </div>
    `}

    <div class="lv-card">
        <div style="font-family:var(--font-mono);font-size:.7rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px;">Historique récent</div>
        ${historique.length ? historique.map(h => `
            <div class="lv-hist-item"><span>${escapeHtml(h.adresse_livraison)}</span><span>${h.livree_le ? new Date(h.livree_le).toLocaleDateString("fr-FR") : ""}</span></div>
        `).join("") : `<div class="lv-empty">Aucune livraison terminée pour l'instant.</div>`}
    </div>
    `}
</div>

<script>
const socket = typeof io !== "undefined" ? io() : null;
const estLivreur = ${livreur ? "true" : "false"};
const enLigne = ${livreur?.en_ligne ? "true" : "false"};
let maPosition = null;

function escapeHtmlClient(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

document.getElementById("form-inscription")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("msg-inscription");
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = "Inscription...";
    const res = await fetch("/livreur/inscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (json.success) location.reload();
    else msg.textContent = json.error || "Erreur.";
});

function envoyerPosition() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
        maPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        await fetch("/livreur/position", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(maPosition),
        });
    }, () => {}, { enableHighAccuracy: true });
}

async function chargerDemandes() {
    const liste = document.getElementById("liste-demandes");
    if (!liste) return;
    const res = await fetch("/livreur/demandes");
    const json = await res.json();
    if (!json.success || !json.demandes.length) {
        liste.innerHTML = '<div class="lv-empty">Aucune demande disponible pour l\\'instant.</div>';
        return;
    }
    liste.innerHTML = json.demandes.map(d => \`
        <div class="lv-demande">
            \${d.distance_km !== null ? '<div class="dist">📍 ~' + d.distance_km.toFixed(1) + ' km</div>' : ''}
            <div class="addr"><b>Récupération</b>\${escapeHtmlClient(d.adresse_recuperation)}</div>
            <div class="addr"><b>Livraison</b>\${escapeHtmlClient(d.adresse_livraison)}</div>
            <button class="lv-btn" style="margin-top:10px;width:100%;" onclick="accepterDemande(\${d.id}, this)">Accepter cette course</button>
        </div>
    \`).join("");
}

async function accepterDemande(id, btn) {
    btn.disabled = true;
    btn.textContent = "Attribution...";
    const res = await fetch("/livreur/demandes/" + id + "/accepter", { method: "POST" });
    const json = await res.json();
    if (json.success) {
        location.reload();
    } else {
        btn.textContent = json.error || "Déjà prise, réessaie.";
        setTimeout(chargerDemandes, 1000);
    }
}

document.getElementById("btn-recuperee")?.addEventListener("click", async (e) => {
    const id = e.target.dataset.id;
    await fetch("/livreur/demandes/" + id + "/recuperee", { method: "POST" });
    location.reload();
});
document.getElementById("btn-livree")?.addEventListener("click", async (e) => {
    const id = e.target.dataset.id;
    await fetch("/livreur/demandes/" + id + "/livree", { method: "POST" });
    location.reload();
});

document.getElementById("toggle-en-ligne")?.addEventListener("change", async (e) => {
    const nouveauStatut = e.target.checked;
    const label = document.getElementById("statut-label");
    await fetch("/livreur/statut", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ en_ligne: nouveauStatut }),
    });
    label.textContent = nouveauStatut ? "🟢 En ligne" : "⚪ Hors ligne";
    label.className = "lv-statut-label " + (nouveauStatut ? "on" : "off");
    if (nouveauStatut) {
        socket?.emit("join", "livreurs-online");
        envoyerPosition();
        chargerDemandes();
    } else {
        location.reload();
    }
});

if (estLivreur && enLigne) {
    socket?.emit("join", "livreurs-online");
    envoyerPosition();
    chargerDemandes();
    setInterval(envoyerPosition, 60000);
}

socket?.on("nouvelle-livraison", () => {
    if (enLigne) chargerDemandes();
});
</script>
</body>
</html>`);
});

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

// ── INSCRIPTION LIVREUR ─────────────────────────────────────
router.post("/inscription", requireAuth, async (req, res) => {
    try {
        const { vehicule, ville } = req.body;
        await db.query(
            `INSERT INTO livreurs (id, vehicule, ville) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
            [req.session.userId, vehicule || "moto", (ville || "").trim()]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /livreur/inscription :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// ── TOGGLE EN LIGNE / HORS LIGNE ────────────────────────────
router.post("/statut", requireAuth, async (req, res) => {
    try {
        const enLigne = !!req.body.en_ligne;
        await db.query(`UPDATE livreurs SET en_ligne = $1 WHERE id = $2`, [enLigne, req.session.userId]);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /livreur/statut :", err.message);
        res.json({ success: false });
    }
});

// ── POSITION GPS (ping périodique depuis le navigateur) ─────
router.post("/position", requireAuth, async (req, res) => {
    try {
        const { lat, lng } = req.body;
        if (typeof lat !== "number" || typeof lng !== "number") return res.json({ success: false });
        await db.query(
            `UPDATE livreurs SET latitude = $1, longitude = $2, position_maj_le = now() WHERE id = $3`,
            [lat, lng, req.session.userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /livreur/position :", err.message);
        res.json({ success: false });
    }
});

// ── DEMANDES DISPONIBLES (triées par distance si possible) ──
router.get("/demandes", requireAuth, async (req, res) => {
    try {
        const livreur = await getLivreur(req.session.userId);
        if (!livreur) return res.json({ success: false, error: "Pas un livreur." });

        const demandes = await db.query(
            `SELECT id, adresse_recuperation, adresse_livraison, lat_recuperation, lng_recuperation, created_at
             FROM livraisons WHERE statut = 'en_attente' ORDER BY created_at ASC LIMIT 30`
        );

        const avecDistance = demandes.map(d => ({
            id: d.id,
            adresse_recuperation: d.adresse_recuperation,
            adresse_livraison: d.adresse_livraison,
            distance_km: distanceKm(livreur.latitude, livreur.longitude, d.lat_recuperation, d.lng_recuperation),
        }));

        avecDistance.sort((a, b) => {
            if (a.distance_km === null && b.distance_km === null) return 0;
            if (a.distance_km === null) return 1;
            if (b.distance_km === null) return -1;
            return a.distance_km - b.distance_km;
        });

        res.json({ success: true, demandes: avecDistance });
    } catch (err) {
        console.error("❌ GET /livreur/demandes :", err.message);
        res.json({ success: false, demandes: [] });
    }
});

// ── ACCEPTER (atomique — le premier arrivé gagne) ───────────
router.post("/demandes/:id/accepter", requireAuth, async (req, res) => {
    try {
        const livreur = await getLivreur(req.session.userId);
        if (!livreur) return res.json({ success: false, error: "Pas un livreur." });
        if (!livreur.en_ligne) return res.json({ success: false, error: "Passe en ligne d'abord." });

        const dejaEnCours = await db.query(
            `SELECT id FROM livraisons WHERE livreur_id = $1 AND statut IN ('assignee', 'recuperee')`,
            [req.session.userId]
        );
        if (dejaEnCours.length) return res.json({ success: false, error: "Tu as déjà une course en cours." });

        const rows = await db.query(
            `UPDATE livraisons SET livreur_id = $1, statut = 'assignee', assignee_le = now()
             WHERE id = $2 AND statut = 'en_attente'
             RETURNING id, workspace_id`,
            [req.session.userId, req.params.id]
        );

        if (!rows.length) return res.json({ success: false, error: "Cette course vient d'être prise par quelqu'un d'autre." });

        socketService.emitToShop(rows[0].workspace_id, "livraison.acceptee", { id: rows[0].id, livreurId: req.session.userId });
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /livreur/demandes/:id/accepter :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// ── RÉCUPÉRÉ ─────────────────────────────────────────────────
router.post("/demandes/:id/recuperee", requireAuth, async (req, res) => {
    try {
        const rows = await db.query(
            `UPDATE livraisons SET statut = 'recuperee', recuperee_le = now()
             WHERE id = $1 AND livreur_id = $2 RETURNING id, workspace_id`,
            [req.params.id, req.session.userId]
        );
        if (rows.length) socketService.emitToShop(rows[0].workspace_id, "livraison.recuperee", { id: rows[0].id });
        res.json({ success: !!rows.length });
    } catch (err) {
        console.error("❌ POST /livreur/demandes/:id/recuperee :", err.message);
        res.json({ success: false });
    }
});

// ── LIVRÉ ────────────────────────────────────────────────────
router.post("/demandes/:id/livree", requireAuth, async (req, res) => {
    try {
        const rows = await db.query(
            `UPDATE livraisons SET statut = 'livree', livree_le = now()
             WHERE id = $1 AND livreur_id = $2 RETURNING id, workspace_id`,
            [req.params.id, req.session.userId]
        );
        if (rows.length) {
            await db.query(`UPDATE livreurs SET nb_livraisons = nb_livraisons + 1 WHERE id = $1`, [req.session.userId]);
            socketService.emitToShop(rows[0].workspace_id, "livraison.livree", { id: rows[0].id });
        }
        res.json({ success: !!rows.length });
    } catch (err) {
        console.error("❌ POST /livreur/demandes/:id/livree :", err.message);
        res.json({ success: false });
    }
});

module.exports = router;
