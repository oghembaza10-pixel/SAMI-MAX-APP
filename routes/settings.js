// ==========================================================================
// SAMII OS — PARAMÈTRES (photo, bannière, bio, pays, langue, thème QG)
// Anciennement "/vitrine/modifier/moi" — regroupé ici, l'emplacement
// attendu pour ce genre de réglages.
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");
const gradeService = require("../services/gradeService");
const cloudflareService = require("../services/cloudflareService");

const SOUS_DOMAINES_RESERVES = [
    "www", "samii", "api", "admin", "app", "mail", "smtp", "ftp", "webhook",
    "cdn", "static", "assets", "blog", "shop", "store", "help", "support",
    "send", "resend", "test", "staging", "dev", "ns1", "ns2",
];

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

router.get("/", async (req, res) => {
    let user = {};
    let workspacesMarchand = [];
    try {
        const rows = await db.query(`SELECT * FROM utilisateurs WHERE id = $1`, [req.session.userId]);
        user = rows[0] || {};
        if (user.type_compte === "marchand" && user.email) {
            workspacesMarchand = await db.query(
                `SELECT id, nom FROM workspaces WHERE owner_email = $1 ORDER BY created_at ASC`,
                [user.email]
            );
        }
    } catch (err) {
        console.error("❌ GET /settings :", err.message);
    }

    const isClient = req.session.typeCompte === "client";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paramètres — SAMII</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --border:rgba(0,217,255,.16); --radius:18px; --cyan-glow:0 0 15px rgba(0,217,255,.45); }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,sans-serif; padding:30px 20px 80px; }
