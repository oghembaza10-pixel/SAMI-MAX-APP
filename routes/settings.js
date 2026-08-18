// ==========================================================================
// SAMII OS — PARAMÈTRES (photo, bannière, bio, pays, langue, thème QG)
// Anciennement "/vitrine/modifier/moi" — regroupé ici, l'emplacement
// attendu pour ce genre de réglages.
// ==========================================================================
const express = require("express");
const router = express.Router();
const axios = require("axios");
const db = require("../services/db");
const gradeService = require("../services/gradeService");
const cloudflareService = require("../services/cloudflareService");
const vitrineThemes = require("../config/vitrine-themes");

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
.pixel-detect-btn { width:auto; white-space:nowrap; padding:0 14px; border-radius:10px; border:1px solid var(--blue); background:rgba(0,217,255,.1); color:var(--blue); font-size:12px; font-weight:700; cursor:pointer; }
.pixel-detect-btn:disabled { opacity:.5; cursor:default; }
.pixel-detect-status { font-size:11.5px; margin-top:6px; min-height:14px; color:var(--blue); }
.pixel-detect-status.err { color:#ff5470; }
.pixel-detect-status.ok { color:#3ddc84; }
.pixel-guide-toggle { width:auto; background:transparent; border:none; color:var(--muted); font-size:11.5px; text-decoration:underline; cursor:pointer; padding:6px 0 0; margin:0; }
.pixel-guide-toggle:hover { color:var(--blue); }
.pixel-guide-panel { background:rgba(0,217,255,.04); border:1px solid var(--border); border-radius:10px; padding:12px 14px; margin-top:8px; font-size:12px; color:var(--text); line-height:1.7; }
.pixel-guide-panel ol { margin:0; padding-left:18px; }
.pixel-guide-panel li { margin-bottom:6px; }
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

    ${isClient ? `
    <div class="vm-card" id="compte" style="margin-top:20px;">
        <h1 style="font-size:17px;margin:0 0 4px;" data-i18n="settings.compte.title">🔧 Mon compte</h1>
        <p style="color:var(--muted);font-size:12px;margin:0 0 18px;" data-i18n="settings.compte.sub">Réglages que tu ne touches pas tous les jours.</p>
        <a href="/client-qg/connect" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);text-decoration:none;margin-bottom:10px;">
            <span style="display:flex;align-items:center;gap:10px;color:var(--text-main);font-size:.88rem;"><i data-lucide="plug-zap"></i> <span data-i18n="settings.compte.connect">Connecter mes réseaux (Telegram, WhatsApp...)</span></span>
            <i data-lucide="chevron-right" style="color:var(--muted);"></i>
        </a>
        <a href="/client-qg/premium" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);text-decoration:none;">
            <span style="display:flex;align-items:center;gap:10px;color:var(--text-main);font-size:.88rem;"><i data-lucide="crown"></i> <span data-i18n="settings.compte.premium">Gérer mon abonnement SAMII Premium</span></span>
            <i data-lucide="chevron-right" style="color:var(--muted);"></i>
        </a>
    </div>` : ""}

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

            <label data-i18n="settings.boutique.label.pixelmeta">Meta Pixel ID (Facebook/Instagram) — facultatif</label>
            <div style="display:flex;gap:6px;">
                <input name="pixel_meta" id="pixelMetaInput" value="${escapeHtml(user.pixel_meta || "")}" placeholder="Ex : 1234567890123456" style="flex:1;">
                <button type="button" class="pixel-detect-btn" id="detectMetaBtn" data-i18n="settings.boutique.pixel.detect">🔍 Détecter</button>
            </div>
            <div class="pixel-detect-status" id="detectMetaStatus"></div>
            <button type="button" class="pixel-guide-toggle" data-guide="meta" data-i18n="settings.boutique.pixel.guideBtn">📖 Comment le récupérer moi-même ?</button>
            <div class="pixel-guide-panel" id="guide-meta" style="display:none;"></div>

            <label data-i18n="settings.boutique.label.pixeltiktok">TikTok Pixel ID — facultatif</label>
            <input name="pixel_tiktok" value="${escapeHtml(user.pixel_tiktok || "")}" placeholder="Ex : C4XXXXXXXXXXXXXXXX">
            <button type="button" class="pixel-guide-toggle" data-guide="tiktok" data-i18n="settings.boutique.pixel.guideBtn">📖 Comment le récupérer moi-même ?</button>
            <div class="pixel-guide-panel" id="guide-tiktok" style="display:none;"></div>

            <label data-i18n="settings.boutique.label.pixelgoogle">Google Ads Tag ID — facultatif</label>
            <input name="pixel_google" value="${escapeHtml(user.pixel_google || "")}" placeholder="Ex : AW-XXXXXXXXX">
            <button type="button" class="pixel-guide-toggle" data-guide="google" data-i18n="settings.boutique.pixel.guideBtn">📖 Comment le récupérer moi-même ?</button>
            <div class="pixel-guide-panel" id="guide-google" style="display:none;"></div>
            <p style="color:var(--muted);font-size:11px;margin:6px 0 0;" data-i18n="settings.boutique.pixel.optionalNote">Remplis uniquement les pixels des plateformes où tu comptes faire de la pub — aucun n'est obligatoire.</p>

            <label data-i18n="settings.boutique.label.theme" style="margin-top:16px;display:block;">🎨 Thème de couleurs de la vitrine</label>
            <div style="display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 14px;">
                ${Object.entries(vitrineThemes.THEMES).map(([id, theme]) => `
                <label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;width:84px;">
                    <input type="radio" name="vitrine_theme" value="${id}" ${(user.vitrine_theme || "signature") === id ? "checked" : ""} style="margin:0;">
                    <span style="display:flex;width:100%;height:34px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.15);">
                        <span style="flex:1;background:${theme.vars["--bg"]};"></span>
                        <span style="flex:1;background:${theme.vars["--blue"]};"></span>
                        <span style="flex:1;background:${theme.vars["--gold"]};"></span>
                    </span>
                    <span style="font-size:10.5px;color:var(--muted);text-align:center;line-height:1.2;">${escapeHtml(theme.label)}</span>
                </label>`).join("")}
            </div>

            <label data-i18n="settings.boutique.label.grille" style="display:block;">🧱 Disposition des produits</label>
            <div style="display:flex;gap:16px;margin:6px 0 14px;">
                <label style="cursor:pointer;display:flex;align-items:center;gap:6px;font-size:12.5px;">
                    <input type="radio" name="vitrine_grille" value="compacte" ${(user.vitrine_grille || "compacte") === "compacte" ? "checked" : ""}>
                    <span data-i18n="settings.boutique.grille.compacte">Compacte (plus de produits par ligne)</span>
                </label>
                <label style="cursor:pointer;display:flex;align-items:center;gap:6px;font-size:12.5px;">
                    <input type="radio" name="vitrine_grille" value="grande" ${user.vitrine_grille === "grande" ? "checked" : ""}>
                    <span data-i18n="settings.boutique.grille.grande">Grande (photos plus grandes)</span>
                </label>
            </div>
            <p style="color:var(--muted);font-size:11px;margin:0 0 6px;">
                <span data-i18n="settings.boutique.produits.link">Pour organiser tes produits en sections et en mettre en vedette :</span>
                <a href="/marketplace/mes-produits" style="color:var(--blue);" data-i18n="settings.boutique.produits.linkText">Gérer mes produits →</a>
            </p>

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

    <div class="vm-card" id="livraison" style="margin-top:20px;">
        <h1 style="font-size:17px;margin:0 0 4px;" data-i18n="settings.livraison.title">🚚 Livraison</h1>
        <p style="color:var(--muted);font-size:12px;margin:0 0 18px;" data-i18n="settings.livraison.sub">Réglages que tu ne touches pas tous les jours.</p>
        <a href="/livraisons" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);text-decoration:none;margin-bottom:10px;">
            <span style="display:flex;align-items:center;gap:10px;color:var(--text-main);font-size:.88rem;"><i data-lucide="truck"></i> <span data-i18n="settings.livraison.demander">Demander un livreur</span></span>
            <i data-lucide="chevron-right" style="color:var(--muted);"></i>
        </a>
        <a href="/livreur" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);text-decoration:none;">
            <span style="display:flex;align-items:center;gap:10px;color:var(--text-main);font-size:.88rem;"><i data-lucide="bike"></i> <span data-i18n="settings.livraison.devenir">Devenir livreur</span></span>
            <i data-lucide="chevron-right" style="color:var(--muted);"></i>
        </a>
    </div>
