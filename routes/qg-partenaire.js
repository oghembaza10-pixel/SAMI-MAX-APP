// ==========================================================================
// SAMII OS — QG PARTENAIRE OG
// 3ème espace, distinct de /qg (marchand) et /client-qg (client) : réservé
// aux comptes agence (utilisateurs.est_agence = true). L'agence y retrouve
// son lien de parrainage / ses gains (déjà utilisés comme mécanisme de lien
// agence→client via parraine_par, cf. services/referralService.js) ET y
// gère ses propres clients : création directe, liste, signalement d'abandon.
// ==========================================================================
const express = require("express");
const router = express.Router();
const CONFIG = require("../config");
const referralService = require("../services/referralService");

function requireAgence(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    if (!req.session.estAgence) return res.redirect(req.session.typeCompte === "client" ? "/client-qg" : "/qg");
    next();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function devise(montant, code) {
    const n = parseFloat(montant) || 0;
    return `${n.toFixed(2)} ${escapeHtml(code || "USD")}`;
}

router.get("/", requireAgence, async (req, res) => {
    const userId = req.session.userId;
    let code = "";
    let resume = { filleuls: [], commissions: [], confirme: 0, enAttente: 0 };

    try {
        code = await referralService.assurerCodeParrainage(userId);
        resume = await referralService.resumeParrain(userId);
    } catch (err) {
        console.error("❌ GET /qg-partenaire :", err.message);
    }

    const lienParrainage = `${CONFIG.APP_URL}/register?ref=${code}`;
    const retourHref = req.session.typeCompte === "client" ? "/client-qg" : "/qg";

    const clientsHtml = resume.filleuls.length ? resume.filleuls.map(f => {
        const nomComplet = `${f.prenom || ""} ${f.nom || ""}`.trim() || f.email || "";
        const commissionsClient = resume.commissions.filter(c => c.filleul_id === f.id);
        const totalClient = commissionsClient.reduce((s, c) => s + (parseFloat(c.commission_montant) || 0), 0);
        const boutiqueLigne = f.boutique_nom
            ? `<span class="pp-client-boutique">🏪 ${escapeHtml(f.boutique_nom)}${f.boutique_metier ? ` · ${escapeHtml(f.boutique_metier)}` : ""}</span>`
            : `<span class="pp-client-boutique pp-client-boutique--vide">Pas encore de boutique créée</span>`;
        const abandonBtn = f.abandon_signale_par_agence
            ? `<button class="pp-abandon-btn" disabled>Abandon signalé</button>`
            : `<button class="pp-abandon-btn" data-id="${f.id}">Client abandonné</button>`;
        return `
        <div class="pp-client">
            <div class="pp-client-avatar">${escapeHtml((f.prenom || f.email || "?").charAt(0).toUpperCase())}</div>
            <div class="pp-client-info">
                <strong>${escapeHtml(nomComplet) || "Client"}</strong>
                ${boutiqueLigne}
                <span>${commissionsClient.length} paiement(s) généré(s) · +${totalClient.toFixed(2)}</span>
            </div>
            ${abandonBtn}
        </div>`;
    }).join("") : `<div class="pp-empty"><i data-lucide="users"></i><p>Aucun client pour l'instant. Crée ton premier client ci-dessous.</p></div>`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QG Partenaire — SAMII OS</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --gold:#d7b34c; --green:#3ddc84; --border:rgba(0,217,255,.16); --radius:18px; --cyan-glow:0 0 15px rgba(0,217,255,.45); }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,sans-serif; padding:0 0 70px; }
.pp-wrap { max-width:720px; margin:0 auto; padding:0 20px; }
.pp-top-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:20px 0 0; }
.back-link { display:inline-flex; align-items:center; gap:8px; color:var(--muted); text-decoration:none; font-size:13px; }
.back-link:hover { color:var(--blue); }
h1 { font-size:24px; margin:18px 0 4px; display:flex; align-items:center; gap:10px; }
.pp-sub { color:var(--muted); font-size:13.5px; margin-bottom:24px; }
.pp-card { background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin-bottom:18px; }
.pp-card label { display:block; font-family:"JetBrains Mono"; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin-bottom:8px; }
.pp-link-row { display:flex; gap:10px; }
.pp-link-row input { flex:1; padding:12px 13px; border-radius:10px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--blue); font-size:13px; font-family:"JetBrains Mono"; outline:none; }
.pp-btn { padding:0 18px; border-radius:10px; border:none; background:linear-gradient(135deg,var(--blue),var(--blue-2)); color:#001018; font-weight:800; cursor:pointer; box-shadow:var(--cyan-glow); white-space:nowrap; }
.pp-stats-bar { display:flex; gap:14px; margin:20px 0; }
.pp-stat { flex:1; background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:18px; text-align:center; }
.pp-stat strong { display:block; font-family:"JetBrains Mono"; font-size:22px; color:var(--green); }
.pp-stat strong.attente { color:var(--gold); }
.pp-stat span { font-size:10.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
.section-title { font-size:15px; font-weight:800; margin:28px 0 12px; display:flex; align-items:center; gap:8px; }
.section-title svg { width:16px; height:16px; color:var(--blue); }
.pp-form-row { display:flex; gap:10px; flex-wrap:wrap; }
.pp-form-row input { flex:1; min-width:130px; padding:11px; border-radius:9px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--text); font-size:13px; }
.pp-form-row input:focus { outline:none; border-color:var(--blue); }
.pp-form-full { width:100%; margin-top:10px; padding:11px; border-radius:9px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--text); font-size:13px; box-sizing:border-box; }
#creer-client-msg { margin-top:10px; text-align:center; font-size:.88rem; min-height:20px; color:var(--muted); }
.pp-client { display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:12px 14px; margin-bottom:10px; }
.pp-client-avatar { width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,var(--blue),var(--blue-2)); display:grid; place-items:center; font-weight:800; color:#001018; flex-shrink:0; }
.pp-client-info { flex:1; display:flex; flex-direction:column; }
.pp-client-info strong { font-size:13.5px; }
.pp-client-info span { font-size:11px; color:var(--muted); }
.pp-client-boutique { font-size:11.5px; color:var(--blue); }
.pp-client-boutique--vide { color:var(--muted); font-style:italic; }
.pp-abandon-btn { padding:7px 11px; border-radius:8px; border:1px solid rgba(215,179,76,.4); background:rgba(215,179,76,.1); color:var(--gold); font-size:10.5px; font-weight:700; cursor:pointer; white-space:nowrap; }
.pp-abandon-btn:disabled { opacity:.5; cursor:default; }
.pp-empty { text-align:center; padding:40px 20px; border:1px dashed var(--border); border-radius:16px; color:var(--muted); }
.pp-empty svg { width:30px; height:30px; color:var(--blue); margin-bottom:10px; }
</style>
</head>
<body>
<div class="pp-top-row">
    <a href="${retourHref}" class="back-link"><i data-lucide="arrow-left"></i> Retour</a>
</div>
<div class="pp-wrap">
    <h1>🏢 QG Partenaire OG</h1>
    <p class="pp-sub">Gère tes clients depuis un seul endroit. Tu gardes la relation, SAMII fournit la technologie.</p>

    <div class="pp-card">
        <label>Ton lien de parrainage</label>
        <div class="pp-link-row">
            <input id="lien-parrainage" readonly value="${escapeHtml(lienParrainage)}">
            <button class="pp-btn" id="btn-copier">Copier</button>
        </div>
    </div>

    <div class="pp-stats-bar">
        <div class="pp-stat"><strong>${resume.confirme.toFixed(2)}</strong><span>Gains confirmés</span></div>
        <div class="pp-stat"><strong class="attente">${resume.enAttente.toFixed(2)}</strong><span>En attente</span></div>
        <div class="pp-stat"><strong>${resume.filleuls.length}</strong><span>Clients</span></div>
    </div>

    <div class="section-title"><i data-lucide="user-plus"></i> Créer un client</div>
    <div class="pp-card">
        <form id="form-creer-client">
            <div class="pp-form-row">
                <input name="prenom" placeholder="Prénom" required>
                <input name="nom" placeholder="Nom" required>
            </div>
            <div class="pp-form-row" style="margin-top:10px;">
                <input name="email" type="email" placeholder="Email du client" required>
                <input name="telephone" placeholder="Téléphone">
            </div>
            <input name="metier" placeholder="Métier (optionnel)" class="pp-form-full">
            <button type="submit" class="pp-btn" style="width:100%;margin-top:14px;padding:12px;">Créer le client</button>
        </form>
        <div id="creer-client-msg"></div>
    </div>

    <div class="section-title"><i data-lucide="users"></i> Tes clients</div>
    <div id="liste-clients">${clientsHtml}</div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

document.getElementById("btn-copier").addEventListener("click", () => {
    const input = document.getElementById("lien-parrainage");
    input.select();
    navigator.clipboard?.writeText(input.value);
    const btn = document.getElementById("btn-copier");
    btn.textContent = "Copié !";
    setTimeout(() => { btn.textContent = "Copier"; }, 1500);
});

document.getElementById("form-creer-client").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("creer-client-msg");
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = "⏳ Création en cours...";
    msg.style.color = "var(--muted)";
    try {
        const res = await fetch("/agence/clients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.success) {
            msg.textContent = "✅ Client créé — un email d'invitation lui a été envoyé.";
            msg.style.color = "var(--green)";
            e.target.reset();
            setTimeout(() => window.location.reload(), 1500);
        } else {
            msg.textContent = "❌ " + (json.error || "Erreur.");
            msg.style.color = "#e55";
        }
    } catch {
        msg.textContent = "❌ Erreur réseau.";
        msg.style.color = "#e55";
    }
});

document.getElementById("liste-clients").addEventListener("click", async (e) => {
    const btn = e.target.closest(".pp-abandon-btn");
    if (!btn || btn.disabled) return;
    if (!confirm("Signaler ce client comme abandonné ? OG Technology fermera son espace après vérification.")) return;

    btn.disabled = true;
    try {
        const res = await fetch("/agence/clients/" + btn.dataset.id + "/abandon", { method: "POST" });
        const json = await res.json();
        if (json.success) {
            btn.textContent = "Abandon signalé";
        } else {
            alert(json.error || "Erreur.");
            btn.disabled = false;
        }
    } catch {
        alert("Erreur réseau.");
        btn.disabled = false;
    }
});

const socket = io();
socket.on("connect", () => socket.emit("join", "${userId}"));
socket.on("parrainage:gain", () => window.location.reload());
</script>
</body>
</html>`);
});

module.exports = router;
