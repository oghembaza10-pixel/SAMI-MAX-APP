// ==========================================================================
// SAMII OS — PARRAINAGE — Lien perso, filleuls, gains en temps réel
// Parrain : 20% récurrent sur les paiements du filleul (12 mois).
// Filleul : 5% de réduction sur son propre abonnement (12 mois).
// ==========================================================================
const express = require("express");
const router = express.Router();
const CONFIG = require("../config");
const referralService = require("../services/referralService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
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

router.get("/resume", requireAuth, async (req, res) => {
    try {
        const resume = await referralService.resumeParrain(req.session.userId);
        res.json({
            success: true,
            nbFilleuls: resume.filleuls.length,
            confirme: resume.confirme,
            enAttente: resume.enAttente,
        });
    } catch (err) {
        console.error("❌ GET /parrainage/resume :", err.message);
        res.json({ success: false });
    }
});

router.get("/", requireAuth, async (req, res) => {
    const userId = req.session.userId;
    let code = "";
    let resume = { filleuls: [], commissions: [], confirme: 0, enAttente: 0 };

    try {
        code = await referralService.assurerCodeParrainage(userId);
        resume = await referralService.resumeParrain(userId);
    } catch (err) {
        console.error("❌ GET /parrainage :", err.message);
    }

    const lienParrainage = `${CONFIG.APP_URL}/register?ref=${code}`;
    const retourHref = req.session.typeCompte === "client" ? "/client-qg" : "/qg";

    const filleulsHtml = resume.filleuls.length ? resume.filleuls.map(f => {
        const nomComplet = `${f.prenom || ""} ${f.nom || ""}`.trim() || f.email || "Filleul";
        const commissionsFilleul = resume.commissions.filter(c => c.filleul_id === f.id);
        const totalFilleul = commissionsFilleul.reduce((s, c) => s + (parseFloat(c.commission_montant) || 0), 0);
        return `
        <div class="pr-filleul">
            <div class="pr-filleul-avatar">${escapeHtml((f.prenom || f.email || "?").charAt(0).toUpperCase())}</div>
            <div class="pr-filleul-info">
                <strong>${escapeHtml(nomComplet)}</strong>
                <span>${commissionsFilleul.length} paiement${commissionsFilleul.length > 1 ? "s" : ""} généré${commissionsFilleul.length > 1 ? "s" : ""}</span>
            </div>
            <div class="pr-filleul-gain">+${totalFilleul.toFixed(2)}</div>
        </div>`;
    }).join("") : `<div class="pr-empty"><i data-lucide="users"></i><p>Aucun filleul pour l'instant. Partage ton lien !</p></div>`;

    const gainsHtml = resume.commissions.length ? resume.commissions.slice(0, 30).map(c => `
        <div class="pr-gain-row" data-id="${c.id}">
            <span class="pr-gain-plan">${escapeHtml(c.plan || "abonnement")} · mois ${c.mois_numero}/12</span>
            <span class="pr-gain-statut pr-gain-statut--${c.statut === "confirmee" ? "ok" : "attente"}">${c.statut === "confirmee" ? "Confirmé" : "En attente"}</span>
            <span class="pr-gain-montant">+${devise(c.commission_montant, c.devise)}</span>
        </div>`).join("") : `<div class="pr-empty"><i data-lucide="sparkles"></i><p>Tes gains apparaîtront ici dès qu'un filleul paiera son abonnement.</p></div>`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Parrainage — SAMII OS</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --gold:#d7b34c; --green:#3ddc84; --border:rgba(0,217,255,.16); --radius:18px; --cyan-glow:0 0 15px rgba(0,217,255,.45); }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,sans-serif; padding:0 0 70px; }
.pr-wrap { max-width:720px; margin:0 auto; padding:0 20px; }
.back-link { display:inline-flex; align-items:center; gap:8px; color:var(--muted); text-decoration:none; font-size:13px; padding:20px 0 0; }
.back-link:hover { color:var(--blue); }
h1 { font-size:24px; margin:18px 0 4px; display:flex; align-items:center; gap:10px; }
.pr-sub { color:var(--muted); font-size:13.5px; margin-bottom:24px; }
.pr-link-card { background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin-bottom:18px; }
.pr-link-card label { display:block; font-family:"JetBrains Mono"; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin-bottom:8px; }
.pr-link-row { display:flex; gap:10px; }
.pr-link-row input { flex:1; padding:12px 13px; border-radius:10px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--blue); font-size:13px; font-family:"JetBrains Mono"; outline:none; }
.pr-copy-btn { padding:0 18px; border-radius:10px; border:none; background:linear-gradient(135deg,var(--blue),var(--blue-2)); color:#001018; font-weight:800; cursor:pointer; box-shadow:var(--cyan-glow); white-space:nowrap; }
.pr-terms { display:flex; gap:14px; margin-top:14px; flex-wrap:wrap; }
.pr-term { flex:1; min-width:140px; background:rgba(0,217,255,.06); border:1px solid var(--border); border-radius:12px; padding:12px 14px; }
.pr-term strong { display:block; color:var(--blue); font-size:16px; font-family:"JetBrains Mono"; }
.pr-term span { font-size:11px; color:var(--muted); }
.pr-stats-bar { display:flex; gap:14px; margin:20px 0; }
.pr-stat { flex:1; background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:18px; text-align:center; }
.pr-stat strong { display:block; font-family:"JetBrains Mono"; font-size:22px; color:var(--green); }
.pr-stat strong.attente { color:var(--gold); }
.pr-stat span { font-size:10.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
.section-title { font-size:15px; font-weight:800; margin:28px 0 12px; display:flex; align-items:center; gap:8px; }
.section-title svg { width:16px; height:16px; color:var(--blue); }
.pr-filleul { display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:12px 14px; margin-bottom:10px; }
.pr-filleul-avatar { width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,var(--blue),var(--blue-2)); display:grid; place-items:center; font-weight:800; color:#001018; flex-shrink:0; }
.pr-filleul-info { flex:1; display:flex; flex-direction:column; }
.pr-filleul-info strong { font-size:13.5px; }
.pr-filleul-info span { font-size:11px; color:var(--muted); }
.pr-filleul-gain { font-family:"JetBrains Mono"; color:var(--green); font-weight:700; }
.pr-gain-row { display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:11px 14px; margin-bottom:8px; font-size:12.5px; }
.pr-gain-plan { flex:1; color:var(--muted); }
.pr-gain-statut { font-size:10px; font-family:"JetBrains Mono"; padding:3px 9px; border-radius:20px; }
.pr-gain-statut--ok { color:var(--green); background:rgba(61,220,132,.1); }
.pr-gain-statut--attente { color:var(--gold); background:rgba(215,179,76,.1); }
.pr-gain-montant { font-family:"JetBrains Mono"; color:var(--green); font-weight:700; }
.pr-empty { text-align:center; padding:40px 20px; border:1px dashed var(--border); border-radius:16px; color:var(--muted); }
.pr-empty svg { width:30px; height:30px; color:var(--blue); margin-bottom:10px; }
.pr-flash { position:fixed; bottom:20px; right:20px; background:var(--green); color:#001018; padding:12px 18px; border-radius:12px; font-weight:800; font-size:13px; box-shadow:0 4px 20px rgba(61,220,132,.4); transform:translateY(120%); transition:.3s; }
.pr-flash.show { transform:translateY(0); }
</style>
</head>
<body>
<a href="${retourHref}" class="back-link"><i data-lucide="arrow-left"></i> Retour</a>
<div class="pr-wrap">
    <h1>🤝 Parrainage</h1>
    <p class="pr-sub">Invite tes proches. Toi et eux gagnez, pendant 12 mois.</p>

    <div class="pr-link-card">
        <label>Ton lien de parrainage</label>
        <div class="pr-link-row">
            <input id="lien-parrainage" readonly value="${escapeHtml(lienParrainage)}">
            <button class="pr-copy-btn" id="btn-copier">Copier</button>
        </div>
        <div class="pr-terms">
            <div class="pr-term"><strong>20%</strong><span>Toi, sur chaque paiement de ton filleul — 12 mois</span></div>
            <div class="pr-term"><strong>5%</strong><span>Ton filleul, sur son propre abonnement — 12 mois</span></div>
        </div>
    </div>

    <div class="pr-stats-bar">
        <div class="pr-stat"><strong id="stat-confirme">${resume.confirme.toFixed(2)}</strong><span>Gains confirmés</span></div>
        <div class="pr-stat"><strong class="attente" id="stat-attente">${resume.enAttente.toFixed(2)}</strong><span>En attente</span></div>
        <div class="pr-stat"><strong id="stat-filleuls">${resume.filleuls.length}</strong><span>Filleuls</span></div>
    </div>

    <div class="section-title"><i data-lucide="users"></i> Tes filleuls</div>
    <div id="liste-filleuls">${filleulsHtml}</div>

    <div class="section-title"><i data-lucide="wallet"></i> Historique des gains</div>
    <div id="liste-gains">${gainsHtml}</div>
</div>

<div class="pr-flash" id="flash">💰 Nouveau gain reçu !</div>

<script src="/socket.io/socket.io.js"></script>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

document.getElementById("btn-copier").addEventListener("click", () => {
    const input = document.getElementById("lien-parrainage");
    input.select();
    navigator.clipboard?.writeText(input.value);
    const btn = document.getElementById("btn-copier");
    btn.textContent = "Copié !";
    setTimeout(() => btn.textContent = "Copier", 1500);
});

const socket = io();
socket.on("connect", () => socket.emit("join", "${userId}"));
socket.on("parrainage:gain", (gain) => {
    const flash = document.getElementById("flash");
    flash.classList.add("show");
    setTimeout(() => flash.classList.remove("show"), 2500);

    if (gain.statut === "confirmee") {
        const el = document.getElementById("stat-confirme");
        el.textContent = (parseFloat(el.textContent) + parseFloat(gain.commission_montant)).toFixed(2);
    } else {
        const el = document.getElementById("stat-attente");
        el.textContent = (parseFloat(el.textContent) + parseFloat(gain.commission_montant)).toFixed(2);
    }

    const liste = document.getElementById("liste-gains");
    const vide = liste.querySelector(".pr-empty");
    if (vide) vide.remove();
    const row = document.createElement("div");
    row.className = "pr-gain-row";
    row.innerHTML = \`
        <span class="pr-gain-plan">\${gain.plan || "abonnement"} · mois \${gain.mois_numero}/12</span>
        <span class="pr-gain-statut pr-gain-statut--\${gain.statut === "confirmee" ? "ok" : "attente"}">\${gain.statut === "confirmee" ? "Confirmé" : "En attente"}</span>
        <span class="pr-gain-montant">+\${parseFloat(gain.commission_montant).toFixed(2)} \${gain.devise}</span>\`;
    liste.prepend(row);
});
</script>
</body>
</html>`);
});

module.exports = router;