</div>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

const PIXEL_GUIDES = {
    fr: {
        meta: { title: "Récupérer ton Meta Pixel ID", steps: [
            "Va sur business.facebook.com/events_manager2 (Gestionnaire d'événements Meta).",
            "Clique sur « Connecter des sources de données » → « Web » → « Meta Pixel » → Connecter.",
            "Donne un nom à ton pixel, entre l'adresse de ta boutique, puis suis les étapes.",
            "Une fois créé, l'ID du pixel (15-16 chiffres) s'affiche en haut de sa page — copie-le et colle-le ici.",
        ]},
        tiktok: { title: "Récupérer ton TikTok Pixel ID", steps: [
            "Va sur ads.tiktok.com → Ressources → Événements → Événements Web.",
            "Clique sur « Créer un pixel », donne-lui un nom.",
            "Choisis « Installer le code manuellement » (ou via un partenaire si proposé).",
            "Une fois créé, l'ID du pixel (commence par C4...) apparaît dans la liste — copie-le et colle-le ici.",
        ]},
        google: { title: "Récupérer ton Google Ads Tag ID", steps: [
            "Va sur ads.google.com → Outils et paramètres → Google Tag (ou « Suivi des conversions »).",
            "Ouvre la section « Google Tag » de ton compte.",
            "Ton identifiant (format AW-XXXXXXXXX) est affiché en haut de cette page — copie-le et colle-le ici.",
        ]},
    },
    en: {
        meta: { title: "Get your Meta Pixel ID", steps: [
            "Go to business.facebook.com/events_manager2 (Meta Events Manager).",
            "Click 'Connect Data Sources' → 'Web' → 'Meta Pixel' → Connect.",
            "Name your pixel, enter your store's address, then follow the steps.",
            "Once created, the Pixel ID (15-16 digits) shows at the top of its page — copy it and paste it here.",
        ]},
        tiktok: { title: "Get your TikTok Pixel ID", steps: [
            "Go to ads.tiktok.com → Assets → Events → Web Events.",
            "Click 'Create Pixel' and name it.",
            "Choose 'Manually install pixel code' (or via a partner if offered).",
            "Once created, the Pixel ID (starts with C4...) appears in the list — copy it and paste it here.",
        ]},
        google: { title: "Get your Google Ads Tag ID", steps: [
            "Go to ads.google.com → Tools & Settings → Google Tag (or 'Conversion tracking').",
            "Open the 'Google Tag' section of your account.",
            "Your ID (format AW-XXXXXXXXX) is shown at the top of this page — copy it and paste it here.",
        ]},
    },
    ar: {
        meta: { title: "احصل على معرّف Meta Pixel الخاص بك", steps: [
            "اذهب إلى business.facebook.com/events_manager2 (مدير الأحداث في Meta).",
            "اضغط على «ربط مصادر البيانات» ← «الويب» ← «Meta Pixel» ← ربط.",
            "أعطِ اسماً للبيكسل، أدخل عنوان متجرك، ثم اتبع الخطوات.",
            "بمجرد إنشائه، يظهر معرّف البيكسل (15-16 رقماً) أعلى الصفحة — انسخه والصقه هنا.",
        ]},
        tiktok: { title: "احصل على معرّف TikTok Pixel الخاص بك", steps: [
            "اذهب إلى ads.tiktok.com ← الأصول ← الأحداث ← أحداث الويب.",
            "اضغط على «إنشاء بيكسل» وأعطه اسماً.",
            "اختر «تثبيت الكود يدوياً» (أو عبر شريك إذا كان متاحاً).",
            "بمجرد إنشائه، يظهر معرّف البيكسل (يبدأ بـ C4...) في القائمة — انسخه والصقه هنا.",
        ]},
        google: { title: "احصل على معرّف Google Ads الخاص بك", steps: [
            "اذهب إلى ads.google.com ← الأدوات والإعدادات ← Google Tag (أو «تتبع التحويلات»).",
            "افتح قسم «Google Tag» في حسابك.",
            "يظهر معرّفك (بصيغة AW-XXXXXXXXX) أعلى هذه الصفحة — انسخه والصقه هنا.",
        ]},
    },
};

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
        "settings.compte.title": "🔧 Mon compte",
        "settings.compte.sub": "Réglages que tu ne touches pas tous les jours.",
        "settings.compte.connect": "Connecter mes réseaux (Telegram, WhatsApp...)",
        "settings.compte.premium": "Gérer mon abonnement SAMII Premium",
        "settings.boutique.title": "🏪 Ma boutique",
        "settings.boutique.sub": "Donne un nom à ta boutique et connecte tes pixels publicitaires pour pouvoir lancer des campagnes.",
        "settings.boutique.label.sousdomaine": "Adresse de ta boutique",
        "settings.boutique.ph.sousdomaine": "maboutique",
        "settings.boutique.label.pixelmeta": "Meta Pixel ID (Facebook/Instagram) — facultatif",
        "settings.boutique.label.pixeltiktok": "TikTok Pixel ID — facultatif",
        "settings.boutique.label.pixelgoogle": "Google Ads Tag ID — facultatif",
        "settings.boutique.label.qg": "Envoyer mes commandes boutique vers ce QG",
        "settings.boutique.qg.none": "— Aucun (ne pas relier) —",
        "settings.boutique.qg.empty": "Tu n'as pas encore de QG/workspace créé.",
        "settings.boutique.pixel.detect": "🔍 Détecter",
        "settings.boutique.pixel.guideBtn": "📖 Comment le récupérer moi-même ?",
        "settings.boutique.pixel.optionalNote": "Remplis uniquement les pixels des plateformes où tu comptes faire de la pub — aucun n'est obligatoire.",
        "settings.boutique.label.theme": "🎨 Thème de couleurs de la vitrine",
        "settings.boutique.label.grille": "🧱 Disposition des produits",
        "settings.boutique.grille.compacte": "Compacte (plus de produits par ligne)",
        "settings.boutique.grille.grande": "Grande (photos plus grandes)",
        "settings.boutique.produits.link": "Pour organiser tes produits en sections et en mettre en vedette :",
        "settings.boutique.produits.linkText": "Gérer mes produits →",
        "settings.boutique.saved": "Enregistré !",
        "settings.boutique.viewLink": "Voir ma boutique →",
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
        "settings.compte.title": "🔧 My account",
        "settings.compte.sub": "Settings you don't touch every day.",
        "settings.compte.connect": "Connect my accounts (Telegram, WhatsApp...)",
        "settings.compte.premium": "Manage my SAMII Premium subscription",
        "settings.boutique.title": "🏪 My store",
        "settings.boutique.sub": "Name your store and connect your ad pixels so you can run campaigns.",
        "settings.boutique.label.sousdomaine": "Your store address",
        "settings.boutique.ph.sousdomaine": "mystore",
        "settings.boutique.label.pixelmeta": "Meta Pixel ID (Facebook/Instagram) — optional",
        "settings.boutique.label.pixeltiktok": "TikTok Pixel ID — optional",
        "settings.boutique.label.pixelgoogle": "Google Ads Tag ID — optional",
        "settings.boutique.label.qg": "Send my store orders to this HQ",
        "settings.boutique.qg.none": "— None (don't link) —",
        "settings.boutique.qg.empty": "You don't have a HQ/workspace yet.",
        "settings.boutique.pixel.detect": "🔍 Detect",
        "settings.boutique.pixel.guideBtn": "📖 How do I find it myself?",
        "settings.boutique.pixel.optionalNote": "Only fill in the pixels for platforms where you plan to run ads — none of them are required.",
        "settings.boutique.label.theme": "🎨 Store color theme",
        "settings.boutique.label.grille": "🧱 Product layout",
        "settings.boutique.grille.compacte": "Compact (more products per row)",
        "settings.boutique.grille.grande": "Large (bigger photos)",
        "settings.boutique.produits.link": "To organize your products into sections and feature them:",
        "settings.boutique.produits.linkText": "Manage my products →",
        "settings.boutique.saved": "Saved!",
        "settings.boutique.viewLink": "View my store →",
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
        "settings.compte.title": "🔧 حسابي",
        "settings.compte.sub": "إعدادات لا تلمسها كل يوم.",
        "settings.compte.connect": "ربط حساباتي (Telegram, WhatsApp...)",
        "settings.compte.premium": "إدارة اشتراكي SAMII Premium",
        "settings.boutique.title": "🏪 متجري",
        "settings.boutique.sub": "اختر اسماً لمتجرك واربط بكسلات الإعلانات لتتمكن من إطلاق حملات.",
        "settings.boutique.label.sousdomaine": "عنوان متجرك",
        "settings.boutique.ph.sousdomaine": "متجري",
        "settings.boutique.label.pixelmeta": "معرّف Meta Pixel (فيسبوك/إنستغرام) — اختياري",
        "settings.boutique.label.pixeltiktok": "معرّف TikTok Pixel — اختياري",
        "settings.boutique.label.pixelgoogle": "معرّف Google Ads — اختياري",
        "settings.boutique.label.qg": "إرسال طلبات متجري إلى مركز القيادة هذا",
        "settings.boutique.qg.none": "— لا شيء (بدون ربط) —",
        "settings.boutique.qg.empty": "ليس لديك مركز قيادة بعد.",
        "settings.boutique.pixel.detect": "🔍 اكتشاف",
        "settings.boutique.pixel.guideBtn": "📖 كيف أحصل عليه بنفسي؟",
        "settings.boutique.pixel.optionalNote": "املأ فقط بيكسلات المنصات التي تنوي الإعلان عليها — لا شيء إلزامي.",
        "settings.boutique.label.theme": "🎨 نمط ألوان المتجر",
        "settings.boutique.label.grille": "🧱 تنظيم عرض المنتجات",
        "settings.boutique.grille.compacte": "مضغوط (منتجات أكثر في كل صف)",
        "settings.boutique.grille.grande": "كبير (صور أكبر)",
        "settings.boutique.produits.link": "لتنظيم منتجاتك في أقسام وإبرازها:",
        "settings.boutique.produits.linkText": "إدارة منتجاتي ←",
        "settings.boutique.saved": "تم الحفظ!",
        "settings.boutique.viewLink": "عرض متجري ←",
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
        "settings.compte.title": "🔧 我的账户",
        "settings.compte.sub": "不常用的设置。",
        "settings.compte.connect": "连接我的账号（Telegram、WhatsApp……）",
        "settings.compte.premium": "管理我的 SAMII Premium 订阅",
        "settings.boutique.title": "🏪 我的店铺",
        "settings.boutique.sub": "为你的店铺命名并连接广告像素，以便投放广告。",
        "settings.boutique.label.sousdomaine": "店铺地址",
        "settings.boutique.ph.sousdomaine": "我的店铺",
        "settings.boutique.label.pixelmeta": "Meta 像素 ID（Facebook/Instagram）——可选",
        "settings.boutique.label.pixeltiktok": "TikTok 像素 ID——可选",
        "settings.boutique.label.pixelgoogle": "Google Ads 标签 ID——可选",
        "settings.boutique.label.qg": "将我的店铺订单发送到此指挥中心",
        "settings.boutique.qg.none": "— 无（不关联）—",
        "settings.boutique.qg.empty": "你还没有创建指挥中心/工作区。",
        "settings.boutique.pixel.detect": "🔍 自动检测",
        "settings.boutique.pixel.guideBtn": "📖 我该如何自己获取？",
        "settings.boutique.pixel.optionalNote": "只需填写你打算投放广告的平台的像素——都不是必填项。",
        "settings.boutique.label.theme": "🎨 店铺配色主题",
        "settings.boutique.label.grille": "🧱 产品排列方式",
        "settings.boutique.grille.compacte": "紧凑（每行更多产品）",
        "settings.boutique.grille.grande": "大图（图片更大）",
        "settings.boutique.produits.link": "要将产品整理为分类并设为精选：",
        "settings.boutique.produits.linkText": "管理我的产品 →",
        "settings.boutique.saved": "已保存！",
        "settings.boutique.viewLink": "查看我的店铺 →",
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
                const sousDomaine = String(data.sous_domaine || "").trim();
                msg.className = "vm-msg ok";
                msg.textContent = "";
                msg.appendChild(document.createTextNode("✅ " + t("settings.boutique.saved") + " "));
                if (sousDomaine) {
                    const link = document.createElement("a");
                    link.href = "https://" + sousDomaine + ".souverain-store.com";
                    link.target = "_blank";
                    link.rel = "noopener";
                    link.style.color = "var(--blue)";
                    link.textContent = t("settings.boutique.viewLink");
                    msg.appendChild(link);
                }
            } else {
                msg.textContent = json.error || t("msg.error_generic");
            }
        } catch (err) {
            msg.textContent = t("msg.network_error");
        }
    });
}

