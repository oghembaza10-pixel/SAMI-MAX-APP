// ==========================================================================
// SAMII OS — LOGIN V6 — PostgreSQL (remplace Airtable)
// ==========================================================================
const express = require("express");
const bcrypt  = require("bcrypt");
const router  = express.Router();
const db      = require("../services/db");
const { suiteSure } = require("../services/retour");
const communautes = require("../config/communautes");

// Où renvoyer quelqu'un venu d'une communauté partenaire. Rien pour la
// communauté maison : ses membres vont bien dans leur QG.
function retourCommunaute(req) {
    const slug = req.session?.communaute;
    if (!slug || slug === communautes.DEFAUT || !communautes.existe(slug)) return null;
    return "/c/" + slug;
}

// ── GET /login ────────────────────────────────────────────────
router.get("/", (req, res) => {
    if (req.session?.loggedIn) return res.redirect(communautes.accueilMarchand(res.locals.COM));

    const { error, verified } = req.query;
    // La destination voulue, quand on a été envoyé ici depuis une page qui
    // demande une session (l'espace d'administration d'une communauté).
    // Validée avant d'être recopiée : elle vient de l'URL.
    const suite = suiteSure(req.query?.suite);

    // Clés i18n (le texte FR ci-dessous est affiché avant que le script
    // n'applique la langue sauvegardée par l'utilisateur, cf. data-i18n).
    const msgKeys = {
        token_manquant: "msg.token_manquant",
        token_invalide: "msg.token_invalide",
        token_expire  : "msg.token_expire",
        erreur_serveur: "msg.erreur_serveur",
    };
    const preMsgTextFr = {
        "msg.token_manquant": "❌ Lien de confirmation invalide.",
        "msg.token_invalide": "❌ Ce lien de confirmation n'est plus valide.",
        "msg.token_expire"  : "⌛ Ce lien a expiré. Réinscris-toi ou contacte le support.",
        "msg.erreur_serveur": "❌ Une erreur est survenue. Réessaie.",
        "msg.verified"      : "✅ Email confirmé ! Tu peux te connecter.",
    };
    const preMsgKey    = error ? (msgKeys[error] || "") : (verified ? "msg.verified" : "");
    const preMsg       = preMsgTextFr[preMsgKey] || "";
    const preMsgClass  = verified ? "ok" : "";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Connexion — SAMII</title>
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#070809">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="OG Technology">
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#0b0b0b; font-family:Arial; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:380px; background:#181818; padding:35px; border-radius:14px; border:1px solid #333; }
        h1{ text-align:center; color:#d4af37; margin-bottom:25px; font-size:1.5rem; }
        input{ width:100%; padding:12px; margin-top:12px; border:1px solid #333; border-radius:8px; background:#111; color:white; font-size:.95rem; }
        input:focus{ outline:none; border-color:#d4af37; }
        button{ width:100%; padding:13px; margin-top:22px; background:#d4af37; border:none; border-radius:8px; font-weight:bold; font-size:1rem; cursor:pointer; color:#000; }
        button:hover{ opacity:.9; }
        .msg{ margin-top:14px; text-align:center; font-size:.88rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
        small{ display:block; margin-top:18px; text-align:center; color:#666; font-size:.8rem; }
        a{ color:#d4af37; text-decoration:none; }
        .forgot{ display:block; text-align:right; margin-top:8px; font-size:.8rem; }
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
    <h1 data-i18n="login.title">👑 Connexion</h1>
    <form id="form-login">
        <input name="email"    type="email"    placeholder="Adresse e-mail" data-i18n-ph="login.ph.email" required>
        <input name="password" type="password" placeholder="Mot de passe"   data-i18n-ph="login.ph.password" required>
        ${suite ? `<input type="hidden" name="suite" value="${suite.replace(/"/g, "&quot;")}">` : ""}
        <a href="/password-reset" class="forgot" data-i18n="login.forgot">Mot de passe oublié ?</a>
        <button type="submit" data-i18n="login.submit">Se connecter</button>
    </form>
    <div class="msg ${preMsgClass}" id="msg"${preMsgKey ? ` data-i18n="${preMsgKey}"` : ""}>${preMsg}</div>
    <small><span data-i18n="login.noaccount">Pas encore de compte ?</span> <a href="/register" data-i18n="login.create_link">Créer un compte</a></small>
</div>
<script>
const I18N = {
    fr: {
        'login.title': '👑 Connexion',
        'login.ph.email': 'Adresse e-mail', 'login.ph.password': 'Mot de passe',
        'login.forgot': 'Mot de passe oublié ?', 'login.submit': 'Se connecter',
        'login.noaccount': 'Pas encore de compte ?', 'login.create_link': 'Créer un compte',
        'msg.token_manquant': '❌ Lien de confirmation invalide.',
        'msg.token_invalide': "❌ Ce lien de confirmation n'est plus valide.",
        'msg.token_expire'  : '⌛ Ce lien a expiré. Réinscris-toi ou contacte le support.',
        'msg.erreur_serveur': '❌ Une erreur est survenue. Réessaie.',
        'msg.verified'      : '✅ Email confirmé ! Tu peux te connecter.',
        'msg.connecting': '⏳ Connexion...', 'msg.connected_redirect': '✅ Connecté ! Redirection...',
        'msg.error_default': '❌ Erreur. Réessayez.',
    },
    en: {
        'login.title': '👑 Log in',
        'login.ph.email': 'Email address', 'login.ph.password': 'Password',
        'login.forgot': 'Forgot password?', 'login.submit': 'Log in',
        'login.noaccount': "Don't have an account yet?", 'login.create_link': 'Create an account',
        'msg.token_manquant': '❌ Invalid confirmation link.',
        'msg.token_invalide': '❌ This confirmation link is no longer valid.',
        'msg.token_expire'  : '⌛ This link has expired. Sign up again or contact support.',
        'msg.erreur_serveur': '❌ Something went wrong. Please try again.',
        'msg.verified'      : '✅ Email confirmed! You can now log in.',
        'msg.connecting': '⏳ Signing in...', 'msg.connected_redirect': '✅ Signed in! Redirecting...',
        'msg.error_default': '❌ Error. Please try again.',
    },
    ar: {
        'login.title': '👑 تسجيل الدخول',
        'login.ph.email': 'البريد الإلكتروني', 'login.ph.password': 'كلمة المرور',
        'login.forgot': 'نسيت كلمة المرور؟', 'login.submit': 'تسجيل الدخول',
        'login.noaccount': 'ليس لديك حساب بعد؟', 'login.create_link': 'إنشاء حساب',
        'msg.token_manquant': '❌ رابط التأكيد غير صالح.',
        'msg.token_invalide': '❌ رابط التأكيد هذا لم يعد صالحًا.',
        'msg.token_expire'  : '⌛ انتهت صلاحية هذا الرابط. أعد التسجيل أو تواصل مع الدعم.',
        'msg.erreur_serveur': '❌ حدث خطأ ما. حاول مرة أخرى.',
        'msg.verified'      : '✅ تم تأكيد البريد الإلكتروني! يمكنك الآن تسجيل الدخول.',
        'msg.connecting': '⏳ جارٍ تسجيل الدخول...', 'msg.connected_redirect': '✅ تم تسجيل الدخول! جارٍ التحويل...',
        'msg.error_default': '❌ خطأ. حاول مرة أخرى.',
    },
    zh: {
        'login.title': '👑 登录',
        'login.ph.email': '电子邮箱', 'login.ph.password': '密码',
        'login.forgot': '忘记密码？', 'login.submit': '登录',
        'login.noaccount': '还没有账号？', 'login.create_link': '创建账号',
        'msg.token_manquant': '❌ 确认链接无效。',
        'msg.token_invalide': '❌ 此确认链接已失效。',
        'msg.token_expire'  : '⌛ 此链接已过期。请重新注册或联系客服。',
        'msg.erreur_serveur': '❌ 出现错误，请重试。',
        'msg.verified'      : '✅ 邮箱已确认！现在可以登录了。',
        'msg.connecting': '⏳ 正在登录...', 'msg.connected_redirect': '✅ 登录成功！正在跳转...',
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
}

document.querySelectorAll('.lang-switch span').forEach(span => {
    span.addEventListener('click', () => applyLang(span.dataset.lang));
});

applyLang(currentLang);

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = t('msg.connecting');
    msg.className   = 'msg';

    const res  = await fetch('/login', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json();

    if (json.success) {
        msg.textContent = t('msg.connected_redirect');
        msg.className   = 'msg ok';
        window.location.href = json.redirect || '/hub';
    } else {
        msg.textContent = json.error || t('msg.error_default');
        msg.className   = 'msg';
    }
});
</script>
<script src="/js/pwa-register.js"></script>
</body>
</html>`);
});

// ── POST /login ───────────────────────────────────────────────
router.post("/", async (req, res) => {
    const { email, password } = req.body;
    // Là où la personne allait AVANT qu'on lui demande de se connecter.
    // Elle prime sur la destination habituelle : quelqu'un qui clique sur
    // le lien de son espace d'administration veut atterrir dans son espace
    // d'administration, pas sur le fil de sa communauté.
    //
    // Validée par suiteSure() : elle vient d'un formulaire, donc du dehors.
    const suite = suiteSure(req.body?.suite);

    if (!email || !password) {
        return res.json({ success: false, error: "Email et mot de passe requis." });
    }

    try {
        const rows = await db.query(`SELECT * FROM utilisateurs WHERE email = $1`, [email]);
        const user = rows[0];

        if (!user) {
            return res.json({ success: false, error: "Email ou mot de passe incorrect." });
        }

        const passwordOk = await bcrypt.compare(password, user.password_hash || "");
        if (!passwordOk) {
            return res.json({ success: false, error: "Email ou mot de passe incorrect." });
        }

        if (user.statut_acces === "suspendu") {
            return res.json({ success: false, error: "Compte suspendu. Contactez le support." });
        }

        await db.query(`UPDATE utilisateurs SET last_login = CURRENT_DATE WHERE id = $1`, [user.id]);

        // "client" reste "client" ; toute autre valeur ("marchand", "agence",
        // et les futures) est préservée telle quelle — avant, tout ce qui
        // n'était pas exactement "marchand" retombait sur "client", ce qui
        // aurait cassé la connexion d'un compte agence.
        const typeCompte = user.type_compte === "client" ? "client" : user.type_compte;

        // ── Compte Client : direction QG Client, pas de workspace ──
        if (typeCompte === "client") {
            req.session.regenerate((err) => {
                if (err) return res.json({ success: false, error: "Erreur session." });

                req.session.loggedIn   = true;
                req.session.email      = email;
                req.session.userId     = user.id;
                req.session.nom        = `${user.prenom || ""} ${user.nom || ""}`.trim();
                req.session.typeCompte = "client";
                req.session.workspaceId = null;

                res.json({ success: true, redirect: suite || retourCommunaute(req) || "/client-qg" });
            });
            return;
        }

        // ── Compte Marchand : chercher son workspace ──
        const workspaces = await db.query(`SELECT * FROM workspaces WHERE owner_email = $1`, [email]);
        const workspace = workspaces[0] || null;

        req.session.regenerate((err) => {
            if (err) return res.json({ success: false, error: "Erreur session." });

            req.session.loggedIn   = true;
            req.session.email      = email;
            req.session.userId     = user.id;
            req.session.nom        = `${user.prenom || ""} ${user.nom || ""}`.trim();
            req.session.typeCompte = typeCompte;

            if (workspace) {
                req.session.workspaceId = workspace.id;
                req.session.metier      = workspace.metier;
            } else {
                req.session.workspaceId = null;
            }

            // Une agence atterrit toujours sur son QG Agence, même si elle
            // possède aussi une boutique à elle : son point d'entrée, c'est
            // la vue d'ensemble de ses clients, pas une boutique isolée.
            res.json({
                success : true,
                redirect: suite || retourCommunaute(req) || (typeCompte === "agence" ? "/agence" : (workspace ? "/qg" : "/hub")),
            });
        });

    } catch (err) {
        console.error("❌ Login (PostgreSQL) :", err.message);
        res.json({ success: false, error: "Erreur serveur. Réessayez." });
    }
});

module.exports = router;
