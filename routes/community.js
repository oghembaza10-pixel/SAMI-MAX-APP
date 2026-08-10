// ==========================================================================
// SAMII OS — COMMUNITY — v3 avec choix de diffusion multi-module
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");
const gradeService = require("../services/gradeService");
const { mobileNav } = require("../views/partials/mobileNav");

function requireAuth(req, res, next) { if (!req.session?.loggedIn) return res.redirect("/login"); next(); }
function escapeHtml(v) { return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function timeAgo(date) {
    const s = Math.floor((Date.now()-new Date(date).getTime())/1000);
    if (s<60) return "à l'instant";
    const m=Math.floor(s/60); if(m<60) return `il y a ${m} min`;
    const h=Math.floor(m/60); if(h<24) return `il y a ${h} h`;
    const d=Math.floor(h/24); if(d<7) return `il y a ${d} j`;
    return `il y a ${Math.floor(d/7)} sem`;
}
function initiales(p,n){const a=(p||"").charAt(0).toUpperCase();const b=(n||"").charAt(0).toUpperCase();return (a+b)||"OG";}

const CATEGORIES = {
    photo:       { label:"Photo",       icon:"camera",         couleur:"#00d9ff", modules:["community"] },
    video:       { label:"Vidéo",       icon:"video",          couleur:"#ff5ea6", modules:["community"] },
    produit:     { label:"Produit",     icon:"shopping-bag",   couleur:"#d7b34c", modules:["community","marketplace"] },
    service:     { label:"Service",     icon:"concierge-bell", couleur:"#3ddc84", modules:["community","marketplace"] },
    formation:   { label:"Formation",   icon:"graduation-cap", couleur:"#9d5cff", modules:["community","academy"] },
    publication: { label:"Publication", icon:"message-square", couleur:"#7f96a8", modules:["community"] },
};
function catInfo(c){ return CATEGORIES[c] || CATEGORIES.publication; }

const MODULES_INFO = {
    community:   { label:"Communauté",  icon:"users" },
    marketplace: { label:"Marketplace", icon:"store" },
    academy:     { label:"Academy",     icon:"graduation-cap" },
};

router.get("/", requireAuth, async (req, res) => {
    let publications = [], classement = [], stats = { membres:0, publications:0 }, tendances = [];

    try {
        const rows = await db.query(`
            SELECT p.*, u.prenom, u.nom, u.grade_actuel, u.type_compte,
                (SELECT COUNT(*) FROM publications_likes pl WHERE pl.publication_id=p.id) AS nb_likes,
                (SELECT COUNT(*) FROM publications_commentaires pc WHERE pc.publication_id=p.id) AS nb_commentaires,
                EXISTS(SELECT 1 FROM publications_likes pl2 WHERE pl2.publication_id=p.id AND pl2.user_id=$1) AS jaime
            FROM publications p LEFT JOIN utilisateurs u ON u.id=p.auteur_id
            ORDER BY p.epingle DESC, p.created_at DESC LIMIT 40
        `, [req.session.userId || ""]);
        publications = rows;
        for (const pub of publications) {
            const comms = await db.query(`SELECT pc.*, u.prenom, u.nom FROM publications_commentaires pc LEFT JOIN utilisateurs u ON u.id=pc.auteur_id WHERE pc.publication_id=$1 ORDER BY pc.created_at ASC LIMIT 2`, [pub.id]);
            pub.apercu_commentaires = comms;
        }
    } catch (err) { console.warn("⚠️ publications :", err.message); }

    try {
        classement = await db.query(`SELECT id, prenom, nom, grade_actuel, score_grade, type_compte FROM utilisateurs ORDER BY score_grade DESC NULLS LAST LIMIT 5`);
    } catch (err) { console.warn("⚠️ classement :", err.message); }

    let stories = [];
    try {
        stories = await db.query(`
            SELECT DISTINCT ON (s.auteur_id) s.auteur_id, u.prenom, u.nom, s.created_at,
                EXISTS(SELECT 1 FROM stories_vues sv WHERE sv.story_id=s.id AND sv.user_id=$1) AS vue
            FROM stories s LEFT JOIN utilisateurs u ON u.id=s.auteur_id
            WHERE s.actif = true AND s.expires_at > now()
            ORDER BY s.auteur_id, s.created_at DESC
        `, [req.session.userId || ""]);
    } catch (err) { console.warn("⚠️ stories :", err.message); }

    try {
        const cRows = await db.query(`SELECT COUNT(*) AS total FROM utilisateurs`); stats.membres = parseInt(cRows[0]?.total||0,10);
        const pRows = await db.query(`SELECT COUNT(*) AS total FROM publications`); stats.publications = parseInt(pRows[0]?.total||0,10);
        tendances = await db.query(`SELECT categorie, COUNT(*) AS total FROM publications GROUP BY categorie ORDER BY total DESC LIMIT 3`);
    } catch (err) { console.warn("⚠️ stats :", err.message); }

    const catButtonsHtml = Object.entries(CATEGORIES).map(([key,c]) => `
        <button type="button" class="cat-btn" data-cat="${key}" style="--cat-color:${c.couleur};"><i data-lucide="${c.icon}"></i> ${c.label}</button>`).join("");

    const storiesBarHtml = stories.map(s => {
        const nomS = `${s.prenom||"Membre"} ${s.nom||""}`.trim();
        return `<a class="story-circle" href="/stories/${encodeURIComponent(s.auteur_id)}">
            <div class="story-ring ${s.vue ? "story-ring--vue" : ""}">${initiales(s.prenom,s.nom)}</div>
            <span>${escapeHtml((s.prenom||"Membre").slice(0,10))}</span>
        </a>`;
    }).join("");

    const tendancesHtml = tendances.length ? tendances.map(t => { const info=catInfo(t.categorie);
        return `<div class="stat-row"><span><i data-lucide="${info.icon}" style="width:13px;height:13px;color:${info.couleur};"></i> ${info.label}</span><strong>${t.total}</strong></div>`; }).join("") : "";

    const feedHtml = publications.length ? publications.map(p => {
        const nomAuteur = escapeHtml(`${p.prenom||"Membre"} ${p.nom||"SAMII"}`);
        const grade = escapeHtml(p.grade_actuel||"Soldat");
        const isMarchand = p.type_compte === "marchand";
        const cat = catInfo(p.categorie);
        const commentairesHtml = p.apercu_commentaires.map(c => `
            <div class="comment-item"><div class="comment-avatar">${initiales(c.prenom,c.nom)}</div>
            <div class="comment-body"><strong>${escapeHtml(`${c.prenom||"Membre"} ${c.nom||""}`)}</strong><span>${escapeHtml(c.contenu)}</span></div></div>`).join("");
        let mediaHtml = "";
        if (p.video_url) mediaHtml = `<div class="post-media"><video src="${escapeHtml(p.video_url)}" controls preload="metadata"></video></div>`;
        else if (p.image_url) mediaHtml = `<div class="post-media"><img src="${escapeHtml(p.image_url)}" alt="" loading="lazy"></div>`;

        return `
        <article class="post-card" data-post-id="${p.id}">
            <div class="post-head">
                <a class="post-avatar" href="/vitrine/${encodeURIComponent(p.auteur_id||"")}">${initiales(p.prenom,p.nom)}</a>
                <div class="post-authorblock">
                    <div class="post-author"><a href="/vitrine/${encodeURIComponent(p.auteur_id||"")}">${nomAuteur}</a> ${p.epingle?'<i data-lucide="pin" class="pin-ic"></i>':""}</div>
                    <div class="post-meta"><span class="grade-chip ${isMarchand?"grade-chip--gold":""}">${isMarchand?"🏪":"👤"} ${grade}</span><span class="dot-sep">·</span><span>${timeAgo(p.created_at)}</span></div>
                </div>
                <span class="cat-badge" style="--cat-color:${cat.couleur};"><i data-lucide="${cat.icon}"></i> ${cat.label}</span>
            </div>
            ${p.contenu?`<p class="post-text">${escapeHtml(p.contenu)}</p>`:""}
            ${mediaHtml}
            <div class="post-stats"><span>${p.nb_likes>0?`❤️ ${p.nb_likes}`:""}</span><span>${p.nb_commentaires>0?`${p.nb_commentaires} commentaire${p.nb_commentaires>1?"s":""}`:""}</span></div>
            <div class="post-actions">
                <button class="post-action-btn ${p.jaime?"liked":""}" type="button" onclick="toggleLike(${p.id}, this)"><i data-lucide="heart"></i> J'aime</button>
                <button class="post-action-btn" type="button" onclick="toggleCommentBox(${p.id})"><i data-lucide="message-circle"></i> Commenter</button>
                <button class="post-action-btn" type="button" onclick="sharePost(${p.id})"><i data-lucide="share-2"></i> Partager</button>
            </div>
            <div class="comments-preview">${commentairesHtml}</div>
            <div class="comment-box" id="comment-box-${p.id}" style="display:none;">
                <input type="text" id="comment-input-${p.id}" placeholder="Écris un commentaire...">
                <button type="button" onclick="postComment(${p.id})"><i data-lucide="send"></i></button>
            </div>
        </article>`;
    }).join("") : `<div class="empty-feed"><i data-lucide="message-square-dashed"></i><h3>Aucune publication pour l'instant</h3><p>Sois le premier à partager avec la communauté SAMII.</p></div>`;

    const classementHtml = classement.length ? classement.map((u,i) => `
        <a class="rank-item" href="/vitrine/${encodeURIComponent(u.id)}"><span class="rank-num rank-${i+1}">${i+1}</span><div class="rank-avatar">${initiales(u.prenom,u.nom)}</div>
        <div class="rank-info"><strong>${escapeHtml(`${u.prenom||"Membre"} ${u.nom||""}`)}</strong><span>${escapeHtml(u.grade_actuel||"Soldat")} · ${u.score_grade||0} pts</span></div></a>`).join("") : `<p class="rank-empty">Le classement se remplira bientôt.</p>`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Community — SAMII OS</title>
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#070809">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root{--bg:#03060b;--panel:rgba(9,18,29,.88);--text:#f5fbff;--muted:#7f96a8;--blue:#00d9ff;--blue-2:#0077ff;--cyan-glow:0 0 15px rgba(0,217,255,.45);--gold:#d7b34c;--border:rgba(0,217,255,.16);--danger:#ff5470;--radius:18px;--ease:cubic-bezier(.16,1,.3,1);}
body.light{--bg:#eef5fa;--panel:rgba(255,255,255,.88);--text:#08121c;--muted:#607384;--border:rgba(0,119,255,.16);}
*{box-sizing:border-box;} body{margin:0;min-height:100vh;background:radial-gradient(circle at 10% 10%,rgba(0,217,255,.09),transparent 30%),radial-gradient(circle at 90% 90%,rgba(0,119,255,.12),transparent 32%),var(--bg);color:var(--text);font-family:Inter,sans-serif;overflow-x:hidden;}
button,input,textarea{font:inherit;cursor:pointer;} a{color:inherit;text-decoration:none;}
.sidebar{position:fixed;left:0;top:0;width:245px;height:100vh;padding:22px 16px;background:linear-gradient(180deg,rgba(4,10,17,.97),rgba(3,7,12,.94));border-right:1px solid var(--border);z-index:300;display:flex;flex-direction:column;}
body.light .sidebar{background:rgba(247,251,254,.95);}
.brand{display:flex;align-items:center;gap:10px;padding:8px 10px 25px;font-weight:800;}
.brand-mark{width:37px;height:37px;display:grid;place-items:center;border-radius:11px;color:white;background:linear-gradient(135deg,var(--blue),var(--blue-2));font-weight:900;}
.brand-name span{color:var(--blue);}
.side-link{display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:12px;color:var(--muted);font-size:13px;font-weight:600;border:1px solid transparent;margin-bottom:6px;}
.side-link svg{width:18px;height:18px;}
.side-link:hover,.side-link.active{color:var(--text);background:linear-gradient(90deg,rgba(0,217,255,.12),rgba(0,119,255,.04));border-color:rgba(0,217,255,.22);}
.side-link.active svg{color:var(--blue);}
.side-bottom{margin-top:auto;padding:14px;border:1px solid var(--border);border-radius:16px;background:linear-gradient(135deg,rgba(0,217,255,.08),rgba(0,119,255,.03));}
.side-ai{display:flex;align-items:center;gap:8px;font-size:11px;font-family:"JetBrains Mono";color:var(--blue);margin-bottom:6px;}
.side-ai-dot{width:7px;height:7px;background:#00ff9d;border-radius:50%;}
.side-text{color:var(--muted);font-size:11px;line-height:1.5;}
.main{margin-left:245px;min-height:100vh;width:calc(100% - 245px);}
.header{position:sticky;top:0;z-index:200;backdrop-filter:blur(24px);background:rgba(3,7,12,.82);border-bottom:1px solid var(--border);padding:16px 28px;display:flex;align-items:center;justify-content:space-between;gap:15px;}
.header h1{font-size:19px;margin:0;}
.header-actions{display:flex;align-items:center;gap:8px;}
.icon-btn{width:40px;height:40px;display:grid;place-items:center;border:1px solid var(--border);border-radius:11px;color:var(--muted);}
.icon-btn:hover{color:var(--blue);border-color:var(--blue);}
.layout{display:grid;grid-template-columns:1fr;gap:24px;max-width:1300px;margin:0 auto;padding:26px 28px 90px;}
@media (min-width:1100px){.layout{grid-template-columns:260px 1fr 280px;align-items:start;}}
.col-side{display:none;} @media (min-width:1100px){.col-side{display:block;position:sticky;top:90px;}}
.side-panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:16px;}
.side-panel h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 14px;display:flex;align-items:center;gap:6px;}
.side-panel h3 svg{width:14px;height:14px;color:var(--blue);}
.stat-row{display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);}
.stories-bar{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 16px;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
.stories-bar::-webkit-scrollbar{display:none;}
.story-circle{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:5px;text-decoration:none;width:62px;}
.story-ring{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-size:14px;font-weight:900;color:#fff;background:var(--panel);border:2.5px solid var(--blue);box-shadow:0 0 0 2px var(--bg);}
.story-ring--vue{border-color:rgba(127,150,168,.35);}
.story-ring--add{background:rgba(0,217,255,.08);border-style:dashed;color:var(--blue);}
.story-circle span{font-size:10.5px;color:var(--muted);max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.stat-row span{display:flex;align-items:center;gap:6px;}
.stat-row:last-child{border:none;} .stat-row strong{color:var(--blue);font-family:"JetBrains Mono";}
.eco-link-item{display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;}
.eco-link-item:hover{background:rgba(0,217,255,.06);color:var(--blue);}
.eco-link-item svg{width:15px;height:15px;}
.rank-item{display:flex;align-items:center;gap:10px;padding:9px 0;}
.rank-num{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;font-size:10px;font-weight:800;background:rgba(255,255,255,.06);color:var(--muted);flex-shrink:0;}
.rank-1{background:linear-gradient(135deg,#d7b34c,#f0d98c);color:#1a1400;}
.rank-2{background:linear-gradient(135deg,#b8c2cc,#e2e8ee);color:#0a0e12;}
.rank-3{background:linear-gradient(135deg,#c98a52,#e0ab7a);color:#1a0e00;}
.rank-avatar{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:9px;font-weight:900;color:white;background:linear-gradient(135deg,var(--blue),var(--blue-2));flex-shrink:0;}
.rank-info{display:flex;flex-direction:column;min-width:0;} .rank-info strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;} .rank-info span{font-size:9px;color:var(--muted);}
.rank-empty{color:var(--muted);font-size:11px;text-align:center;padding:10px 0;}
.col-feed{max-width:640px;width:100%;margin:0 auto;}
.composer{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:20px;}
.composer-top{display:flex;gap:12px;}
.composer-avatar{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;font-size:12px;font-weight:900;color:white;background:linear-gradient(135deg,var(--blue),var(--blue-2));flex-shrink:0;}
.composer textarea{flex:1;resize:none;min-height:44px;border:1px solid var(--border);border-radius:12px;background:rgba(0,0,0,.25);color:var(--text);padding:12px;outline:none;font-size:13px;}
.composer textarea:focus{border-color:var(--blue);}
.cat-buttons{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;}
.cat-btn{display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;font-weight:700;}
.cat-btn svg{width:13px;height:13px;} .cat-btn:hover{border-color:var(--cat-color);color:var(--cat-color);}
.cat-btn.selected{background:var(--cat-color);border-color:var(--cat-color);color:#001018;}
.diffusion-box{margin-top:14px;padding:12px;border-radius:12px;background:rgba(0,217,255,.04);border:1px solid var(--border);display:none;}
.diffusion-box.show{display:block;}
.diffusion-title{font-size:11px;color:var(--blue);font-weight:700;display:flex;align-items:center;gap:6px;margin-bottom:10px;}
.diffusion-title svg{width:13px;height:13px;}
.diffusion-options{display:flex;gap:8px;flex-wrap:wrap;}
.diffusion-chip{display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:20px;border:1px solid var(--border);background:rgba(0,0,0,.2);color:var(--muted);font-size:11px;font-weight:600;}
.diffusion-chip svg{width:12px;height:12px;}
.diffusion-chip input{display:none;}
.diffusion-chip:has(input:checked){background:rgba(0,217,255,.15);border-color:var(--blue);color:var(--blue);}
.diffusion-hint{font-size:10px;color:var(--muted);margin-top:8px;}
.upload-preview{margin-top:10px;display:none;position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--border);}
.upload-preview img,.upload-preview video{width:100%;max-height:280px;object-fit:cover;display:block;}
.upload-remove{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.7);color:white;border:none;display:grid;place-items:center;}
.upload-status{font-size:11px;color:var(--blue);margin-top:8px;display:none;}
.composer-bottom{display:flex;justify-content:space-between;align-items:center;margin-top:12px;}
.composer-hint{font-size:11px;color:var(--muted);}
.composer-submit{padding:10px 20px;border:none;border-radius:11px;background:linear-gradient(135deg,var(--blue),#00a9ff);color:#001018;font-weight:800;font-size:12px;}
.composer-submit:disabled{opacity:.5;cursor:not-allowed;}
.post-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:16px;}
.post-card:hover{border-color:rgba(0,217,255,.3);}
.post-head{display:flex;align-items:center;gap:11px;margin-bottom:12px;}
.post-avatar{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:13px;font-weight:900;color:white;background:linear-gradient(135deg,var(--blue),var(--blue-2));flex-shrink:0;text-decoration:none;}
.post-authorblock{flex:1;min-width:0;}
.post-author{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;}
.post-author a,.rank-item{color:inherit;text-decoration:none;}
.post-author a:hover{color:var(--blue);}
.pin-ic{width:12px;height:12px;color:var(--gold);}
.post-meta{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted);margin-top:2px;}
.grade-chip{font-family:"JetBrains Mono";padding:2px 8px;border-radius:20px;background:rgba(0,217,255,.08);border:1px solid rgba(0,217,255,.2);color:var(--blue);}
.grade-chip--gold{background:rgba(215,179,76,.1);border-color:rgba(215,179,76,.3);color:var(--gold);}
.dot-sep{opacity:.5;}
.cat-badge{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:5px 10px;border-radius:20px;background:color-mix(in srgb, var(--cat-color) 15%, transparent);border:1px solid var(--cat-color);color:var(--cat-color);flex-shrink:0;}
.cat-badge svg{width:11px;height:11px;}
.post-text{font-size:13.5px;line-height:1.6;margin:0 0 12px;white-space:pre-wrap;}
.post-media{border-radius:14px;overflow:hidden;border:1px solid var(--border);margin-bottom:12px;}
.post-media img,.post-media video{width:100%;max-height:420px;object-fit:cover;display:block;background:#000;}
.post-stats{display:flex;gap:14px;font-size:11px;color:var(--muted);padding-bottom:10px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,.05);min-height:14px;}
.post-actions{display:flex;gap:6px;margin-bottom:6px;}
.post-action-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--muted);font-size:11.5px;font-weight:700;}
.post-action-btn svg{width:15px;height:15px;}
.post-action-btn:hover{background:rgba(0,217,255,.06);color:var(--blue);}
.post-action-btn.liked{color:var(--danger);} .post-action-btn.liked svg{fill:var(--danger);}
.comments-preview{display:flex;flex-direction:column;gap:8px;}
.comment-item{display:flex;gap:8px;align-items:flex-start;}
.comment-avatar{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:8px;font-weight:900;color:white;background:linear-gradient(135deg,var(--blue),var(--blue-2));flex-shrink:0;}
.comment-body{background:rgba(255,255,255,.03);border-radius:12px;padding:7px 11px;font-size:11.5px;flex:1;}
.comment-body strong{display:block;font-size:10.5px;margin-bottom:2px;} .comment-body span{color:var(--muted);}
.comment-box{display:flex;gap:8px;margin-top:10px;}
.comment-box input{flex:1;padding:10px 13px;border-radius:20px;border:1px solid var(--border);background:rgba(0,0,0,.25);color:var(--text);outline:none;font-size:12px;}
.comment-box button{width:38px;height:38px;border-radius:50%;border:none;background:linear-gradient(135deg,var(--blue),var(--blue-2));color:#001018;display:grid;place-items:center;flex-shrink:0;}
.comment-box button svg{width:15px;height:15px;}
.empty-feed{text-align:center;padding:80px 20px;border:1px dashed var(--border);border-radius:20px;color:var(--muted);}
.empty-feed svg{width:44px;height:44px;color:var(--blue);margin-bottom:14px;}
.toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:#0c1a28;border:1px solid var(--blue);color:var(--text);padding:12px 22px;border-radius:12px;font-size:12px;z-index:900;opacity:0;transition:.3s;pointer-events:none;}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
.mobile-nav{display:none;}
@media (max-width:900px){
.sidebar{display:none;} .main{margin-left:0;width:100%;} .header{padding:12px 14px;} .header h1{font-size:16px;} .layout{padding:16px 12px 90px;}
.mobile-nav{position:fixed;left:8px;right:8px;bottom:8px;height:62px;z-index:400;display:grid;grid-template-columns:repeat(5,1fr);padding:5px;border:1px solid rgba(0,217,255,.22);border-radius:17px;background:rgba(4,10,17,.92);backdrop-filter:blur(25px);}
.mobile-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--muted);font-size:8px;font-weight:700;border-radius:12px;}
.mobile-nav a svg{width:18px;height:18px;} .mobile-nav a.active{color:var(--blue);background:rgba(0,217,255,.08);}
}
</style>
</head>
<body>
<aside class="sidebar">
<div><div class="brand"><div class="brand-mark">OG</div><div class="brand-name">SAMII <span>TECHNOLOGY</span></div></div>
<nav>
<a href="/qg" class="side-link"><i data-lucide="layout-dashboard"></i> QG Central</a>
<a href="/marketplace" class="side-link"><i data-lucide="store"></i> Marketplace</a>
<a href="/community" class="side-link active"><i data-lucide="users"></i> Communauté</a>
<a href="/discussions" class="side-link"><i data-lucide="message-circle"></i> Discussions</a>
<a href="/arsenal" class="side-link"><i data-lucide="shield-check"></i> Arsenal</a>
<a href="/academy" class="side-link"><i data-lucide="graduation-cap"></i> Academy</a>
</nav></div>
<div class="side-bottom"><div class="side-ai"><span class="side-ai-dot"></span> SAMII ENGINE ACTIVE</div><div class="side-text">Communauté synchronisée avec l'écosystème SAMII.</div></div>
</aside>
<div class="main">
<header class="header"><h1>Communauté SAMII</h1>
<div class="header-actions"><button class="icon-btn" id="themeBtn" type="button"><i data-lucide="moon"></i></button><a class="icon-btn" href="/qg"><i data-lucide="layout-dashboard"></i></a></div>
</header>
<div class="layout">
<div class="col-side">
<div class="side-panel"><h3><i data-lucide="activity"></i> Tendances</h3>
<div class="stat-row"><span>Membres SAMII</span><strong>${stats.membres}</strong></div>
<div class="stat-row"><span>Publications</span><strong>${stats.publications}</strong></div>
${tendancesHtml}
<div class="stat-row"><span>Statut système</span><strong style="color:#00ff9d;">● Actif</strong></div>
</div>
<div class="side-panel"><h3><i data-lucide="compass"></i> Écosystème</h3>
<a href="/qg" class="eco-link-item"><i data-lucide="layout-dashboard"></i> QG · Piloter votre activité</a>
<a href="/marketplace" class="eco-link-item"><i data-lucide="store"></i> Marketplace · Acheter & vendre</a>
<a href="/arsenal" class="eco-link-item"><i data-lucide="shield-check"></i> Arsenal · Débloquer vos pouvoirs</a>
<a href="/academy" class="eco-link-item"><i data-lucide="graduation-cap"></i> Academy · Apprendre & progresser</a>
</div></div>

<div class="col-feed">
<div class="stories-bar">
<a class="story-circle story-circle--add" href="/stories/publier"><div class="story-ring story-ring--add"><i data-lucide="plus"></i></div><span>Ta story</span></a>
${storiesBarHtml}
</div>
<div class="composer">
<div class="composer-top">
<div class="composer-avatar">${initiales(req.session.nom?.split(" ")[1], req.session.nom?.split(" ")[0])}</div>
<textarea id="composerText" placeholder="Exprime-toi... partage, propose, forme, vends. Gagne des points à chaque publication !" rows="2"></textarea>
</div>
<div class="cat-buttons">${catButtonsHtml}</div>

<div class="diffusion-box" id="diffusionBox">
<div class="diffusion-title"><i data-lucide="sparkles"></i> SAMII suggère de publier aussi sur :</div>
<div class="diffusion-options" id="diffusionOptions"></div>
<div class="diffusion-hint">Décoche ce que tu ne veux pas partager ailleurs.</div>
</div>

<input type="file" id="fileInput" accept="image/*,video/*" style="display:none;">
<div class="upload-preview" id="uploadPreview"></div>
<div class="upload-status" id="uploadStatus">⏳ Envoi en cours...</div>
<div class="composer-bottom">
<span class="composer-hint">+5 points à chaque publication</span>
<button class="composer-submit" id="composerSubmit" type="button">Publier</button>
</div>
</div>
<div id="feedContainer">${feedHtml}</div>
</div>

<div class="col-side"><div class="side-panel"><h3><i data-lucide="trophy"></i> Classement SAMII</h3>${classementHtml}</div></div>
</div>
</div>
<div class="toast" id="toast"></div>
${mobileNav("/community")}
<script>
if (typeof lucide!=="undefined") lucide.createIcons();
const savedTheme=localStorage.getItem("samii_community_theme"); if(savedTheme==="light") document.body.classList.add("light");
function upIcon(){const b=document.getElementById("themeBtn");if(!b)return;b.innerHTML=document.body.classList.contains("light")?'<i data-lucide="sun"></i>':'<i data-lucide="moon"></i>';if(typeof lucide!=="undefined")lucide.createIcons();}
upIcon();
document.getElementById("themeBtn")?.addEventListener("click",()=>{document.body.classList.toggle("light");localStorage.setItem("samii_community_theme",document.body.classList.contains("light")?"light":"dark");upIcon();});
function showToast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400);}

const MODULES_PAR_CATEGORIE = {
    photo: [], video: [],
    produit: ["marketplace"],
    service: ["marketplace"],
    formation: ["academy"],
    publication: [],
};
const MODULES_LABELS = { marketplace: { label:"Marketplace", icon:"store" }, academy: { label:"Academy", icon:"graduation-cap" } };

let selectedCategory="publication", uploadedImageUrl="", uploadedVideoUrl="";

function updateDiffusionBox(cat) {
    const box = document.getElementById("diffusionBox");
    const opts = document.getElementById("diffusionOptions");
    const extras = MODULES_PAR_CATEGORIE[cat] || [];
    if (!extras.length) { box.classList.remove("show"); opts.innerHTML=""; return; }
    box.classList.add("show");
    opts.innerHTML = extras.map(m => {
        const info = MODULES_LABELS[m];
        return '<label class="diffusion-chip"><input type="checkbox" name="diffusion" value="'+m+'" checked><i data-lucide="'+info.icon+'"></i> '+info.label+'</label>';
    }).join("");
    if (typeof lucide!=="undefined") lucide.createIcons();
}

document.querySelectorAll(".cat-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
        document.querySelectorAll(".cat-btn").forEach(b=>b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedCategory=btn.dataset.cat;
        updateDiffusionBox(selectedCategory);
        if(selectedCategory==="photo"||selectedCategory==="video"){
            document.getElementById("fileInput").accept=selectedCategory==="photo"?"image/*":"video/*";
            document.getElementById("fileInput").click();
        }
    });
});

document.getElementById("fileInput").addEventListener("change",async function(){
    const file=this.files[0]; if(!file) return;
    const status=document.getElementById("uploadStatus"); const preview=document.getElementById("uploadPreview");
    status.style.display="block"; status.textContent="⏳ Envoi en cours...";
    try{
        const fd=new FormData(); fd.append("file",file); fd.append("upload_preset","MARKETPLACE OG");
        const isVideo=file.type.startsWith("video"); const rt=isVideo?"video":"image";
        const res=await fetch("https://api.cloudinary.com/v1_1/ojwx5hft/"+rt+"/upload",{method:"POST",body:fd});
        const json=await res.json();
        if(json.secure_url){
            if(isVideo){uploadedVideoUrl=json.secure_url;uploadedImageUrl="";} else {uploadedImageUrl=json.secure_url;uploadedVideoUrl="";}
            preview.style.display="block";
            preview.innerHTML=(isVideo?'<video src="'+json.secure_url+'" controls></video>':'<img src="'+json.secure_url+'" alt="">')+'<button class="upload-remove" type="button" onclick="removeUpload()"><i data-lucide="x"></i></button>';
            if(typeof lucide!=="undefined")lucide.createIcons();
            status.style.display="none"; showToast("✅ Fichier prêt !");
        } else { status.textContent="❌ Échec de l'envoi."; }
    }catch(e){ status.textContent="❌ Erreur réseau."; }
});
function removeUpload(){uploadedImageUrl="";uploadedVideoUrl="";document.getElementById("uploadPreview").style.display="none";document.getElementById("uploadPreview").innerHTML="";document.getElementById("fileInput").value="";}

document.getElementById("composerSubmit").addEventListener("click",async function(){
    const contenu=document.getElementById("composerText").value.trim();
    if(!contenu && !uploadedImageUrl && !uploadedVideoUrl){ showToast("Écris quelque chose ou ajoute un fichier."); return; }
    const diffusionCheckboxes=document.querySelectorAll('input[name="diffusion"]:checked');
    const diffusion=Array.from(diffusionCheckboxes).map(cb=>cb.value);
    this.disabled=true;
    try{
        const res=await fetch("/community/publier",{method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({contenu,categorie:selectedCategory,image_url:uploadedImageUrl,video_url:uploadedVideoUrl,diffusion})});
        const json=await res.json();
        if(json.success){ window.location.reload(); } else { showToast(json.error||"Erreur."); this.disabled=false; }
    }catch(e){ showToast("Erreur réseau."); this.disabled=false; }
});

async function toggleLike(id,btn){
    try{const res=await fetch("/community/like/"+id,{method:"POST"});const j=await res.json();if(j.success)btn.classList.toggle("liked",j.liked);}catch(e){showToast("Erreur réseau.");}
}
function toggleCommentBox(id){const box=document.getElementById("comment-box-"+id);box.style.display=box.style.display==="none"?"flex":"none";if(box.style.display==="flex")document.getElementById("comment-input-"+id).focus();}
async function postComment(id){
    const input=document.getElementById("comment-input-"+id); const contenu=input.value.trim(); if(!contenu) return;
    try{const res=await fetch("/community/commenter/"+id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contenu})});
    const j=await res.json(); if(j.success) window.location.reload(); else showToast(j.error||"Erreur.");}catch(e){showToast("Erreur réseau.");}
}
function sharePost(id){const url=window.location.origin+"/community#post-"+id;if(navigator.share)navigator.share({url}).catch(()=>{});else{navigator.clipboard.writeText(url);showToast("🔗 Lien copié !");}}
</script>
<script src="/js/pwa-register.js"></script>
</body></html>`);
});

// Crée réellement l'annonce Marketplace correspondant à une publication
// "produit"/"service" — n'utilise que des données réelles (contenu de la
// publication, pays du profil) ; laisse prix/catégorie vides plutôt que
// d'inventer une valeur (affichage "Sur devis"/"Autre" déjà géré ailleurs).
async function diffuserVersMarketplace(pub, userId, nomAuteur) {
    const titre = (pub.contenu || "Service proposé").slice(0, 180) || "Service proposé";
    const categorieAnnonce = pub.categorie === "service" ? "service-autre" : null;

    let pays = null;
    try {
        const u = await db.query(`SELECT pays FROM utilisateurs WHERE id = $1`, [userId]);
        pays = u[0]?.pays || null;
    } catch { /* pays optionnel */ }

    const rows = await db.query(
        `INSERT INTO annonces (titre, categorie, prix, pays, description, photo_url, vendeur_id, vendeur_nom, type_vendeur, actif)
         VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,'particulier',true) RETURNING id`,
        [titre, categorieAnnonce, pays, pub.contenu || "", pub.image_url || null, userId, nomAuteur]
    );
    return rows[0]?.id || null;
}

// Idem pour Academy — academie_cours n'a aucune colonne obligatoire hors id,
// donc pas besoin d'inventer de données manquantes (prix/durée restent NULL).
async function diffuserVersAcademy(pub, userId, nomAuteur) {
    const titre = (pub.contenu || "Formation").slice(0, 180) || "Formation";
    const rows = await db.query(
        `INSERT INTO academie_cours (titre, description, photo_url, video_url, formateur_id, formateur_nom, type_formateur, actif)
         VALUES ($1,$2,$3,$4,$5,$6,'communaute',true) RETURNING id`,
        [titre, pub.contenu || "", pub.image_url || null, pub.video_url || null, userId, nomAuteur]
    );
    return rows[0]?.id || null;
}

router.post("/publier", requireAuth, async (req, res) => {
    try {
        const { contenu, image_url, video_url, categorie, diffusion } = req.body;
        if (!contenu && !image_url && !video_url) return res.json({ success:false, error:"Ajoute du texte ou un fichier." });

        const cat = CATEGORIES[categorie] ? categorie : "publication";
        const nomAuteur = (req.session.nom || "Membre SAMII").trim();

        const insertRes = await db.query(
            `INSERT INTO publications (auteur_id, contenu, image_url, video_url, categorie, type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [req.session.userId, contenu||"", image_url||null, video_url||null, cat, video_url?"video":image_url?"image":"texte"]
        );
        const publicationId = insertRes[0]?.id;
        const pub = { contenu, image_url, video_url, categorie: cat };

        await gradeService.ajouterPoints(req.session.userId, 5, "Publication Communauté");

        try {
            await db.query(`INSERT INTO diffusion (contenu_type, contenu_id, module_cible, auteur_id) VALUES ('publication',$1,'community',$2)`, [publicationId, req.session.userId]);
            if (Array.isArray(diffusion)) {
                for (const module of diffusion) {
                    if (!["marketplace","academy"].includes(module)) continue;

                    let resultatId = null;
                    try {
                        if (module === "marketplace" && ["produit","service"].includes(cat)) {
                            resultatId = await diffuserVersMarketplace(pub, req.session.userId, nomAuteur);
                        } else if (module === "academy" && cat === "formation") {
                            resultatId = await diffuserVersAcademy(pub, req.session.userId, nomAuteur);
                        }
                    } catch (creationErr) {
                        console.warn(`⚠️ Création ${module} depuis publication ${publicationId} :`, creationErr.message);
                    }

                    await db.query(
                        `INSERT INTO diffusion (contenu_type, contenu_id, module_cible, auteur_id, resultat_id) VALUES ('publication',$1,$2,$3,$4)`,
                        [publicationId, module, req.session.userId, resultatId]
                    );
                }
            }
        } catch (dErr) { console.warn("⚠️ diffusion :", dErr.message); }

        res.json({ success:true });
    } catch (err) { console.error("❌ publier :", err.message); res.json({ success:false, error:"Erreur serveur." }); }
});