document.querySelectorAll(".pixel-guide-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
        const platform = btn.dataset.guide;
        const panel = document.getElementById("guide-" + platform);
        if (!panel) return;
        const isOpen = panel.style.display !== "none";
        panel.style.display = isOpen ? "none" : "block";
        if (!isOpen) {
            const guide = (PIXEL_GUIDES[currentLang] || PIXEL_GUIDES.fr)[platform];
            panel.innerHTML = "<strong>" + guide.title + "</strong><ol>" + guide.steps.map(s => "<li>" + s + "</li>").join("") + "</ol>";
        }
    });
});

const detectMetaBtn = document.getElementById("detectMetaBtn");
if (detectMetaBtn) {
    detectMetaBtn.addEventListener("click", async () => {
        const status = document.getElementById("detectMetaStatus");
        detectMetaBtn.disabled = true;
        detectMetaBtn.textContent = "⏳...";
        status.className = "pixel-detect-status";
        status.textContent = "";
        try {
            const res = await fetch("/settings/boutique/detecter-pixel-meta", { method: "POST" });
            const json = await res.json();
            if (json.success) {
                document.getElementById("pixelMetaInput").value = json.pixelId;
                status.className = "pixel-detect-status ok";
                status.textContent = "✅ " + json.pixelId;
            } else {
                status.className = "pixel-detect-status err";
                status.textContent = json.error || "Échec.";
            }
        } catch (err) {
            status.className = "pixel-detect-status err";
            status.textContent = "Erreur réseau.";
        } finally {
            detectMetaBtn.disabled = false;
            detectMetaBtn.textContent = t("settings.boutique.pixel.detect");
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

        let { sous_domaine, pixel_meta, pixel_tiktok, pixel_google, workspace_boutique_id, vitrine_theme, vitrine_grille } = req.body;
        sous_domaine = String(sous_domaine || "").trim().toLowerCase();
        workspace_boutique_id = String(workspace_boutique_id || "").trim();
        vitrine_theme = Object.keys(vitrineThemes.THEMES).includes(vitrine_theme) ? vitrine_theme : "signature";
        vitrine_grille = vitrine_grille === "grande" ? "grande" : "compacte";

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
            `UPDATE utilisateurs SET sous_domaine = $1, pixel_meta = $2, pixel_tiktok = $3, pixel_google = $4, workspace_boutique_id = $5, vitrine_theme = $6, vitrine_grille = $7 WHERE id = $8`,
            [sous_domaine || null, pixel_meta || null, pixel_tiktok || null, pixel_google || null, workspace_boutique_id || null, vitrine_theme, vitrine_grille, req.session.userId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /settings/boutique :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// Auto-détection du Meta Pixel : réutilise le token déjà obtenu quand le
// marchand a connecté Facebook/Instagram dans "Connecter mes outils" —
// cherche un pixel existant sur son compte pub, en crée un sinon.
// Ne fonctionne que si l'appli Meta de SAMII a déjà l'autorisation
// ads_management pour ce compte (encore en mode test tant que Meta n'a
// pas validé l'app en revue) — sinon Meta renvoie une erreur de permission
// claire, remontée telle quelle au marchand.
router.post("/boutique/detecter-pixel-meta", async (req, res) => {
    try {
        if (req.session.typeCompte === "client") {
            return res.json({ success: false, error: "Réservé aux comptes marchands." });
        }

        const userRows = await db.query(`SELECT email FROM utilisateurs WHERE id = $1`, [req.session.userId]);
        const email = userRows[0]?.email;

        const wsRows = await db.query(
            `SELECT meta_access_token, meta_ad_account_id FROM workspaces
             WHERE owner_email = $1 AND meta_access_token IS NOT NULL AND meta_ad_account_id IS NOT NULL
             LIMIT 1`,
            [email]
        );
        const ws = wsRows[0];
        if (!ws) {
            return res.json({ success: false, error: "Connecte d'abord Facebook/Instagram dans \"Connecter mes outils\" avant de détecter ton pixel." });
        }

        const { meta_access_token: token, meta_ad_account_id: adAccountId } = ws;

        const listRes = await axios.get(`https://graph.facebook.com/v19.0/act_${adAccountId}/adspixels`, {
            params: { fields: "id,name", access_token: token },
        });
        let pixelId = listRes.data?.data?.[0]?.id;

        if (!pixelId) {
            const createRes = await axios.post(`https://graph.facebook.com/v19.0/act_${adAccountId}/adspixels`, null, {
                params: { name: "SAMII Pixel", access_token: token },
            });
            pixelId = createRes.data?.id;
        }

        if (!pixelId) {
            return res.json({ success: false, error: "Aucun pixel trouvé ni créé." });
        }

        await db.query(`UPDATE utilisateurs SET pixel_meta = $1 WHERE id = $2`, [pixelId, req.session.userId]);
        res.json({ success: true, pixelId });
    } catch (err) {
        const metaMsg = err.response?.data?.error?.message;
        console.error("❌ POST /settings/boutique/detecter-pixel-meta :", metaMsg || err.message);
        res.json({ success: false, error: metaMsg || "Échec de la détection — réessaie ou colle ton pixel manuellement." });
    }
});

module.exports = router;