.vm-shell { max-width:560px; margin:0 auto; }
.vm-top-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:22px; }
.back { display:inline-flex; align-items:center; gap:8px; color:var(--muted); text-decoration:none; font-size:13px; }
.back:hover { color:var(--blue); }
.lang-switch { display:flex; gap:2px; font-family:"JetBrains Mono"; font-size:10.5px; padding:3px; border:1px solid var(--border); border-radius:9px; background:rgba(0,217,255,.04); }
.lang-switch span { padding:5px 8px; border-radius:6px; cursor:pointer; color:var(--muted); transition:.2s ease; }
.lang-switch span.active, .lang-switch span:hover { color:var(--blue); background:rgba(0,217,255,.1); box-shadow:inset 0 0 0 1px rgba(0,217,255,.18); }
h1 { font-size:22px; margin-bottom:20px; }
.vm-card { background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:24px; }
label { display:block; font-family:"JetBrains Mono"; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin:16px 0 7px; }
label:first-of-type { margin-top:0; }
input,textarea,select { width:100%; padding:12px 13px; border-radius:10px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--text); font-size:13.5px; font-family:inherit; outline:none; }
input:focus,textarea:focus,select:focus { border-color:var(--blue); box-shadow:var(--cyan-glow); }
select option { background:#07101a; }
textarea { resize:vertical; min-height:90px; }
.upload-zone { display:flex; align-items:center; gap:12px; }
.upload-preview-img { width:64px; height:64px; border-radius:12px; object-fit:cover; border:1px solid var(--border); flex-shrink:0; background:#07121d; }
.upload-preview-banner { width:100%; height:80px; border-radius:12px; object-fit:cover; border:1px solid var(--border); background:#07121d; margin-top:8px; }
.upload-btn { padding:10px 16px; border-radius:10px; border:1px solid var(--border); background:transparent; color:var(--blue); font-size:12px; font-weight:700; cursor:pointer; }
.upload-status { font-size:11px; color:var(--blue); margin-top:6px; display:none; }
button[type="submit"] { width:100%; padding:14px; margin-top:20px; border:none; border-radius:12px; background:linear-gradient(135deg,var(--blue),var(--blue-2)); color:#001018; font-weight:800; cursor:pointer; box-shadow:var(--cyan-glow); }
.vm-msg { text-align:center; margin-top:14px; font-size:13px; color:#ff5470; min-height:20px; }
.vm-msg.ok { color:#3ddc84; }
</style>
</head>
<body>
<div class="vm-shell">
    <div class="vm-top-row">
        <a href="${isClient ? "/client-qg" : "/qg"}" class="back"><i data-lucide="arrow-left"></i> <span data-i18n="nav.back">Retour</span></a>
        <div class="lang-switch">
            <span data-lang="fr" class="active">FR</span>
            <span data-lang="en">EN</span>
            <span data-lang="ar">AR</span>
            <span data-lang="zh">中</span>
        </div>
    </div>
    <h1 data-i18n="settings.title">⚙️ Paramètres</h1>
    <div class="vm-card">
        <form id="form-settings">
            <label data-i18n="settings.label.photo">Photo de profil</label>
            <div class="upload-zone">
                <img class="upload-preview-img" id="previewPhoto" src="${escapeHtml(user.photo_profil_url || "")}" alt="">
                <button type="button" class="upload-btn" data-i18n="settings.btn.choose_photo" onclick="document.getElementById('inputPhoto').click()">Choisir une photo</button>
            </div>
            <input type="file" id="inputPhoto" accept="image/*" style="display:none;">
            <input type="hidden" name="photo_profil_url" id="hiddenPhoto" value="${escapeHtml(user.photo_profil_url || "")}">
            <div class="upload-status" id="statusPhoto" data-i18n="msg.uploading">⏳ Envoi en cours...</div>

            <label data-i18n="settings.label.banner">Bannière de couverture</label>
            <img class="upload-preview-banner" id="previewBanner" src="${escapeHtml(user.banniere_url || "")}" alt="">
            <button type="button" class="upload-btn" style="margin-top:8px;" data-i18n="settings.btn.choose_banner" onclick="document.getElementById('inputBanner').click()">Choisir une bannière</button>
            <input type="file" id="inputBanner" accept="image/*" style="display:none;">
            <input type="hidden" name="banniere_url" id="hiddenBanner" value="${escapeHtml(user.banniere_url || "")}">
            <div class="upload-status" id="statusBanner" data-i18n="msg.uploading">⏳ Envoi en cours...</div>

            <label data-i18n="settings.label.bio">Bio / présentation</label>
            <textarea name="bio_vitrine" placeholder="Parle un peu de toi ou de ton activité..." data-i18n-ph="settings.ph.bio">${escapeHtml(user.bio_vitrine || "")}</textarea>

            <label data-i18n="settings.label.pays">Pays</label>
            <input name="pays" value="${escapeHtml(user.pays || "")}" placeholder="Ex : Algérie" data-i18n-ph="settings.ph.pays">

            <label data-i18n="settings.label.langue">Langue préférée</label>
            <select name="langue_preferee">
                <option value="fr" ${user.langue_preferee === "fr" ? "selected" : ""} data-i18n="settings.langue.fr">Français</option>
                <option value="ar" ${user.langue_preferee === "ar" ? "selected" : ""} data-i18n="settings.langue.ar">Arabe</option>
                <option value="en" ${user.langue_preferee === "en" ? "selected" : ""} data-i18n="settings.langue.en">Anglais</option>
            </select>

            <label data-i18n="settings.label.theme">Thème visuel du QG</label>
            <select name="theme_visuel">
                ${gradeService.THEMES.map(t => {
                    const debloque = gradeService.themeEstDebloque(t.id, user.grade_actuel);
                    const selected = user.theme_visuel === t.id ? "selected" : "";
                    const key = `theme.opt.${t.id}${debloque ? "" : "_locked"}`;
                    const label = `${t.emoji} ${t.label}${debloque ? "" : " — verrouillé"}`;
                    return `<option value="${t.id}" ${selected} ${debloque ? "" : "disabled"} data-i18n="${key}">${label}</option>`;
                }).join("")}
            </select>

            <button type="submit" data-i18n="settings.submit">Enregistrer les modifications</button>
        </form>
        <div class="vm-msg" id="msg"></div>
    </div>

    ${!isClient ? `
    <div class="vm-card" id="boutique" style="margin-top:20px;">
        <h1 style="font-size:17px;margin:0 0 4px;" data-i18n="settings.boutique.title">🏪 Ma boutique</h1>
        <p style="color:var(--muted);font-size:12px;margin:0 0 18px;" data-i18n="settings.boutique.sub">Donne un nom à ta boutique et connecte tes pixels publicitaires pour pouvoir lancer des campagnes.</p>
        <form id="form-boutique">
            <label data-i18n="settings.boutique.label.sousdomaine">Adresse de ta boutique</label>
            <div style="display:flex;align-items:center;gap:6px;">
                <input name="sous_domaine" id="sousDomaineInput" value="${escapeHtml(user.sous_domaine || "")}" placeholder="maboutique" data-i18n-ph="settings.boutique.ph.sousdomaine" style="flex:1;">
                <span style="color:var(--muted);font-size:12.5px;white-space:nowrap;">.souverain-store.com</span>
            </div>

            <label data-i18n="settings.boutique.label.pixelmeta">Meta Pixel ID (Facebook/Instagram)</label>
            <input name="pixel_meta" value="${escapeHtml(user.pixel_meta || "")}" placeholder="Ex : 1234567890123456">

            <label data-i18n="settings.boutique.label.pixeltiktok">TikTok Pixel ID</label>
            <input name="pixel_tiktok" value="${escapeHtml(user.pixel_tiktok || "")}" placeholder="Ex : C4XXXXXXXXXXXXXXXX">

            <label data-i18n="settings.boutique.label.pixelgoogle">Google Ads Tag ID</label>
            <input name="pixel_google" value="${escapeHtml(user.pixel_google || "")}" placeholder="Ex : AW-XXXXXXXXX">

            <label data-i18n="settings.boutique.label.qg">Envoyer mes commandes boutique vers ce QG</label>
            <select name="workspace_boutique_id">
                <option value="" data-i18n="settings.boutique.qg.none">— Aucun (ne pas relier) —</option>
                ${workspacesMarchand.map(w => `<option value="${escapeHtml(w.id)}" ${user.workspace_boutique_id === w.id ? "selected" : ""}>${escapeHtml(w.nom || w.id)}</option>`).join("")}
            </select>
            ${!workspacesMarchand.length ? `<p style="font-size:11px;color:var(--muted);margin:4px 0 0;" data-i18n="settings.boutique.qg.empty">Tu n'as pas encore de QG/workspace créé.</p>` : ""}

            <button type="submit" data-i18n="settings.boutique.submit">Enregistrer ma boutique</button>
        </form>
        <div class="vm-msg" id="msgBoutique"></div>
    </div>` : ""}
</div>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

const I18N = {
    fr: {
        "nav.back": "Retour",
        "settings.title": "⚙️ Paramètres",
        "settings.label.photo": "Photo de profil",
        "settings.btn.choose_photo": "Choisir une photo",
        "settings.label.banner": "Bannière de couverture",
        "settings.btn.choose_banner": "Choisir une bannière",
        "settings.label.bio": "Bio / présentation",
        "settings.ph.bio": "Parle un peu de toi ou de ton activité...",
        "settings.label.pays": "Pays",
        "settings.ph.pays": "Ex : Algérie",
        "settings.label.langue": "Langue préférée",
        "settings.langue.fr": "Français",
        "settings.langue.ar": "Arabe",
        "settings.langue.en": "Anglais",
        "settings.label.theme": "Thème visuel du QG",
        "theme.opt.strategiste": "🪖 Stratège",
        "theme.opt.sagesse": "🕊️ Sagesse",
        "theme.opt.aventurier": "🧭 Aventurier",
        "theme.opt.aventurier_locked": "🧭 Aventurier — verrouillé",
        "theme.opt.gaming": "🎮 Gaming",
        "theme.opt.gaming_locked": "🎮 Gaming — verrouillé",
        "theme.opt.og": "👑 Mode OG",
        "settings.submit": "Enregistrer les modifications",
        "msg.uploading": "⏳ Envoi en cours...",
        "msg.upload_ok": "✅ Image envoyée !",
        "msg.upload_fail": "❌ Échec de l'envoi.",
        "msg.network_error": "❌ Erreur réseau.",
        "msg.saving": "Enregistrement...",
        "msg.saved_redirect": "✅ Paramètres enregistrés ! Redirection...",
        "msg.error_generic": "Erreur.",
        "settings.boutique.title": "🏪 Ma boutique",
        "settings.boutique.sub": "Donne un nom à ta boutique et connecte tes pixels publicitaires pour pouvoir lancer des campagnes.",
        "settings.boutique.label.sousdomaine": "Adresse de ta boutique",
        "settings.boutique.ph.sousdomaine": "maboutique",
        "settings.boutique.label.pixelmeta": "Meta Pixel ID (Facebook/Instagram)",
        "settings.boutique.label.pixeltiktok": "TikTok Pixel ID",
        "settings.boutique.label.pixelgoogle": "Google Ads Tag ID",
        "settings.boutique.label.qg": "Envoyer mes commandes boutique vers ce QG",
        "settings.boutique.qg.none": "— Aucun (ne pas relier) —",
        "settings.boutique.qg.empty": "Tu n'as pas encore de QG/workspace créé.",
        "settings.boutique.submit": "Enregistrer ma boutique"
    },
    en: {
        "nav.back": "Back",
        "settings.title": "⚙️ Settings",
        "settings.label.photo": "Profile photo",
        "settings.btn.choose_photo": "Choose a photo",
        "settings.label.banner": "Cover banner",
        "settings.btn.choose_banner": "Choose a banner",
        "settings.label.bio": "Bio / description",
        "settings.ph.bio": "Tell us a bit about you or your business...",
        "settings.label.pays": "Country",
        "settings.ph.pays": "E.g. Algeria",
        "settings.label.langue": "Preferred language",
        "settings.langue.fr": "French",
        "settings.langue.ar": "Arabic",
        "settings.langue.en": "English",
        "settings.label.theme": "HQ visual theme",
        "theme.opt.strategiste": "🪖 Strategist",
        "theme.opt.sagesse": "🕊️ Wisdom",
        "theme.opt.aventurier": "🧭 Adventurer",
        "theme.opt.aventurier_locked": "🧭 Adventurer — locked",
        "theme.opt.gaming": "🎮 Gaming",
        "theme.opt.gaming_locked": "🎮 Gaming — locked",
        "theme.opt.og": "👑 OG Mode",
        "settings.submit": "Save changes",
        "msg.uploading": "⏳ Uploading...",
        "msg.upload_ok": "✅ Image uploaded!",
        "msg.upload_fail": "❌ Upload failed.",
        "msg.network_error": "❌ Network error.",
        "msg.saving": "Saving...",
        "msg.saved_redirect": "✅ Settings saved! Redirecting...",
        "msg.error_generic": "Error.",
        "settings.boutique.title": "🏪 My store",
        "settings.boutique.sub": "Name your store and connect your ad pixels so you can run campaigns.",
        "settings.boutique.label.sousdomaine": "Your store address",
        "settings.boutique.ph.sousdomaine": "mystore",
        "settings.boutique.label.pixelmeta": "Meta Pixel ID (Facebook/Instagram)",
        "settings.boutique.label.pixeltiktok": "TikTok Pixel ID",
        "settings.boutique.label.pixelgoogle": "Google Ads Tag ID",
        "settings.boutique.label.qg": "Send my store orders to this HQ",
        "settings.boutique.qg.none": "— None (don't link) —",
        "settings.boutique.qg.empty": "You don't have a HQ/workspace yet.",
        "settings.boutique.submit": "Save my store"
    },
    ar: {
        "nav.back": "رجوع",
        "settings.title": "⚙️ الإعدادات",
        "settings.label.photo": "صورة الملف الشخصي",
        "settings.btn.choose_photo": "اختر صورة",
        "settings.label.banner": "صورة الغلاف",
        "settings.btn.choose_banner": "اختر صورة غلاف",
        "settings.label.bio": "نبذة / وصف",
        "settings.ph.bio": "حدّثنا قليلاً عنك أو عن نشاطك...",
        "settings.label.pays": "البلد",
        "settings.ph.pays": "مثال: الجزائر",
        "settings.label.langue": "اللغة المفضلة",
        "settings.langue.fr": "الفرنسية",
        "settings.langue.ar": "العربية",
        "settings.langue.en": "الإنجليزية",
        "settings.label.theme": "المظهر البصري للمقر",
        "theme.opt.strategiste": "🪖 استراتيجي",
        "theme.opt.sagesse": "🕊️ حكمة",
        "theme.opt.aventurier": "🧭 مغامر",
        "theme.opt.aventurier_locked": "🧭 مغامر — مقفل",
        "theme.opt.gaming": "🎮 ألعاب",
        "theme.opt.gaming_locked": "🎮 ألعاب — مقفل",
        "theme.opt.og": "👑 وضع OG",
        "settings.submit": "حفظ التعديلات",
        "msg.uploading": "⏳ جارٍ الرفع...",
        "msg.upload_ok": "✅ تم رفع الصورة!",
        "msg.upload_fail": "❌ فشل الرفع.",
        "msg.network_error": "❌ خطأ في الشبكة.",
        "msg.saving": "جارٍ الحفظ...",
        "msg.saved_redirect": "✅ تم حفظ الإعدادات! جارٍ التحويل...",
        "msg.error_generic": "خطأ.",
        "settings.boutique.title": "🏪 متجري",
        "settings.boutique.sub": "اختر اسماً لمتجرك واربط بكسلات الإعلانات لتتمكن من إطلاق حملات.",
        "settings.boutique.label.sousdomaine": "عنوان متجرك",
        "settings.boutique.ph.sousdomaine": "متجري",
        "settings.boutique.label.pixelmeta": "معرّف Meta Pixel (فيسبوك/إنستغرام)",
        "settings.boutique.label.pixeltiktok": "معرّف TikTok Pixel",
        "settings.boutique.label.pixelgoogle": "معرّف Google Ads",
        "settings.boutique.label.qg": "إرسال طلبات متجري إلى مركز القيادة هذا",
        "settings.boutique.qg.none": "— لا شيء (بدون ربط) —",
        "settings.boutique.qg.empty": "ليس لديك مركز قيادة بعد.",
        "settings.boutique.submit": "حفظ متجري"
    },
    zh: {
        "nav.back": "返回",
        "settings.title": "⚙️ 设置",
        "settings.label.photo": "个人头像",
        "settings.btn.choose_photo": "选择照片",
        "settings.label.banner": "封面横幅",
        "settings.btn.choose_banner": "选择横幅",
        "settings.label.bio": "个人简介",
        "settings.ph.bio": "简单介绍一下你自己或你的业务...",
        "settings.label.pays": "国家",
        "settings.ph.pays": "例如：阿尔及利亚",
        "settings.label.langue": "首选语言",
        "settings.langue.fr": "法语",
        "settings.langue.ar": "阿拉伯语",
        "settings.langue.en": "英语",
        "settings.label.theme": "指挥部视觉主题",
        "theme.opt.strategiste": "🪖 战略家",
        "theme.opt.sagesse": "🕊️ 智慧",
        "theme.opt.aventurier": "🧭 冒险家",
        "theme.opt.aventurier_locked": "🧭 冒险家 — 已锁定",
        "theme.opt.gaming": "🎮 游戏",
        "theme.opt.gaming_locked": "🎮 游戏 — 已锁定",
        "theme.opt.og": "👑 OG 模式",
        "settings.submit": "保存修改",
        "msg.uploading": "⏳ 上传中...",
        "msg.upload_ok": "✅ 图片已上传！",
        "msg.upload_fail": "❌ 上传失败。",
        "msg.network_error": "❌ 网络错误。",
        "msg.saving": "保存中...",
        "msg.saved_redirect": "✅ 设置已保存！正在跳转...",
        "msg.error_generic": "错误。",
        "settings.boutique.title": "🏪 我的店铺",
        "settings.boutique.sub": "为你的店铺命名并连接广告像素，以便投放广告。",
        "settings.boutique.label.sousdomaine": "店铺地址",
        "settings.boutique.ph.sousdomaine": "我的店铺",
        "settings.boutique.label.pixelmeta": "Meta 像素 ID（Facebook/Instagram）",
        "settings.boutique.label.pixeltiktok": "TikTok 像素 ID",
        "settings.boutique.label.pixelgoogle": "Google Ads 标签 ID",
        "settings.boutique.label.qg": "将我的店铺订单发送到此指挥中心",
        "settings.boutique.qg.none": "— 无（不关联）—",
        "settings.boutique.qg.empty": "你还没有创建指挥中心/工作区。",
        "settings.boutique.submit": "保存我的店铺"
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

async function uploadToCloudinary(file, statusId, previewId, hiddenId) {
    const status = document.getElementById(statusId);
    status.removeAttribute("data-i18n");
    status.style.display = "block";
    status.textContent = t("msg.uploading");
    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "MARKETPLACE OG");
        const res = await fetch("https://api.cloudinary.com/v1_1/ojwx5hft/image/upload", { method: "POST", body: formData });
        const json = await res.json();
        if (json.secure_url) {
            document.getElementById(previewId).src = json.secure_url;
            document.getElementById(hiddenId).value = json.secure_url;
            status.textContent = t("msg.upload_ok");
            setTimeout(() => status.style.display = "none", 1500);
        } else {
            status.textContent = t("msg.upload_fail");
        }
    } catch (err) {
        status.textContent = t("msg.network_error");
    }
}

document.getElementById("inputPhoto").addEventListener("change", function () {
    if (this.files[0]) uploadToCloudinary(this.files[0], "statusPhoto", "previewPhoto", "hiddenPhoto");
});
document.getElementById("inputBanner").addEventListener("change", function () {
    if (this.files[0]) uploadToCloudinary(this.files[0], "statusBanner", "previewBanner", "hiddenBanner");
});

document.getElementById("form-settings").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("msg");
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = t("msg.saving");
    msg.className = "vm-msg";
    try {
        const res = await fetch("/settings", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.success) {
            msg.textContent = t("msg.saved_redirect");
            msg.className = "vm-msg ok";
            setTimeout(() => {
                window.location.href = document.querySelector(".back").getAttribute("href");
            }, 900);
        } else {
            msg.textContent = t("msg.error_generic");
        }
    } catch (err) {
        msg.textContent = t("msg.network_error");
    }
});

const formBoutique = document.getElementById("form-boutique");
if (formBoutique) {
    formBoutique.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("msgBoutique");
        const data = Object.fromEntries(new FormData(e.target));
        msg.textContent = t("msg.saving");
        msg.className = "vm-msg";
        try {
            const res = await fetch("/settings/boutique", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
            });
            const json = await res.json();
            if (json.success) {
                msg.textContent = "✅ " + t("msg.saved_redirect").replace("✅ ", "");
                msg.className = "vm-msg ok";
            } else {
                msg.textContent = json.error || t("msg.error_generic");
            }
        } catch (err) {
            msg.textContent = t("msg.network_error");
        }
    });
}
</script>
</body>
</html>`);
});

router.post("/", async (req, res) => {
    try {
        const { photo_profil_url, banniere_url, bio_vitrine, pays, langue_preferee, theme_visuel } = req.body;

        // Ne jamais faire confiance au client : un thème verrouillé envoyé
        // via une requête forgée est ignoré, on revient au thème actuel.
        const rows = await db.query(`SELECT grade_actuel, theme_visuel FROM utilisateurs WHERE id = $1`, [req.session.userId]);
        const grade = rows[0]?.grade_actuel || "Soldat";
        const themeActuel = rows[0]?.theme_visuel || "og";
        const themeValide = gradeService.themeEstDebloque(theme_visuel, grade) ? theme_visuel : themeActuel;

        await db.query(
            `UPDATE utilisateurs SET photo_profil_url = $1, banniere_url = $2, bio_vitrine = $3, pays = $4, langue_preferee = $5, theme_visuel = $6 WHERE id = $7`,
            [photo_profil_url || "", banniere_url || "", bio_vitrine || "", pays || "", langue_preferee || "fr", themeValide, req.session.userId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /settings :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

router.post("/boutique", async (req, res) => {
    try {
        if (req.session.typeCompte === "client") {
            return res.json({ success: false, error: "Réservé aux comptes marchands." });
        }

        let { sous_domaine, pixel_meta, pixel_tiktok, pixel_google, workspace_boutique_id } = req.body;
        sous_domaine = String(sous_domaine || "").trim().toLowerCase();
        workspace_boutique_id = String(workspace_boutique_id || "").trim();

        if (workspace_boutique_id) {
            const userRows = await db.query(`SELECT email FROM utilisateurs WHERE id = $1`, [req.session.userId]);
            const appartient = await db.query(
                `SELECT id FROM workspaces WHERE id = $1 AND owner_email = $2`,
                [workspace_boutique_id, userRows[0]?.email || ""]
            );
            if (!appartient.length) {
                return res.json({ success: false, error: "Ce QG ne t'appartient pas." });
            }
        }

        if (sous_domaine) {
            if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(sous_domaine)) {
                return res.json({ success: false, error: "Adresse invalide (lettres, chiffres, tirets, 3 à 30 caractères)." });
            }
            if (SOUS_DOMAINES_RESERVES.includes(sous_domaine)) {
                return res.json({ success: false, error: "Cette adresse est réservée, choisis-en une autre." });
            }

            const existant = await db.query(
                `SELECT id FROM utilisateurs WHERE sous_domaine = $1 AND id != $2`,
                [sous_domaine, req.session.userId]
            );
            if (existant.length) {
                return res.json({ success: false, error: "Cette adresse est déjà prise, choisis-en une autre." });
            }

            const dejaConfigure = await db.query(`SELECT sous_domaine FROM utilisateurs WHERE id = $1`, [req.session.userId]);
            if (dejaConfigure[0]?.sous_domaine !== sous_domaine) {
                const dns = await cloudflareService.createClientSubdomain(sous_domaine);
                if (!dns.success) {
                    console.error("❌ Création sous-domaine :", dns.error);
                    return res.json({ success: false, error: "Impossible de créer cette adresse pour le moment, réessaie dans un instant." });
                }
            }
        }

        await db.query(
            `UPDATE utilisateurs SET sous_domaine = $1, pixel_meta = $2, pixel_tiktok = $3, pixel_google = $4, workspace_boutique_id = $5 WHERE id = $6`,
            [sous_domaine || null, pixel_meta || null, pixel_tiktok || null, pixel_google || null, workspace_boutique_id || null, req.session.userId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /settings/boutique :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