router.post("/like/:id", requireAuth, async (req, res) => {
    try {
        const publicationId = parseInt(req.params.id,10); const userId = req.session.userId;
        if (!publicationId || !userId) return res.json({ success:false, error:"Requête invalide." });
        const existing = await db.query(`SELECT id FROM publications_likes WHERE publication_id=$1 AND user_id=$2`, [publicationId, userId]);
        if (existing.length>0) { await db.query(`DELETE FROM publications_likes WHERE id=$1`, [existing[0].id]); return res.json({ success:true, liked:false }); }
        await db.query(`INSERT INTO publications_likes (publication_id, user_id) VALUES ($1,$2)`, [publicationId, userId]);
        res.json({ success:true, liked:true });
    } catch (err) { console.error("❌ like :", err.message); res.json({ success:false, error:"Erreur serveur." }); }
});

router.post("/commenter/:id", requireAuth, async (req, res) => {
    try {
        const publicationId = parseInt(req.params.id,10); const { contenu } = req.body;
        if (!publicationId || !contenu || !contenu.trim()) return res.json({ success:false, error:"Commentaire vide." });
        await db.query(`INSERT INTO publications_commentaires (publication_id, auteur_id, contenu) VALUES ($1,$2,$3)`, [publicationId, req.session.userId, contenu.trim()]);
        res.json({ success:true });
    } catch (err) { console.error("❌ commenter :", err.message); res.json({ success:false, error:"Erreur serveur." }); }
});

module.exports = router;
