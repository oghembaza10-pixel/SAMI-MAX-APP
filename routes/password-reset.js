// ==========================================================================
// SAMII OS — MOT DE PASSE OUBLIÉ — PostgreSQL
// ==========================================================================
const express = require("express");
const crypto  = require("crypto");
const bcrypt  = require("bcrypt");
const router  = express.Router();
const gmail   = require("../services/gmail");
const courriel = require("../services/emailTemplate");
const CONFIG  = require("../config");
const db      = require("../services/db");

const TOKEN_VALIDITE_HEURES = 1; // plus court que la vérif email, par sécurité

// ── GET /password-reset — formulaire "entre ton email" ────────
router.get("/", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Mot de passe oublié — SAMII</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#0b0b0b; font-family:Arial; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:380px; background:#181818; padding:35px; border-radius:14px; border:1px solid #333; }
        h1{ text-align:center; color:#d4af37; margin-bottom:8px; font-size:1.4rem; }
        p.sub{ text-align:center; color:#888; font-size:.85rem; margin-bottom:20px; }
        input{ width:100%; padding:12px; margin-top:12px; border:1px solid #333; border-radius:8px; background:#111; color:white; font-size:.95rem; }
        input:focus{ outline:none; border-color:#d4af37; }
        button{ width:100%; padding:13px; margin-top:22px; background:#d4af37; border:none; border-radius:8px; font-weight:bold; font-size:1rem; cursor:pointer; color:#000; }
        .msg{ margin-top:14px; text-align:center; font-size:.88rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
        small{ display:block; margin-top:18px; text-align:center; color:#666; font-size:.8rem; }
        a{ color:#d4af37; text-decoration:none; }
        .lang-switch{ display:flex; gap:4px; justify-content:center; margin-bottom:20px; font-size:.68rem; }
        .lang-switch span{ padding:5px 10px; border-radius:6px; cursor:pointer; color:#777; border:1px solid #333; transition:.2s ease; }
        .lang-switch span.active, .lang-switch span:hover{ color:#d4af37; border-color:#d4af37; background:rgba(212,175,55,.08); }
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
    <h1 data-i18n="reset.title">🔑 Mot de passe oublié</h1>
    <p class="sub" data-i18n="reset.subtitle">On t'envoie un lien pour en choisir un nouveau.</p>
    <form id="form-forgot">
        <input name="email" type="email" placeholder="Ton adresse email" data-i18n-ph="reset.ph.email" required>
        <button type="submit" data-i18n="reset.send">Envoyer le lien</button>
    </form>
    <div class="msg" id="msg"></div>
    <small><a href="/login" data-i18n="reset.back">← Retour à la connexion</a></small>
</div>
<script>
const I18N = {
    fr: {
        'reset.title': '🔑 Mot de passe oublié', 'reset.subtitle': "On t'envoie un lien pour en choisir un nouveau.",
        'reset.ph.email': 'Ton adresse email', 'reset.send': 'Envoyer le lien', 'reset.back': '← Retour à la connexion',
        'msg.sending': '⏳ Envoi en cours...',
    },
    en: {
        'reset.title': '🔑 Forgot password', 'reset.subtitle': "We'll send you a link to choose a new one.",
        'reset.ph.email': 'Your email address', 'reset.send': 'Send link', 'reset.back': '← Back to login',
        'msg.sending': '⏳ Sending...',
    },
    ar: {
        'reset.title': '🔑 نسيت كلمة المرور', 'reset.subtitle': 'سنرسل لك رابطًا لاختيار كلمة مرور جديدة.',
        'reset.ph.email': 'بريدك الإلكتروني', 'reset.send': 'إرسال الرابط', 'reset.back': '← العودة إلى تسجيل الدخول',
        'msg.sending': '⏳ جارٍ الإرسال...',
    },
    zh: {
        'reset.title': '🔑 忘记密码', 'reset.subtitle': '我们会给您发送一个链接，用于设置新密码。',
        'reset.ph.email': '您的电子邮箱', 'reset.send': '发送链接', 'reset.back': '← 返回登录',
        'msg.sending': '⏳ 发送中...',
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
}

document.querySelectorAll('.lang-switch span').forEach(span => {
    span.addEventListener('click', () => applyLang(span.dataset.lang));
});

applyLang(currentLang);

document.getElementById('form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = t('msg.sending');
    msg.className   = 'msg';
    const res  = await fetch('/password-reset/demande', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json(); msg.textContent = json.message || json.error || '';
    msg.className   = json.success ? 'msg ok' : 'msg';
});
</script>
</body>
</html>`);
});

// ── POST /password-reset/demande — génère le token, envoie l'email ──
router.post("/demande", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.json({ success: false, error: "Email requis." });

    const messageGenerique = "✅ Si ce compte existe, un email a été envoyé.";

    try {
        const rows = await db.query(`SELECT id, email FROM utilisateurs WHERE email = $1`, [email]);
        const user = rows[0];

        if (!user) {
            return res.json({ success: true, message: messageGenerique });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expireLe = new Date(Date.now() + TOKEN_VALIDITE_HEURES * 60 * 60 * 1000);

        await db.query(
            `UPDATE utilisateurs SET token_reset_password = $1, token_reset_expire_le = $2 WHERE id = $3`,
            [token, expireLe, user.id]
        );

        const lienReset = `${CONFIG.APP_URL}/password-reset/nouveau?token=${token}`;

        await gmail.send({
            to: email,
            subject: "Réinitialise ton mot de passe — SAMII OS",
            html: courriel.construire({
                titre: "Nouveau mot de passe",
                preheader: "Lien valable une heure. Si ce n'est pas toi, ignore ce message.",
                corps: courriel.p("Tu as demandé à changer ton mot de passe. Choisis-en un nouveau en un clic."),
                cta: { url: lienReset, libelle: "Choisir un nouveau mot de passe" },
                note: `Ce lien expire dans ${TOKEN_VALIDITE_HEURES}h. Si tu n'es pas à l'origine de cette demande, ignore cet email : ton mot de passe actuel reste inchangé.`,
            }),
        });

        res.json({ success: true, message: messageGenerique });
    } catch (err) {
        console.error("❌ /password-reset/demande :", err.message);
        res.json({ success: false, error: "Erreur serveur. Réessaie." });
    }
});

// ── GET /password-reset/nouveau?token=xxx — formulaire nouveau mdp ──
router.get("/nouveau", async (req, res) => {
    const { token } = req.query;
    if (!token) return res.redirect("/login?error=token_manquant");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Nouveau mot de passe — SAMII</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#0b0b0b; font-family:Arial; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:380px; background:#181818; padding:35px; border-radius:14px; border:1px solid #333; }
        h1{ text-align:center; color:#d4af37; margin-bottom:20px; font-size:1.4rem; }
        input{ width:100%; padding:12px; margin-top:12px; border:1px solid #333; border-radius:8px; background:#111; color:white; font-size:.95rem; }
        input:focus{ outline:none; border-color:#d4af37; }
        button{ width:100%; padding:13px; margin-top:22px; background:#d4af37; border:none; border-radius:8px; font-weight:bold; font-size:1rem; cursor:pointer; color:#000; }
        .msg{ margin-top:14px; text-align:center; font-size:.88rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
        .lang-switch{ display:flex; gap:4px; justify-content:center; margin-bottom:20px; font-size:.68rem; }
        .lang-switch span{ padding:5px 10px; border-radius:6px; cursor:pointer; color:#777; border:1px solid #333; transition:.2s ease; }
        .lang-switch span.active, .lang-switch span:hover{ color:#d4af37; border-color:#d4af37; background:rgba(212,175,55,.08); }
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
    <h1 data-i18n="newpwd.title">🔑 Nouveau mot de passe</h1>
    <form id="form-reset">
        <input type="hidden" name="token" value="${token}">
        <input name="password" type="password" placeholder="Nouveau mot de passe" data-i18n-ph="newpwd.ph.password" required minlength="6">
        <input name="confirm"  type="password" placeholder="Confirme le mot de passe" data-i18n-ph="newpwd.ph.confirm" required minlength="6">
        <button type="submit" data-i18n="newpwd.submit">Valider</button>
    </form>
    <div class="msg" id="msg"></div></div>
<script>
const I18N = {
    fr: {
        'newpwd.title': '🔑 Nouveau mot de passe',
        'newpwd.ph.password': 'Nouveau mot de passe', 'newpwd.ph.confirm': 'Confirme le mot de passe',
        'newpwd.submit': 'Valider',
        'msg.mismatch': '❌ Les mots de passe ne correspondent pas.',
        'msg.saving': '⏳ Enregistrement...', 'msg.changed_redirect': '✅ Mot de passe changé ! Redirection...',
        'msg.error_default': '❌ Erreur.',
    },
    en: {
        'newpwd.title': '🔑 New password',
        'newpwd.ph.password': 'New password', 'newpwd.ph.confirm': 'Confirm password',
        'newpwd.submit': 'Confirm',
        'msg.mismatch': '❌ Passwords do not match.',
        'msg.saving': '⏳ Saving...', 'msg.changed_redirect': '✅ Password changed! Redirecting...',
        'msg.error_default': '❌ Error.',
    },
    ar: {
        'newpwd.title': '🔑 كلمة مرور جديدة',
        'newpwd.ph.password': 'كلمة المرور الجديدة', 'newpwd.ph.confirm': 'أكّد كلمة المرور',
        'newpwd.submit': 'تأكيد',
        'msg.mismatch': '❌ كلمتا المرور غير متطابقتين.',
        'msg.saving': '⏳ جارٍ الحفظ...', 'msg.changed_redirect': '✅ تم تغيير كلمة المرور! جارٍ التحويل...',
        'msg.error_default': '❌ خطأ.',
    },
    zh: {
        'newpwd.title': '🔑 设置新密码',
        'newpwd.ph.password': '新密码', 'newpwd.ph.confirm': '确认密码',
        'newpwd.submit': '确认',
        'msg.mismatch': '❌ 两次输入的密码不一致。',
        'msg.saving': '⏳ 正在保存...', 'msg.changed_redirect': '✅ 密码已修改！正在跳转...',
        'msg.error_default': '❌ 错误。',
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
}

document.querySelectorAll('.lang-switch span').forEach(span => {
    span.addEventListener('click', () => applyLang(span.dataset.lang));
});

applyLang(currentLang);

document.getElementById('form-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    if (data.password !== data.confirm) {
        msg.textContent = t('msg.mismatch');
        msg.className   = 'msg';
        return;
    }
    msg.textContent = t('msg.saving');
    msg.className   = 'msg';
    const res  = await fetch('/password-reset/nouveau', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) {
        msg.textContent = t('msg.changed_redirect');
        msg.className   = 'msg ok';
        setTimeout(() => window.location.href = '/login', 1200);
    } else {
        msg.textContent = json.error || t('msg.error_default');
        msg.className   = 'msg';
    }
});
</script>
</body>
</html>`);
});

// ── POST /password-reset/nouveau — enregistre le nouveau mdp ──
router.post("/nouveau", async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.json({ success: false, error: "Données manquantes." });
    }
    if (password.length < 6) {
        return res.json({ success: false, error: "Le mot de passe doit faire au moins 6 caractères." });
    }

    try {
        const rows = await db.query(`SELECT * FROM utilisateurs WHERE token_reset_password = $1`, [token]);
        const user = rows[0];

        if (!user) return res.json({ success: false, error: "Lien invalide ou déjà utilisé." });

        const expireLe = user.token_reset_expire_le ? new Date(user.token_reset_expire_le) : null;
        if (!expireLe || Date.now() > expireLe.getTime()) {
            return res.json({ success: false, error: "Ce lien a expiré. Refais une demande." });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await db.query(
            `UPDATE utilisateurs SET password_hash = $1, token_reset_password = NULL, token_reset_expire_le = NULL WHERE id = $2`,
            [passwordHash, user.id]
        );

        console.log(`✅ Mot de passe réinitialisé pour : ${user.email}`);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ /password-reset/nouveau :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
