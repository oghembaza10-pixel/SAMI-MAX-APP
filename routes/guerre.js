// ==========================================================================
// SAMII OS — LA GUERRE APPROCHE — Page teaser V2 + compte à rebours
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

async function getJoursRestants() {
    try {
        const rows = await db.query(`SELECT valeur FROM configuration WHERE cle = 'guerre_date_lancement'`);
        if (!rows[0]) return null;
        const dateLancement = new Date(rows[0].valeur);
        const maintenant = new Date();
        const diffMs = dateLancement.getTime() - maintenant.getTime();
        const joursRestants = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return { jours: joursRestants, date: dateLancement };
    } catch (err) {
        console.error("❌ getJoursRestants :", err.message);
        return null;
    }
}

router.get("/", requireAuth, async (req, res) => {
    const info = await getJoursRestants();
    const jours = info ? Math.max(info.jours, 0) : 7;
    const dateStr = info ? info.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>La Guerre approche — SAMII OS</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --gold:#d7b34c; --blue:#00d9ff; --border:rgba(215,179,76,.25); --danger:#ff3366; }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:radial-gradient(circle at 50% 0%,rgba(215,179,76,.08),transparent 50%),var(--bg); color:var(--text); font-family:Inter,sans-serif; display:flex; align-items:center; justify-content:center; padding:24px; text-align:center; overflow-x:hidden; }
.shell { max-width:680px; }
.eyebrow { font-family:"JetBrains Mono"; font-size:11px; letter-spacing:.3em; text-transform:uppercase; color:var(--danger); margin-bottom:20px; display:flex; align-items:center; justify-content:center; gap:8px; }
.eyebrow .dot { width:6px; height:6px; border-radius:50%; background:var(--danger); box-shadow:0 0 10px var(--danger); animation:pulse 1.4s infinite; }
@keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.3;} }
h1 { font-family:'Cinzel',serif; font-size:clamp(28px,6vw,52px); font-weight:900; margin:0 0 16px; background:linear-gradient(135deg,var(--gold),#fff,var(--gold)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.subtitle { color:var(--muted); font-size:15px; max-width:480px; margin:0 auto 40px; line-height:1.7; }
.countdown { display:flex; gap:14px; justify-content:center; margin-bottom:40px; flex-wrap:wrap; }
.count-block { background:var(--panel); border:1px solid var(--border); border-radius:16px; padding:20px 24px; min-width:90px; }
.count-num { font-family:"JetBrains Mono"; font-weight:900; font-size:36px; color:var(--gold); text-shadow:0 0 20px rgba(215,179,76,.4); }
.count-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.1em; margin-top:6px; }
.count-block.days .count-num { color:var(--danger); text-shadow:0 0 20px rgba(255,51,102,.4); }
.reveal-list { display:grid; grid-template-columns:1fr; gap:12px; max-width:480px; margin:0 auto 30px; text-align:left; }
@media (min-width:640px) { .reveal-list { grid-template-columns:1fr 1fr; } }
.reveal-item { background:var(--panel); border:1px solid rgba(0,217,255,.15); border-radius:14px; padding:16px; display:flex; align-items:center; gap:12px; }
.reveal-item i { color:var(--blue); flex-shrink:0; }
.reveal-item span { font-size:12px; color:var(--text); font-weight:600; }
.date-line { font-family:"JetBrains Mono"; font-size:12px; color:var(--muted); margin-top:10px; }
.back-link { display:inline-block; margin-top:30px; color:var(--muted); text-decoration:none; font-size:13px; }
.back-link:hover { color:var(--gold); }
</style>
</head>
<body>
<div class="shell">
    <div class="eyebrow"><span class="dot"></span> SAMII OS · V2 · CLASSIFIÉ</div>
    <h1>La Guerre approche</h1>
    <p class="subtitle">Grades, gangs, territoires, coffre de guerre — l'écosystème SAMII entre dans une nouvelle ère. Prépare-toi.</p>

    <div class="countdown">
        <div class="count-block days"><div class="count-num">${jours}</div><div class="count-label">Jours</div></div>
    </div>

    <div class="reveal-list">
        <div class="reveal-item"><i data-lucide="swords"></i><span>Classement mensuel & gangs</span></div>
        <div class="reveal-item"><i data-lucide="map"></i><span>Territoires par catégorie</span></div>
        <div class="reveal-item"><i data-lucide="gift"></i><span>Récompenses réelles débloquées</span></div>
        <div class="reveal-item"><i data-lucide="users"></i><span>Parrainage & recrutement</span></div>
    </div>

    <div class="date-line">📅 Lancement prévu : ${dateStr}</div>
    <a href="/qg" class="back-link">← Retour au QG</a>
</div>
<script>if (typeof lucide !== "undefined") lucide.createIcons();</script>
</body>
</html>`);
});

module.exports = router;
