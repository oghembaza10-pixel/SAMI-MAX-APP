// ==========================================================================
// SAMII OS — COMMUNITY — PostgreSQL Edition
// Feed premium synchronisé avec l'écosystème SAMII (thème bleu/cyan tech)
// ==========================================================================

const express = require("express");
const router = express.Router();
const db = require("../services/db");

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

function timeAgo(date) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "à l'instant";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `il y a ${days} j`;
    const weeks = Math.floor(days / 7);
    return `il y a ${weeks} sem`;
}

function initiales(prenom, nom) {
    const a = (prenom || "").charAt(0).toUpperCase();
    const b = (nom || "").charAt(0).toUpperCase();
    return (a + b) || "OG";
}

// ==========================================================================
// FEED — LISTE
// ==========================================================================

router.get("/", requireAuth, async (req, res) => {
    let publications = [];
    let classement = [];
    let stats = { membres: 0, publications: 0 };

    try {
        const rows = await db.query(`
            SELECT p.*, u.prenom, u.nom, u.grade_actuel, u.type_compte,
                (SELECT COUNT(*) FROM publications_likes pl WHERE pl.publication_id = p.id) AS nb_likes,
                (SELECT COUNT(*) FROM publications_commentaires pc WHERE pc.publication_id = p.id) AS nb_commentaires,
                EXISTS(SELECT 1 FROM publications_likes pl2 WHERE pl2.publication_id = p.id AND pl2.user_id = $1) AS jaime
            FROM publications p
            LEFT JOIN utilisateurs u ON u.id = p.auteur_id
            ORDER BY p.epingle DESC, p.created_at DESC
            LIMIT 40
        `, [req.session.userId || ""]);

        publications = rows;

        for (const pub of publications) {
            const comms = await db.query(`
                SELECT pc.*, u.prenom, u.nom FROM publications_commentaires pc
                LEFT JOIN utilisateurs u ON u.id = pc.auteur_id
                WHERE pc.publication_id = $1
                ORDER BY pc.created_at ASC LIMIT 2
            `, [pub.id]);
            pub.apercu_commentaires = comms;
        }
    } catch (err) {
        console.warn("⚠️ Community — lecture publications échouée :", err.message);
    }

    try {
        classement = await db.query(`
            SELECT id, prenom, nom, grade_actuel, score_grade, type_compte
            FROM utilisateurs
            ORDER BY score_grade DESC NULLS LAST
            LIMIT 5
        `);
    } catch (err) {
        console.warn("⚠️ Community — lecture classement échouée :", err.message);
    }

    try {
        const countRows = await db.query(`SELECT COUNT(*) AS total FROM utilisateurs`);
        stats.membres = parseInt(countRows[0]?.total || 0, 10);
        const pubRows = await db.query(`SELECT COUNT(*) AS total FROM publications`);
        stats.publications = parseInt(pubRows[0]?.total || 0, 10);
    } catch (err) {
        console.warn("⚠️ Community — lecture stats échouée :", err.message);
    }

    const feedHtml = publications.length ? publications.map(p => {
        const nomAuteur = escapeHtml(`${p.prenom || "Membre"} ${p.nom || "SAMII"}`);
        const grade = escapeHtml(p.grade_actuel || "Soldat");
        const isMarchand = p.type_compte === "marchand";

        const commentairesHtml = p.apercu_commentaires.map(c => `
            <div class="comment-item">
                <div class="comment-avatar">${initiales(c.prenom, c.nom)}</div>
                <div class="comment-body">
                    <strong>${escapeHtml(`${c.prenom || "Membre"} ${c.nom || ""}`)}</strong>
                    <span>${escapeHtml(c.contenu)}</span>
                </div>
            </div>`).join("");

        return `
        <article class="post-card" data-post-id="${p.id}">
            <div class="post-head">
                <div class="post-avatar">${initiales(p.prenom, p.nom)}</div>
                <div class="post-authorblock">
                    <div class="post-author">${nomAuteur} ${p.epingle ? '<i data-lucide="pin" class="pin-ic"></i>' : ""}</div>
                    <div class="post-meta">
                        <span class="grade-chip ${isMarchand ? "grade-chip--gold" : ""}">${isMarchand ? "🏪" : "👤"} ${grade}</span>
                        <span class="dot-sep">·</span>
                        <span>${timeAgo(p.created_at)}</span>
                    </div>
                </div>
            </div>
            ${p.contenu ? `<p class="post-text">${escapeHtml(p.contenu)}</p>` : ""}
            ${p.image_url ? `<div class="post-media"><img src="${escapeHtml(p.image_url)}" alt="" loading="lazy"></div>` : ""}
            <div class="post-stats">
                <span>${p.nb_likes > 0 ? `❤️ ${p.nb_likes}` : ""}</span>
                <span>${p.nb_commentaires > 0 ? `${p.nb_commentaires} commentaire${p.nb_commentaires > 1 ? "s" : ""}` : ""}</span>
            </div>
            <div class="post-actions">
                <button class="post-action-btn ${p.jaime ? "liked" : ""}" type="button" onclick="toggleLike(${p.id}, this)">
                    <i data-lucide="heart"></i> J'aime
                </button>
                <button class="post-action-btn" type="button" onclick="toggleCommentBox(${p.id})">
                    <i data-lucide="message-circle"></i> Commenter
                </button>
                <button class="post-action-btn" type="button" onclick="sharePost(${p.id})">
                    <i data-lucide="share-2"></i> Partager
                </button>
            </div>
            <div class="comments-preview">${commentairesHtml}</div>
            <div class="comment-box" id="comment-box-${p.id}" style="display:none;">
                <input type="text" id="comment-input-${p.id}" placeholder="Écris un commentaire...">
                <button type="button" onclick="postComment(${p.id})"><i data-lucide="send"></i></button>
            </div>
        </article>`;
    }).join("") : `<div class="empty-feed"><i data-lucide="message-square-dashed"></i><h3>Aucune publication pour l'instant</h3><p>Sois le premier à partager quelque chose avec la communauté SAMII.</p></div>`;

    const classementHtml = classement.length ? classement.map((u, i) => `
        <div class="rank-item">
            <span class="rank-num rank-${i + 1}">${i + 1}</span>
            <div class="rank-avatar">${initiales(u.prenom, u.nom)}</div>
            <div class="rank-info">
                <strong>${escapeHtml(`${u.prenom || "Membre"} ${u.nom || ""}`)}</strong>
                <span>${escapeHtml(u.grade_actuel || "Soldat")} · ${u.score_grade || 0} pts</span>
            </div>
        </div>`).join("") : `<p class="rank-empty">Le classement se remplira bientôt.</p>`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Community — SAMII OS</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --panel-2:rgba(12,25,39,.96); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --cyan-glow:0 0 15px rgba(0,217,255,.45),0 0 45px rgba(0,119,255,.18); --gold:#d7b34c; --border:rgba(0,217,255,.16); --danger:#ff5470; --radius:18px; --ease:cubic-bezier(.16,1,.3,1); }
body.light { --bg:#eef5fa; --panel:rgba(255,255,255,.88); --panel-2:rgba(255,255,255,.97); --text:#08121c; --muted:#607384; --border:rgba(0,119,255,.16); --cyan-glow:0 0 20px rgba(0,119,255,.18); }
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body { margin:0; min-height:100vh; background:radial-gradient(circle at 10% 10%,rgba(0,217,255,.09),transparent 30%),radial-gradient(circle at 90% 90%,rgba(0,119,255,.12),transparent 32%),var(--bg); color:var(--text); font-family:Inter,sans-serif; overflow-x:hidden; transition:background .4s ease,color .4s ease; }
button,input,textarea { font:inherit; }
button { cursor:pointer; }
a { color:inherit; text-decoration:none; }
.tech-bg { position:fixed; inset:0; z-index:-5; pointer-events:none; overflow:hidden; }
.tech-grid { position:absolute; inset:0; background-image:linear-gradient(rgba(0,217,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,217,255,.035) 1px,transparent 1px); background-size:42px 42px; mask-image:linear-gradient(to bottom,black,transparent 90%); }
.tech-orb { position:absolute; width:380px; height:380px; border-radius:50%; filter:blur(80px); opacity:.12; background:var(--blue); }
.tech-orb.one { top:-180px; left:-100px; }
.tech-orb.two { right:-150px; bottom:10%; background:var(--blue-2); }
.sidebar { position:fixed; left:0; top:0; width:245px; height:100vh; padding:22px 16px; background:linear-gradient(180deg,rgba(4,10,17,.97),rgba(3,7,12,.94)); border-right:1px solid var(--border); z-index:300; display:flex; flex-direction:column; }
body.light .sidebar { background:rgba(247,251,254,.95); }
.brand { display:flex; align-items:center; gap:10px; padding:8px 10px 25px; font-weight:800; }
.brand-mark { width:37px; height:37px; display:grid; place-items:center; border-radius:11px; color:white; background:linear-gradient(135deg,var(--blue),var(--blue-2)); box-shadow:var(--cyan-glow); font-weight:900; }
.brand-name { font-size:15px; }
.brand-name span { color:var(--blue); }
.side-menu { display:flex; flex-direction:column; gap:6px; }
.side-link { display:flex; align-items:center; gap:12px; padding:12px 13px; border-radius:12px; color:var(--muted); font-size:13px; font-weight:600; border:1px solid transparent; transition:.25s var(--ease); }
.side-link svg { width:18px; height:18px; }
.side-link:hover,.side-link.active { color:var(--text); background:linear-gradient(90deg,rgba(0,217,255,.12),rgba(0,119,255,.04)); border-color:rgba(0,217,255,.22); box-shadow:inset 3px 0 0 var(--blue),var(--cyan-glow); }
.side-link.active svg { color:var(--blue); filter:drop-shadow(0 0 7px var(--blue)); }
.side-bottom { margin-top:auto; padding:14px; border:1px solid var(--border); border-radius:16px; background:linear-gradient(135deg,rgba(0,217,255,.08),rgba(0,119,255,.03)); }
.side-ai { display:flex; align-items:center; gap:8px; font-size:11px; font-family:"JetBrains Mono"; color:var(--blue); margin-bottom:6px; }
.side-ai-dot { width:7px; height:7px; background:#00ff9d; border-radius:50%; box-shadow:0 0 10px #00ff9d; }
.side-text { color:var(--muted); font-size:11px; line-height:1.5; }
.main { margin-left:245px; min-height:100vh; width:calc(100% - 245px); }
.header { position:sticky; top:0; z-index:200; backdrop-filter:blur(24px); background:rgba(3,7,12,.82); border-bottom:1px solid var(--border); padding:16px 28px; display:flex; align-items:center; justify-content:space-between; gap:15px; }
body.light .header { background:rgba(244,249,253,.86); }
.header h1 { font-size:19px; margin:0; }
.header-actions { display:flex; align-items:center; gap:8px; }
.icon-btn { width:40px; height:40px; display:grid; place-items:center; border:1px solid var(--border); border-radius:11px; color:var(--muted); background:rgba(255,255,255,.025); transition:.25s var(--ease); }
.icon-btn:hover { color:var(--blue); border-color:var(--blue); box-shadow:var(--cyan-glow); transform:translateY(-2px); }
.layout { display:grid; grid-template-columns:1fr; gap:24px; max-width:1300px; margin:0 auto; padding:26px 28px 90px; }
@media (min-width:1100px) { .layout { grid-template-columns:260px 1fr 280px; align-items:start; } }
.col-side { display:none; }
@media (min-width:1100px) { .col-side { display:block; position:sticky; top:90px; } }
.side-panel { background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:18px; margin-bottom:16px; }
.side-panel h3 { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:0 0 14px; display:flex; align-items:center; gap:6px; }
.side-panel h3 svg { width:14px; height:14px; color:var(--blue); }
.stat-row { display:flex; justify-content:space-between; font-size:13px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.04); }
.stat-row:last-child { border:none; }
.stat-row strong { color:var(--blue); font-family:"JetBrains Mono"; }
.eco-link-item { display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; font-size:12px; font-weight:600; color:var(--muted); transition:.2s; margin-bottom:4px; }
.eco-link-item:hover { background:rgba(0,217,255,.06); color:var(--blue); }
.eco-link-item svg { width:15px; height:15px; }
.rank-item { display:flex; align-items:center; gap:10px; padding:9px 0; }
.rank-num { width:22px; height:22px; border-radius:6px; display:grid; place-items:center; font-size:10px; font-weight:800; background:rgba(255,255,255,.06); color:var(--muted); flex-shrink:0; }
.rank-1 { background:linear-gradient(135deg,#d7b34c,#f0d98c); color:#1a1400; }
.rank-2 { background:linear-gradient(135deg,#b8c2cc,#e2e8ee); color:#0a0e12; }
.rank-3 { background:linear-gradient(135deg,#c98a52,#e0ab7a); color:#1a0e00; }
.rank-avatar { width:28px; height:28px; border-radius:8px; display:grid; place-items:center; font-size:9px; font-weight:900; color:white; background:linear-gradient(135deg,var(--blue),var(--blue-2)); flex-shrink:0; }
.rank-info { display:flex; flex-direction:column; min-width:0; }
.rank-info strong { font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rank-info span { font-size:9px; color:var(--muted); }
.rank-empty { color:var(--muted); font-size:11px; text-align:center; padding:10px 0; }
.col-feed { max-width:640px; width:100%; margin:0 auto; }
.composer { background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:20px; }
.composer-top { display:flex; gap:12px; }
.composer-avatar { width:40px; height:40px; border-radius:11px; display:grid; place-items:center; font-size:12px; font-weight:900; color:white; background:linear-gradient(135deg,var(--blue),var(--blue-2)); flex-shrink:0; }
.composer textarea { flex:1; resize:none; min-height:44px; border:1px solid var(--border); border-radius:12px; background:rgba(0,0,0,.25); color:var(--text); padding:12px; outline:none; font-size:13px; transition:.2s; }
.composer textarea:focus { border-color:var(--blue); box-shadow:var(--cyan-glow); }
.composer-photo { margin-top:10px; }
.composer-photo input { width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--border); background:rgba(0,0,0,.2); color:var(--text); outline:none; font-size:12px; }
.composer-bottom { display:flex; justify-content:space-between; align-items:center; margin-top:12px; }
.composer-hint { font-size:11px; color:var(--muted); }
.composer-submit { padding:10px 20px; border:none; border-radius:11px; background:linear-gradient(135deg,var(--blue),#00a9ff); color:#001018; font-weight:800; font-size:12px; box-shadow:0 5px 20px rgba(0,217,255,.25); transition:.25s; }
.composer-submit:hover { transform:translateY(-2px); box-shadow:var(--cyan-glow); }
.composer-submit:disabled { opacity:.5; cursor:not-allowed; }
.post-card { background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:18px; margin-bottom:16px; transition:border-color .3s; }
.post-card:hover { border-color:rgba(0,217,255,.3); }
.post-head { display:flex; align-items:center; gap:11px; margin-bottom:12px; }
.post-avatar { width:42px; height:42px; border-radius:12px; display:grid; place-items:center; font-size:13px; font-weight:900; color:white; background:linear-gradient(135deg,var(--blue),var(--blue-2)); flex-shrink:0; }
.post-authorblock { flex:1; min-width:0; }
.post-author { font-size:13px; font-weight:700; display:flex; align-items:center; gap:6px; }
.pin-ic { width:12px; height:12px; color:var(--gold); }
.post-meta { display:flex; align-items:center; gap:6px; font-size:10px; color:var(--muted); margin-top:2px; }
.grade-chip { font-family:"JetBrains Mono"; padding:2px 8px; border-radius:20px; background:rgba(0,217,255,.08); border:1px solid rgba(0,217,255,.2); color:var(--blue); }
.grade-chip--gold { background:rgba(215,179,76,.1); border-color:rgba(215,179,76,.3); color:var(--gold); }
.dot-sep { opacity:.5; }
.post-text { font-size:13.5px; line-height:1.6; margin:0 0 12px; white-space:pre-wrap; }
.post-media { border-radius:14px; overflow:hidden; border:1px solid var(--border); margin-bottom:12px; }
.post-media img { width:100%; max-height:420px; object-fit:cover; display:block; }
.post-stats { display:flex; gap:14px; font-size:11px; color:var(--muted); padding-bottom:10px; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,.05); min-height:14px; }
.post-actions { display:flex; gap:6px; margin-bottom:6px; }
.post-action-btn { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:9px; border-radius:10px; border:1px solid transparent; background:transparent; color:var(--muted); font-size:11.5px; font-weight:700; transition:.2s; }
.post-action-btn svg { width:15px; height:15px; }
.post-action-btn:hover { background:rgba(0,217,255,.06); color:var(--blue); }
.post-action-btn.liked { color:var(--danger); }
.post-action-btn.liked svg { fill:var(--danger); }
.comments-preview { display:flex; flex-direction:column; gap:8px; }
.comment-item { display:flex; gap:8px; align-items:flex-start; }
.comment-avatar { width:26px; height:26px; border-radius:8px; display:grid; place-items:center; font-size:8px; font-weight:900; color:white; background:linear-gradient(135deg,var(--blue),var(--blue-2)); flex-shrink:0; }
.comment-body { background:rgba(255,255,255,.03); border-radius:12px; padding:7px 11px; font-size:11.5px; flex:1; }
.comment-body strong { display:block; font-size:10.5px; margin-bottom:2px; }
.comment-body span { color:var(--muted); }
.comment-box { display:flex; gap:8px; margin-top:10px; }
.comment-box input { flex:1; padding:10px 13px; border-radius:20px; border:1px solid var(--border); background:rgba(0,0,0,.25); color:var(--text); outline:none; font-size:12px; }
.comment-box input:focus { border-color:var(--blue); }
.comment-box button { width:38px; height:38px; border-radius:50%; border:none; background:linear-gradient(135deg,var(--blue),var(--blue-2)); color:#001018; display:grid; place-items:center; flex-shrink:0; }
.comment-box button svg { width:15px; height:15px; }
.empty-feed { text-align:center; padding:80px 20px; border:1px dashed var(--border); border-radius:20px; color:var(--muted); }
.empty-feed svg { width:44px; height:44px; color:var(--blue); margin-bottom:14px; }
.toast { position:fixed; bottom:26px; left:50%; transform:translateX(-50%) translateY(20px); background:#0c1a28; border:1px solid var(--blue); color:var(--text); padding:12px 22px; border-radius:12px; font-size:12px; z-index:900; opacity:0; transition:.3s; pointer-events:none; }
.toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
.mobile-nav { display:none; }
@media (max-width:900px) {
    .sidebar { display:none; }
    .main { margin-left:0; width:100%; }
    .header { padding:12px 14px; }
    .header h1 { font-size:16px; }
    .layout { padding:16px 12px 90px; }
    .mobile-nav { position:fixed; left:8px; right:8px; bottom:8px; height:62px; z-index:400; display:grid; grid-template-columns:repeat(4,1fr); padding:5px; border:1px solid rgba(0,217,255,.22); border-radius:17px; background:rgba(4,10,17,.92); backdrop-filter:blur(25px); box-shadow:0 15px 50px rgba(0,0,0,.45),var(--cyan-glow); }
    body.light .mobile-nav { background:rgba(250,253,255,.93); }
    .mobile-nav a { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; color:var(--muted); font-size:8px; font-weight:700; border-radius:12px; }
    .mobile-nav a svg { width:18px; height:18px; }
    .mobile-nav a.active { color:var(--blue); background:rgba(0,217,255,.08); }
}
</style>
</head>
<body>
<div class="tech-bg"><div class="tech-grid"></div><div class="tech-orb one"></div><div class="tech-orb two"></div></div>
<aside class="sidebar">
    <div>
        <div class="brand"><div class="brand-mark">OG</div><div class="brand-name">SAMII <span>TECHNOLOGY</span></div></div>
        <nav class="side-menu">
            <a href="/qg" class="side-link"><i data-lucide="layout-dashboard"></i> QG Central</a>
            <a href="/marketplace" class="side-link"><i data-lucide="store"></i> Marketplace</a>
            <a href="/community" class="side-link active"><i data-lucide="users"></i> Communauté</a>
            <a href="/arsenal" class="side-link"><i data-lucide="shield-check"></i> Arsenal</a>
            <a href="/academy" class="side-link"><i data-lucide="graduation-cap"></i> Academy</a>
        </nav>
    </div>
    <div class="side-bottom">
        <div class="side-ai"><span class="side-ai-dot"></span> SAMII ENGINE ACTIVE</div>
        <div class="side-text">Communauté synchronisée avec l'écosystème SAMII.</div>
    </div>
</aside>
<div class="main">
    <header class="header">
        <h1>Communauté SAMII</h1>
        <div class="header-actions">
            <button class="icon-btn" id="themeBtn" type="button" title="Changer le thème"><i data-lucide="moon"></i></button>
            <a class="icon-btn" href="/qg" title="Mon QG"><i data-lucide="layout-dashboard"></i></a>
        </div>
    </header>
    <div class="layout">
        <div class="col-side">
            <div class="side-panel">
                <h3><i data-lucide="activity"></i> Tendances</h3>
                <div class="stat-row"><span>Membres SAMII</span><strong>${stats.membres}</strong></div>
                <div class="stat-row"><span>Publications</span><strong>${stats.publications}</strong></div>
                <div class="stat-row"><span>Statut système</span><strong style="color:#00ff9d;">● Actif</strong></div>
            </div>
            <div class="side-panel">
                <h3><i data-lucide="compass"></i> Écosystème</h3>
                <a href="/qg" class="eco-link-item"><i data-lucide="layout-dashboard"></i> QG · Piloter votre activité</a>
                <a href="/marketplace" class="eco-link-item"><i data-lucide="store"></i> Marketplace · Acheter & vendre</a>
                <a href="/arsenal" class="eco-link-item"><i data-lucide="shield-check"></i> Arsenal · Débloquer vos pouvoirs</a>
                <a href="/academy" class="eco-link-item"><i data-lucide="graduation-cap"></i> Academy · Apprendre & progresser</a>
            </div>
        </div>

        <div class="col-feed">
            <div class="composer">
                <div class="composer-top">
                    <div class="composer-avatar">${initiales(req.session.nom?.split(" ")[1], req.session.nom?.split(" ")[0])}</div>
                    <textarea id="composerText" placeholder="Que veux-tu partager avec la communauté ?" rows="2"></textarea>
                </div>
                <div class="composer-photo">
                    <input type="url" id="composerImage" placeholder="Lien d'une image (optionnel)">
                </div>
                <div class="composer-bottom">
                    <span class="composer-hint">Visible par toute la communauté SAMII</span>
                    <button class="composer-submit" id="composerSubmit" type="button">Publier</button>
                </div>
            </div>

            <div id="feedContainer">${feedHtml}</div>
        </div>

        <div class="col-side">
            <div class="side-panel">
                <h3><i data-lucide="trophy"></i> Classement SAMII</h3>
                ${classementHtml}
            </div>
        </div>
    </div>
</div>
<div class="toast" id="toast"></div>
<nav class="mobile-nav">
    <a href="/qg"><i data-lucide="layout-dashboard"></i> QG</a>
    <a href="/marketplace"><i data-lucide="store"></i> Marché</a>
    <a href="/community" class="active"><i data-lucide="users"></i> Communauté</a>
    <a href="/arsenal"><i data-lucide="shield-check"></i> Arsenal</a>
</nav>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

const savedTheme = localStorage.getItem("samii_community_theme");
if (savedTheme === "light") document.body.classList.add("light");
function updateThemeIcon() {
    const btn = document.getElementById("themeBtn");
    if (!btn) return;
    btn.innerHTML = document.body.classList.contains("light") ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
    if (typeof lucide !== "undefined") lucide.createIcons();
}
updateThemeIcon();
document.getElementById("themeBtn")?.addEventListener("click", () => {
    document.body.classList.toggle("light");
    localStorage.setItem("samii_community_theme", document.body.classList.contains("light") ? "light" : "dark");
    updateThemeIcon();
});

function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
}

document.getElementById("composerSubmit").addEventListener("click", async function () {
    const contenu = document.getElementById("composerText").value.trim();
    const image_url = document.getElementById("composerImage").value.trim();
    if (!contenu && !image_url) { showToast("Écris quelque chose ou ajoute une image."); return; }

    this.disabled = true;
    try {
        const res = await fetch("/community/publier", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contenu, image_url }),
        });
        const json = await res.json();
        if (json.success) {
            window.location.reload();
        } else {
            showToast(json.error || "Erreur.");
            this.disabled = false;
        }
    } catch (err) {
        showToast("Erreur réseau.");
        this.disabled = false;
    }
});

async function toggleLike(id, btn) {
    try {
        const res = await fetch("/community/like/" + id, { method: "POST" });
        const json = await res.json();
        if (json.success) {
            btn.classList.toggle("liked", json.liked);
        }
    } catch (err) { showToast("Erreur réseau."); }
}

function toggleCommentBox(id) {
    const box = document.getElementById("comment-box-" + id);
    box.style.display = box.style.display === "none" ? "flex" : "none";
    if (box.style.display === "flex") document.getElementById("comment-input-" + id).focus();
}

async function postComment(id) {
    const input = document.getElementById("comment-input-" + id);
    const contenu = input.value.trim();
    if (!contenu) return;
    try {
        const res = await fetch("/community/commenter/" + id, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contenu }),
        });
        const json = await res.json();
        if (json.success) {
            window.location.reload();
        } else {
            showToast(json.error || "Erreur.");
        }
    } catch (err) { showToast("Erreur réseau."); }
}

function sharePost(id) {
    const url = window.location.origin + "/community#post-" + id;
    if (navigator.share) {
        navigator.share({ url }).catch(() => {});
    } else {
        navigator.clipboard.writeText(url);
        showToast("🔗 Lien copié !");
    }
}
</script>
</body>
</html>`);
});

// ==========================================================================
// PUBLIER
// ==========================================================================

router.post("/publier", requireAuth, async (req, res) => {
    try {
        const { contenu, image_url } = req.body;
        if (!contenu && !image_url) {
            return res.json({ success: false, error: "Ajoute du texte ou une image." });
        }

        await db.query(
            `INSERT INTO publications (auteur_id, contenu, image_url, type) VALUES ($1, $2, $3, $4)`,
            [req.session.userId, contenu || "", image_url || null, image_url ? "image" : "texte"]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /community/publier :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// ==========================================================================
// LIKE — TOGGLE
// ==========================================================================

router.post("/like/:id", requireAuth, async (req, res) => {
    try {
        const publicationId = parseInt(req.params.id, 10);
        const userId = req.session.userId;
        if (!publicationId || !userId) return res.json({ success: false, error: "Requête invalide." });

        const existing = await db.query(
            `SELECT id FROM publications_likes WHERE publication_id = $1 AND user_id = $2`,
            [publicationId, userId]
        );

        if (existing.length > 0) {
            await db.query(`DELETE FROM publications_likes WHERE id = $1`, [existing[0].id]);
            return res.json({ success: true, liked: false });
        }

        await db.query(
            `INSERT INTO publications_likes (publication_id, user_id) VALUES ($1, $2)`,
            [publicationId, userId]
        );
        res.json({ success: true, liked: true });
    } catch (err) {
        console.error("❌ POST /community/like/:id :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// ==========================================================================
// COMMENTER
// ==========================================================================

router.post("/commenter/:id", requireAuth, async (req, res) => {
    try {
        const publicationId = parseInt(req.params.id, 10);
        const { contenu } = req.body;

        if (!publicationId || !contenu || !contenu.trim()) {
            return res.json({ success: false, error: "Commentaire vide." });
        }

        await db.query(
            `INSERT INTO publications_commentaires (publication_id, auteur_id, contenu) VALUES ($1, $2, $3)`,
            [publicationId, req.session.userId, contenu.trim()]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /community/commenter/:id :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
