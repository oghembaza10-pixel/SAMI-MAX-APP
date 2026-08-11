// ==========================================================================
// SAMII OS — INSCRIPTION V2
// ==========================================================================
// Parcours : clic métier (Hub) → cette page → SAMII pose les questions
// essentielles (boutique, pays, devise) → création réelle du workspace →
// redirection vers /qg.
//
// Si la personne a déjà un workspace, on ne repasse pas par ce formulaire :
// redirection directe vers /qg.
// ==========================================================================

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const PAYS_DEVISE = {
    DZ: { label: "Algérie",  devise: "DZD" },
    FR: { label: "France",   devise: "EUR" },
    MA: { label: "Maroc",    devise: "MAD" },
    TN: { label: "Tunisie",  devise: "TND" },
    US: { label: "États-Unis", devise: "USD" },
    CA: { label: "Canada",   devise: "CAD" },
    SA: { label: "Arabie Saoudite", devise: "SAR" },
    AE: { label: "Émirats arabes unis", devise: "AED" },
    autre: { label: "Autre", devise: "" },
};

router.get("/", requireAuth, async (req, res) => {
    const existing = await workspaceService.getByOwner(req.session.email);
    if (existing.length > 0) {
        req.session.workspaceId = existing[0].workspaceId;
        req.session.metier      = existing[0].metier;
        return req.session.save(() => res.redirect("/qg"));
    }

    const metier = req.query.metier || "";
    const paysOptions = Object.entries(PAYS_DEVISE)
        .map(([code, p]) => `<option value="${code}" data-devise="${p.devise}" data-i18n="pays.${code}">${p.label}</option>`)
        .join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>SAMII vous accueille</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{
            background:#050505; font-family:Arial,sans-serif;
            display:flex; justify-content:center; align-items:center;
            min-height:100vh; color:white; padding:20px;
        }
        .box{
            width:100%; max-width:440px; background:#12121a;
            padding:32px; border-radius:16px; border:1px solid rgba(197,160,89,.25);
        }
        .samii-line{ display:flex; gap:10px; align-items:flex-start; margin-bottom:18px; }
        .samii-avatar{
            width:36px; height:36px; border-radius:50%; flex-shrink:0;
            background:linear-gradient(145deg,#7d5cff,#5a3fe0);
            display:flex; align-items:center; justify-content:center; font-size:16px;
        }
        .samii-bubble{
            background:#1a1a24; border-radius:12px; padding:12px 14px;
            font-size:.88rem; line-height:1.5; color:#e8e4d8;
        }
        input, select{
            width:100%; padding:12px; margin-top:8px; margin-bottom:16px;
            border:1px solid #333; border-radius:8px; background:#0d0d12; color:white;
            font-size:.95rem;
        }
        input:focus, select:focus{ outline:none; border-color:#C5A059; }
        label{ font-size:.78rem; color:#86807A; letter-spacing:.03em; }
        button{
            width:100%; padding:13px; margin-top:10px;
            background:#C5A059; border:none; border-radius:8px;
            font-weight:bold; font-size:1rem; cursor:pointer; color:#000;
        }
        button:hover{ opacity:.9; }
        .msg{ margin-top:14px; text-align:center; font-size:.88rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
        .lang-switch{ display:flex; gap:4px; justify-content:center; margin-bottom:18px; font-size:.68rem; }
        .lang-switch span{ padding:5px 10px; border-radius:6px; cursor:pointer; color:#86807A; border:1px solid rgba(197,160,89,.25); transition:.2s ease; }
        .lang-switch span.active, .lang-switch span:hover{ color:#C5A059; border-color:#C5A059; background:rgba(197,160,89,.08); }
    </style>
</head>
<body>
<div class="box">
    <div class="lang-switch">
        <span data-lang="fr" class="active">FR</span>
        <span data-lang="en">EN</span>
        <span data-lang="ar">AR</span>
        <span data-lang="zh">中</span>
    </div>
    <div class="samii-line">
        <div class="samii-avatar">🤖</div>
        <div class="samii-bubble" id="samii-bubble" data-metier="${metier}">
            Bonjour Général ! Je suis <b>SAMII</b>. Avant de construire votre QG${metier ? ` <b>${metier}</b>` : ""},
            j'ai besoin de quelques infos pour bien l'adapter à votre réalité.
        </div>
    </div>

    <form id="form-inscription">
        <label data-i18n="onb.label.boutique">Nom de votre boutique / entreprise</label>
        <input name="boutique" placeholder="Ex : Le Souverain Store" data-i18n-ph="onb.ph.boutique" required>

        <label data-i18n="onb.label.nom">Votre nom</label>
        <input name="nom" placeholder="Votre nom" data-i18n-ph="onb.ph.nom" required>

        <label data-i18n="onb.label.whatsapp">Numéro WhatsApp</label>
        <input name="whatsapp" placeholder="+213..." required>

        <label data-i18n="onb.label.pays">Votre pays</label>
        <select name="pays" id="select-pays">
            <option value="" data-i18n="onb.select_default">Choisissez votre pays</option>
            ${paysOptions}
        </select>

        <label data-i18n="onb.label.devise">Devise</label>
        <input name="devise" id="input-devise" placeholder="Sera pré-remplie selon le pays" data-i18n-ph="onb.ph.devise" readonly>

        <input type="hidden" name="metier" value="${metier}">

        <button type="submit" data-i18n="onb.submit">Créer mon QG</button>
    </form>
    <div class="msg" id="msg"></div>
</div>
<script>
const I18N = {
    fr: {
        'onb.bubble_default': "Bonjour Général ! Je suis <b>SAMII</b>. Avant de construire votre QG, j'ai besoin de quelques infos pour bien l'adapter à votre réalité.",
        'onb.bubble_metier': "Bonjour Général ! Je suis <b>SAMII</b>. Avant de construire votre QG {metier}, j'ai besoin de quelques infos pour bien l'adapter à votre réalité.",
        'onb.label.boutique': 'Nom de votre boutique / entreprise', 'onb.ph.boutique': 'Ex : Le Souverain Store',
        'onb.label.nom': 'Votre nom', 'onb.ph.nom': 'Votre nom',
        'onb.label.whatsapp': 'Numéro WhatsApp',
        'onb.label.pays': 'Votre pays', 'onb.select_default': 'Choisissez votre pays',
        'onb.label.devise': 'Devise', 'onb.ph.devise': 'Sera pré-remplie selon le pays',
        'onb.submit': 'Créer mon QG',
        'pays.DZ': 'Algérie', 'pays.FR': 'France', 'pays.MA': 'Maroc', 'pays.TN': 'Tunisie',
        'pays.US': 'États-Unis', 'pays.CA': 'Canada', 'pays.SA': 'Arabie Saoudite', 'pays.AE': 'Émirats arabes unis', 'pays.autre': 'Autre',
        'msg.preparing': '⏳ SAMII prépare votre QG...', 'msg.created_redirect': '✅ QG créé ! Redirection...',
        'msg.error_default': '❌ Erreur. Réessayez.',
    },
    en: {
        'onb.bubble_default': "Hello General! I'm <b>SAMII</b>. Before building your HQ, I need a few details to tailor it to your reality.",
        'onb.bubble_metier': "Hello General! I'm <b>SAMII</b>. Before building your {metier} HQ, I need a few details to tailor it to your reality.",
        'onb.label.boutique': 'Name of your store / business', 'onb.ph.boutique': 'E.g.: The Sovereign Store',
        'onb.label.nom': 'Your name', 'onb.ph.nom': 'Your name',
        'onb.label.whatsapp': 'WhatsApp number',
        'onb.label.pays': 'Your country', 'onb.select_default': 'Choose your country',
        'onb.label.devise': 'Currency', 'onb.ph.devise': 'Auto-filled based on country',
        'onb.submit': 'Create my HQ',
        'pays.DZ': 'Algeria', 'pays.FR': 'France', 'pays.MA': 'Morocco', 'pays.TN': 'Tunisia',
        'pays.US': 'United States', 'pays.CA': 'Canada', 'pays.SA': 'Saudi Arabia', 'pays.AE': 'United Arab Emirates', 'pays.autre': 'Other',
        'msg.preparing': '⏳ SAMII is preparing your HQ...', 'msg.created_redirect': '✅ HQ created! Redirecting...',
        'msg.error_default': '❌ Error. Please try again.',
    },
    ar: {
        'onb.bubble_default': 'مرحبًا أيها الجنرال! أنا <b>SAMII</b>. قبل بناء مقرّك، أحتاج إلى بعض المعلومات لتكييفه مع واقعك.',
        'onb.bubble_metier': 'مرحبًا أيها الجنرال! أنا <b>SAMII</b>. قبل بناء مقرّك الخاص بـ{metier}، أحتاج إلى بعض المعلومات لتكييفه مع واقعك.',
        'onb.label.boutique': 'اسم متجرك / شركتك', 'onb.ph.boutique': 'مثال: Le Souverain Store',
        'onb.label.nom': 'اسمك', 'onb.ph.nom': 'اسمك',
        'onb.label.whatsapp': 'رقم WhatsApp',
        'onb.label.pays': 'بلدك', 'onb.select_default': 'اختر بلدك',
        'onb.label.devise': 'العملة', 'onb.ph.devise': 'تُملأ تلقائيًا حسب البلد',
        'onb.submit': 'إنشاء مقري',
        'pays.DZ': 'الجزائر', 'pays.FR': 'فرنسا', 'pays.MA': 'المغرب', 'pays.TN': 'تونس',
        'pays.US': 'الولايات المتحدة', 'pays.CA': 'كندا', 'pays.SA': 'المملكة العربية السعودية', 'pays.AE': 'الإمارات العربية المتحدة', 'pays.autre': 'أخرى',
        'msg.preparing': '⏳ SAMII يُجهّز مقرّك...', 'msg.created_redirect': '✅ تم إنشاء المقر! جارٍ التحويل...',
        'msg.error_default': '❌ خطأ. حاول مرة أخرى.',
    },
    zh: {
        'onb.bubble_default': '将军您好！我是 <b>SAMII</b>。在搭建您的总部之前，我需要了解一些信息以便为您量身定制。',
        'onb.bubble_metier': '将军您好！我是 <b>SAMII</b>。在搭建您的{metier}总部之前，我需要了解一些信息以便为您量身定制。',
        'onb.label.boutique': '您的店铺/企业名称', 'onb.ph.boutique': '例如：至尊商店',
        'onb.label.nom': '您的姓名', 'onb.ph.nom': '您的姓名',
        'onb.label.whatsapp': 'WhatsApp 号码',
        'onb.label.pays': '您所在的国家', 'onb.select_default': '请选择您的国家',
        'onb.label.devise': '货币', 'onb.ph.devise': '将根据国家自动填写',
        'onb.submit': '创建我的总部',
        'pays.DZ': '阿尔及利亚', 'pays.FR': '法国', 'pays.MA': '摩洛哥', 'pays.TN': '突尼斯',
        'pays.US': '美国', 'pays.CA': '加拿大', 'pays.SA': '沙特阿拉伯', 'pays.AE': '阿拉伯联合酋长国', 'pays.autre': '其他',
        'msg.preparing': '⏳ SAMII 正在为您搭建总部...', 'msg.created_redirect': '✅ 总部创建成功！正在跳转...',
        'msg.error_default': '❌ 错误，请重试。',
    },
};

let currentLang = localStorage.getItem('samii_lang') || 'fr';
function t(key) { return (I18N[currentLang] && I18N[currentLang][key]) || I18N.fr[key] || key; }

function applyLang(lang) {
    if (!I18N[lang]) lang = 'fr';
    currentLang = lang;
    localStorage.setItem('samii_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (I18N[lang][key] !== undefined) el.textContent = I18N[lang][key];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        if (I18N[lang][key] !== undefined) el.placeholder = I18N[lang][key];
    });
    document.querySelectorAll('.lang-switch span').forEach(s => s.classList.toggle('active', s.dataset.lang === lang));

    const bubble = document.getElementById('samii-bubble');
    if (bubble) {
        const bm = bubble.dataset.metier;
        const key = bm ? 'onb.bubble_metier' : 'onb.bubble_default';
        bubble.innerHTML = t(key).replace('{metier}', bm ? '<b>' + bm + '</b>' : '');
    }
}

document.querySelectorAll('.lang-switch span').forEach(span => {
    span.addEventListener('click', () => applyLang(span.dataset.lang));
});

applyLang(currentLang);

document.getElementById('select-pays').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    document.getElementById('input-devise').value = opt?.dataset.devise || "";
});

document.getElementById('form-inscription').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = t('msg.preparing');
    msg.className   = 'msg';

    const res  = await fetch('/inscription', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json();

    if (json.success) {
        msg.textContent = t('msg.created_redirect');
        msg.className   = 'msg ok';
        window.location.href = json.redirect || '/qg';
    } else {
        msg.textContent = json.error || t('msg.error_default');
    }
});
</script>
</body>
</html>`);
});

router.post("/", requireAuth, async (req, res) => {
    try {
        const { nom, whatsapp, boutique, pays, devise, metier } = req.body;

        if (!boutique || !boutique.trim()) {
            return res.json({ success: false, error: "Le nom de la boutique est requis." });
        }
        if (!pays) {
            return res.json({ success: false, error: "Le pays est requis." });
        }

        const workspaceId = crypto.randomUUID();

        const workspace = await workspaceService.create({
            workspaceId,
            owner : req.session.email,
            nom   : boutique.trim(),
            metier: metier || req.session.metier || "ecommerce",
            logo  : "",
            pays,
            devise: devise || "",
            langue: req.session.langue || "fr",
        });

        if (!workspace) {
            return res.json({ success: false, error: "Erreur lors de la création du QG. Réessayez." });
        }

        req.session.workspaceId = workspaceId;
        req.session.metier      = workspace.metier;

        req.session.save((err) => {
            if (err) return res.json({ success: false, error: "Erreur de session." });
            res.json({ success: true, redirect: "/qg" });
        });

    } catch (err) {
        console.error("❌ POST /inscription :", err.message);
        res.json({ success: false, error: "Erreur serveur. Réessayez." });
    }
});

module.exports = router;
