// ==========================================================================
// SAMII OS — VITRINE — Profil public premium (PostgreSQL)
// Photo + bannière réelles, grade, stats, annonces synchronisées
// ==========================================================================

const express = require("express");
const router = express.Router();
const db = require("../services/db");

const CLOUDINARY_CLOUD_NAME = "ojwx5hft";
const CLOUDINARY_UPLOAD_PRESET = "MARKETPLACE OG";

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

function initiales(prenom, nom) {
    const a = (prenom || "").charAt(0).toUpperCase();
    const b = (nom || "").charAt(0).toUpperCase();
    return (a + b) || "OG";
}

const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

// Rendu du badge "Membre depuis mois année" avec le mois traduisible
// côté client via data-i18n (clé month.<index>) — l'année n'a pas besoin
// de traduction.
function membreDepuisHtml(date) {
    if (!date) return "";
    const d = new Date(date);
    return `<span data-i18n="vitrine.badge.member_since">Membre depuis</span> <span data-i18n="month.${d.getMonth()}">${MOIS_FR[d.getMonth()]}</span> ${d.getFullYear()}`;
}

// ==========================================================================
// PAGE PUBLIQUE
// ==========================================================================

router.get("/:userId", async (req, res) => {
    const userId = req.params.userId;
    let user = null;
    let annonces = [];
    let publications = [];
    let stats = { totalAnnonces: 0, noteMoyenne: 0, totalAvis: 0 };

    try {
        const rows = await db.query(`SELECT * FROM utilisateurs WHERE id = $1`, [userId]);
        user = rows[0] || null;

        if (!user) {
            return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Introuvable</title>
            <style>body{background:#03060b;color:#f5fbff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}</style>
            </head><body><div><h1 data-i18n="vitrine.notfound.title">👤 Profil introuvable</h1><p><a href="/" style="color:#00d9ff;" data-i18n="vitrine.notfound.back">Retour à l'accueil</a></p></div>
            <script>
            var I18N_NF = {
                fr: { "vitrine.notfound.title": "👤 Profil introuvable", "vitrine.notfound.back": "Retour à l'accueil" },
                en: { "vitrine.notfound.title": "👤 Profile not found", "vitrine.notfound.back": "Back to home" },
                ar: { "vitrine.notfound.title": "👤 الملف الشخصي غير موجود", "vitrine.notfound.back": "العودة إلى الرئيسية" },
                zh: { "vitrine.notfound.title": "👤 未找到该资料", "vitrine.notfound.back": "返回首页" }
            };
            var lang = localStorage.getItem("samii_lang") || "fr";
            if (!I18N_NF[lang]) lang = "fr";
            document.documentElement.lang = lang;
            document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
            document.querySelectorAll("[data-i18n]").forEach(function (el) {
                var key = el.getAttribute("data-i18n");
                if (I18N_NF[lang][key] !== undefined) el.textContent = I18N_NF[lang][key];
            });
            </script>
            </body></html>`);
        }

        annonces = await db.query(
            `SELECT * FROM annonces WHERE vendeur_id = $1 AND actif = true ORDER BY created_at DESC LIMIT 24`,
            [userId]
        );
        stats.totalAnnonces = annonces.length;

        publications = await db.query(
            `SELECT * FROM publications WHERE auteur_id = $1 ORDER BY created_at DESC LIMIT 12`,
            [userId]
        );

        const noteRows = await db.query(
            `SELECT ROUND(AVG(note)::numeric, 1) AS moyenne, COUNT(*) AS total FROM avis WHERE cible_type = 'vendeur' AND cible_id = $1`,
            [userId]
        );
        if (noteRows[0]?.total > 0) {
            stats.noteMoyenne = parseFloat(noteRows[0].moyenne);
            stats.totalAvis = parseInt(noteRows[0].total, 10);
        }
    } catch (err) {
        console.error("❌ GET /vitrine/:userId :", err.message);
        return res.status(404).send("Vitrine introuvable.");
    }

    const estMoi = req.session?.userId === userId;

    const nomComplet = `${user.prenom || ""} ${user.nom || ""}`.trim() || "Membre SAMII";
    const aNom = !!(user.prenom || user.nom);
    const estPremium = user.abonnement === "premium";
    const estMarchand = user.type_compte === "marchand";
    const grade = escapeHtml(user.grade_actuel || "Soldat");

    const annoncesHtml = annonces.length ? annonces.map(a => {
        let photos = [];
        try {
            if (a.photos_urls) photos = JSON.parse(a.photos_urls);
        } catch { /* ignore */ }
        const photo = photos[0] || a.photo_url || "";
        const prixHtml = a.prix ? escapeHtml(a.prix) : `<span data-i18n="vitrine.annonce.devis">Sur devis</span>`;
        return `
        <a href="/marketplace/produit/${a.id}" class="vt-card">
            ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(a.titre)}" loading="lazy">` : `<div class="vt-card-placeholder"><i data-lucide="image"></i></div>`}
            <div class="vt-card-body">
                <span>${escapeHtml(a.titre)}</span>
                <strong>${prixHtml}</strong>
            </div>
        </a>`;
    }).join("") : `<div class="vt-empty"><i data-lucide="package-search"></i><p data-i18n="vitrine.empty.annonces">Aucune annonce publiée pour le moment.</p></div>`;

    const publicationsHtml = publications.length ? publications.map(p => `
        <div class="vt-post">
            ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="" loading="lazy">` : ""}
            ${p.contenu ? `<p>${escapeHtml(p.contenu)}</p>` : ""}
        </div>`).join("") : `<div class="vt-empty"><i data-lucide="message-square"></i><p data-i18n="vitrine.empty.publications">Aucune publication pour le moment.</p></div>`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(nomComplet)} — SAMII OS</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --gold:#d7b34c; --border:rgba(0,217,255,.16); --radius:18px; --cyan-glow:0 0 15px rgba(0,217,255,.45); }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,sans-serif; padding-bottom:60px; }
.banner { height:220px; background:linear-gradient(135deg,#07121d,#0a1a2a); position:relative; overflow:hidden; }
.banner img { width:100%; height:100%; object-fit:cover; }
.banner::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,transparent 40%,var(--bg) 100%); }
.profile-wrap { max-width:1000px; margin:0 auto; padding:0 20px; }
.vt-top-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:16px 20px 0; }
.profile-head { display:flex; align-items:flex-end; gap:18px; margin-top:-56px; position:relative; z-index:2; flex-wrap:wrap; }
.avatar { width:112px; height:112px; border-radius:24px; border:4px solid var(--bg); background:linear-gradient(135deg,var(--blue),var(--blue-2)); display:grid; place-items:center; font-size:32px; font-weight:900; color:white; flex-shrink:0; overflow:hidden; }
.avatar img { width:100%; height:100%; object-fit:cover; }
.profile-info { padding-bottom:8px; }
.profile-info h1 { margin:0; font-size:24px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.badges-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
.pbadge { font-family:"JetBrains Mono"; font-size:10px; padding:5px 11px; border-radius:20px; border:1px solid var(--border); color:var(--blue); background:rgba(0,217,255,.08); display:flex; align-items:center; gap:5px; }
.pbadge svg { width:11px; height:11px; }
.pbadge.premium { color:var(--gold); border-color:rgba(215,179,76,.4); background:rgba(215,179,76,.1); }
.pbadge.grade { color:#3ddc84; border-color:rgba(61,220,132,.3); background:rgba(61,220,132,.08); }
.stats-bar { display:flex; gap:26px; margin:22px 0; padding:18px 20px; background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); flex-wrap:wrap; }
.stat-block { text-align:center; }
.stat-block strong { display:block; font-family:"JetBrains Mono"; font-size:20px; color:var(--blue); }
.stat-block span { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
.bio-text { color:var(--muted); font-size:13.5px; line-height:1.7; margin:16px 0; max-width:600px; }
.section-title { font-size:16px; font-weight:800; margin:30px 0 14px; display:flex; align-items:center; gap:8px; }
.section-title svg { width:17px; height:17px; color:var(--blue); }
.vt-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:14px; }
.vt-card { text-decoration:none; color:var(--text); border:1px solid var(--border); border-radius:14px; overflow:hidden; background:var(--panel); transition:.2s; }
.vt-card:hover { transform:translateY(-4px); border-color:var(--blue); box-shadow:var(--cyan-glow); }
.vt-card img { width:100%; aspect-ratio:1/1; object-fit:cover; }
.vt-card-placeholder { width:100%; aspect-ratio:1/1; display:grid; place-items:center; color:var(--blue); background:#07121d; }
.vt-card-body { padding:11px; }
.vt-card-body span { display:block; font-size:11.5px; margin-bottom:5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.vt-card-body strong { color:var(--blue); font-size:13px; }
.vt-empty { grid-column:1/-1; text-align:center; padding:60px 20px; border:1px dashed var(--border); border-radius:16px; color:var(--muted); }
.vt-empty svg { width:36px; height:36px; color:var(--blue); margin-bottom:12px; }
.back-link { display:inline-flex; align-items:center; gap:8px; color:var(--muted); text-decoration:none; font-size:13px; }
.back-link:hover { color:var(--blue); }
.lang-switch { display:flex; gap:2px; font-family:"JetBrains Mono"; font-size:10.5px; padding:3px; border:1px solid var(--border); border-radius:9px; background:rgba(0,217,255,.04); }
.lang-switch span { padding:5px 8px; border-radius:6px; cursor:pointer; color:var(--muted); transition:.2s ease; }
.lang-switch span.active, .lang-switch span:hover { color:var(--blue); background:rgba(0,217,255,.1); box-shadow:inset 0 0 0 1px rgba(0,217,255,.18); }
.edit-vitrine-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 16px; border-radius:10px; border:1px solid var(--border); background:rgba(0,217,255,.08); color:var(--blue); text-decoration:none; font-size:12.5px; font-weight:700; margin:16px 0 0; }
.edit-vitrine-btn:hover { background:rgba(0,217,255,.16); }
.vt-posts { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
.vt-post { border:1px solid var(--border); border-radius:14px; overflow:hidden; background:var(--panel); padding:14px; }
.vt-post img { width:100%; border-radius:10px; margin-bottom:10px; aspect-ratio:16/10; object-fit:cover; }
.vt-post p { font-size:12.5px; color:var(--text); line-height:1.6; margin:0; }
</style>
</head>
<body>
<div class="vt-top-row">
    <a href="/marketplace" class="back-link"><i data-lucide="arrow-left"></i> <span data-i18n="vitrine.back">Retour à Marketplace</span></a>
    <div class="lang-switch">
        <span data-lang="fr" class="active">FR</span>
        <span data-lang="en">EN</span>
        <span data-lang="ar">AR</span>
        <span data-lang="zh">中</span>
    </div>
</div>
<div class="banner">${user.banniere_url ? `<img src="${escapeHtml(user.banniere_url)}" alt="">` : ""}</div>
<div class="profile-wrap">
    <div class="profile-head">
        <div class="avatar">${user.photo_profil_url ? `<img src="${escapeHtml(user.photo_profil_url)}" alt="">` : initiales(user.prenom, user.nom)}</div>
        <div class="profile-info">
            <h1>${aNom ? escapeHtml(nomComplet) : `<span data-i18n="vitrine.default_name">${nomComplet}</span>`}</h1>
            <div class="badges-row">
                <span class="pbadge grade"><i data-lucide="${estMarchand ? "store" : "user"}"></i> <span data-i18n="grade.${grade}">${grade}</span></span>
                ${estPremium ? `<span class="pbadge premium"><i data-lucide="crown"></i> <span data-i18n="vitrine.badge.premium">Premium</span></span>` : ""}
                ${user.pays ? `<span class="pbadge"><i data-lucide="map-pin"></i> ${escapeHtml(user.pays)}</span>` : ""}
                ${user.created_at ? `<span class="pbadge"><i data-lucide="calendar"></i> ${membreDepuisHtml(user.created_at)}</span>` : ""}
            </div>
        </div>
    </div>

    <div class="stats-bar">
        <div class="stat-block"><strong>${stats.totalAnnonces}</strong><span data-i18n="vitrine.stat.annonces">Annonces</span></div>
        <div class="stat-block"><strong>${stats.noteMoyenne || "—"}</strong><span><span data-i18n="vitrine.stat.note">Note</span> ${stats.totalAvis ? `(${stats.totalAvis})` : ""}</span></div>
        <div class="stat-block"><strong>${user.score_grade || 0}</strong><span data-i18n="vitrine.stat.points">Points SAMII</span></div>
    </div>

    ${user.bio_vitrine ? `<p class="bio-text">${escapeHtml(user.bio_vitrine)}</p>` : ""}

    ${estMoi ? `<a href="/settings" class="edit-vitrine-btn"><i data-lucide="pencil"></i> <span data-i18n="vitrine.edit.settings">Paramètres</span></a>
    <a href="/parrainage" class="edit-vitrine-btn" style="margin-left:8px;"><i data-lucide="handshake"></i> <span data-i18n="vitrine.edit.parrainage">Parrainage</span></a>` : ""}

    <div class="section-title"><i data-lucide="store"></i> <span data-i18n="vitrine.section.annonces">Annonces actives</span></div>
    <div class="vt-grid">${annoncesHtml}</div>

    <div class="section-title"><i data-lucide="message-square"></i> <span data-i18n="vitrine.section.publications">Publications Communauté</span></div>
    <div class="vt-posts">${publicationsHtml}</div>
</div>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

const I18N = {
    fr: {
        "vitrine.back": "Retour à Marketplace",
        "vitrine.default_name": "Membre SAMII",
        "vitrine.badge.premium": "Premium",
        "vitrine.badge.member_since": "Membre depuis",
        "vitrine.stat.annonces": "Annonces",
        "vitrine.stat.note": "Note",
        "vitrine.stat.points": "Points SAMII",
        "vitrine.edit.settings": "Paramètres",
        "vitrine.edit.parrainage": "Parrainage",
        "vitrine.section.annonces": "Annonces actives",
        "vitrine.section.publications": "Publications Communauté",
        "vitrine.annonce.devis": "Sur devis",
        "vitrine.empty.annonces": "Aucune annonce publiée pour le moment.",
        "vitrine.empty.publications": "Aucune publication pour le moment.",
        "grade.Soldat": "Soldat", "grade.Caporal": "Caporal", "grade.Sergent": "Sergent",
        "grade.Lieutenant": "Lieutenant", "grade.Capitaine": "Capitaine", "grade.Général": "Général",
        "month.0": "janvier", "month.1": "février", "month.2": "mars", "month.3": "avril",
        "month.4": "mai", "month.5": "juin", "month.6": "juillet", "month.7": "août",
        "month.8": "septembre", "month.9": "octobre", "month.10": "novembre", "month.11": "décembre"
    },
    en: {
        "vitrine.back": "Back to Marketplace",
        "vitrine.default_name": "SAMII Member",
        "vitrine.badge.premium": "Premium",
        "vitrine.badge.member_since": "Member since",
        "vitrine.stat.annonces": "Listings",
        "vitrine.stat.note": "Rating",
        "vitrine.stat.points": "SAMII Points",
        "vitrine.edit.settings": "Settings",
        "vitrine.edit.parrainage": "Referrals",
        "vitrine.section.annonces": "Active listings",
        "vitrine.section.publications": "Community posts",
        "vitrine.annonce.devis": "Contact for price",
        "vitrine.empty.annonces": "No listings published yet.",
        "vitrine.empty.publications": "No posts yet.",
        "grade.Soldat": "Soldier", "grade.Caporal": "Corporal", "grade.Sergent": "Sergeant",
        "grade.Lieutenant": "Lieutenant", "grade.Capitaine": "Captain", "grade.Général": "General",
        "month.0": "January", "month.1": "February", "month.2": "March", "month.3": "April",
        "month.4": "May", "month.5": "June", "month.6": "July", "month.7": "August",
        "month.8": "September", "month.9": "October", "month.10": "November", "month.11": "December"
    },
    ar: {
        "vitrine.back": "العودة إلى Marketplace",
        "vitrine.default_name": "عضو SAMII",
        "vitrine.badge.premium": "بريميوم",
        "vitrine.badge.member_since": "عضو منذ",
        "vitrine.stat.annonces": "الإعلانات",
        "vitrine.stat.note": "التقييم",
        "vitrine.stat.points": "نقاط SAMII",
        "vitrine.edit.settings": "الإعدادات",
        "vitrine.edit.parrainage": "الإحالة",
        "vitrine.section.annonces": "الإعلانات النشطة",
        "vitrine.section.publications": "منشورات المجتمع",
        "vitrine.annonce.devis": "على الطلب",
        "vitrine.empty.annonces": "لا توجد إعلانات منشورة حتى الآن.",
        "vitrine.empty.publications": "لا توجد منشورات حتى الآن.",
        "grade.Soldat": "جندي", "grade.Caporal": "عريف", "grade.Sergent": "رقيب",
        "grade.Lieutenant": "ملازم", "grade.Capitaine": "نقيب", "grade.Général": "جنرال",
        "month.0": "يناير", "month.1": "فبراير", "month.2": "مارس", "month.3": "أبريل",
        "month.4": "مايو", "month.5": "يونيو", "month.6": "يوليو", "month.7": "أغسطس",
        "month.8": "سبتمبر", "month.9": "أكتوبر", "month.10": "نوفمبر", "month.11": "ديسمبر"
    },
    zh: {
        "vitrine.back": "返回 Marketplace",
        "vitrine.default_name": "SAMII 会员",
        "vitrine.badge.premium": "高级版",
        "vitrine.badge.member_since": "加入于",
        "vitrine.stat.annonces": "商品",
        "vitrine.stat.note": "评分",
        "vitrine.stat.points": "SAMII 积分",
        "vitrine.edit.settings": "设置",
        "vitrine.edit.parrainage": "推荐计划",
        "vitrine.section.annonces": "在售商品",
        "vitrine.section.publications": "社区动态",
        "vitrine.annonce.devis": "价格面议",
        "vitrine.empty.annonces": "暂无发布的商品。",
        "vitrine.empty.publications": "暂无动态。",
        "grade.Soldat": "士兵", "grade.Caporal": "下士", "grade.Sergent": "中士",
        "grade.Lieutenant": "中尉", "grade.Capitaine": "上尉", "grade.Général": "将军",
        "month.0": "1月", "month.1": "2月", "month.2": "3月", "month.3": "4月",
        "month.4": "5月", "month.5": "6月", "month.6": "7月", "month.7": "8月",
        "month.8": "9月", "month.9": "10月", "month.10": "11月", "month.11": "12月"
    }
};

let currentLang = localStorage.getItem("samii_lang") || "fr";
function t(key) { return (I18N[currentLang] && I18N[currentLang][key]) || I18N.fr[key] || key; }

function applyLang(lang) {
    if (!I18N[lang]) lang = "fr";
    currentLang = lang;
    localStorage.setItem("samii_lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (I18N[lang][key] !== undefined) el.textContent = I18N[lang][key];
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => {
        const key = el.getAttribute("data-i18n-ph");
        if (I18N[lang][key] !== undefined) el.placeholder = I18N[lang][key];
    });
    document.querySelectorAll(".lang-switch span").forEach(s => s.classList.toggle("active", s.dataset.lang === lang));
}

document.querySelectorAll(".lang-switch span").forEach(span => {
    span.addEventListener("click", () => applyLang(span.dataset.lang));
});

applyLang(currentLang);
</script>
</body>
</html>`);
});

module.exports = router;
