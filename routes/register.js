// ==========================================================================
// SAMII OS — REGISTER V6 — PostgreSQL (remplace Airtable)
// ==========================================================================
const express = require("express");
const crypto  = require("crypto");
const bcrypt  = require("bcrypt");
const router  = express.Router();
const gmail   = require("../services/gmail");
const CONFIG  = require("../config");
const db      = require("../services/db");
const gradeService = require("../services/gradeService");
const referralService = require("../services/referralService");
const workspaceService = require("../services/workspaceService");

const TOKEN_VALIDITE_HEURES = 24;

// ── GET /register ──────────────────────────────────────────────
router.get("/", (req, res) => {
    if (req.session?.loggedIn) {
        const metier = req.query.metier || "";
        return res.redirect(`/workspace/create${metier ? `?metier=${metier}` : ""}`);
    }

    const metier = req.query.metier || "";
    const refCode = (req.query.ref || "").trim();
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Créer un compte — SAMII</title>
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#070809">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="OG Technology">
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#0b0b0b; font-family:Arial; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:400px; background:#181818; padding:35px; border-radius:14px; border:1px solid #333; }
        h1{ text-align:center; color:#d4af37; margin-bottom:8px; font-size:1.5rem; }
        p.sub{ text-align:center; color:#888; font-size:.85rem; margin-bottom:20px; }
        input, select{ width:100%; padding:12px; margin-top:12px; border:1px solid #333; border-radius:8px; background:#111; color:white; font-size:.95rem; }
        input:focus, select:focus{ outline:none; border-color:#d4af37; }
        button{ width:100%; padding:13px; margin-top:22px; background:#d4af37; border:none; border-radius:8px; font-weight:bold; font-size:1rem; cursor:pointer; color:#000; }
        button:hover{ opacity:.9; }
        .msg{ margin-top:14px; text-align:center; font-size:.88rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
        small{ display:block; margin-top:18px; text-align:center; color:#666; font-size:.8rem; }
        a{ color:#d4af37; text-decoration:none; }
        .type-choice{ display:flex; gap:10px; margin-top:8px; }
        .type-choice label{ flex:1; display:flex; align-items:center; gap:8px; padding:12px; border:1px solid #333; border-radius:8px; cursor:pointer; font-size:.85rem; }
        .type-choice input{ width:auto; margin:0; }
        .type-label{ display:block; margin-top:14px; font-size:.78rem; color:#888; }
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
    <h1 data-i18n="register.title">👑 Créer mon compte</h1>
    <p class="sub">${metier
        ? `<span data-i18n="register.sub.metier_prefix">Pour votre activité</span> <b>${metier}</b>`
        : `<span data-i18n="register.sub.default">Rejoignez OG Technology</span>`
    }</p>
    <form id="form-register">
        <input name="nom"       placeholder="Nom"       data-i18n-ph="register.ph.nom" required>
        <input name="prenom"    placeholder="Prénom"    data-i18n-ph="register.ph.prenom" required>
        <input name="email"     type="email" placeholder="Email" data-i18n-ph="register.ph.email" required>
        <input name="telephone" placeholder="Téléphone" data-i18n-ph="register.ph.telephone" required>

        <label class="type-label" data-i18n="register.type_label">Je m'inscris en tant que :</label>
        <div class="type-choice">
            <label>
                <input type="radio" name="type_compte" value="client" checked>
                <span class="icon">👤</span><span data-i18n="register.type.client">Particulier</span>
            </label>
            <label>
                <input type="radio" name="type_compte" value="marchand">
                <span class="icon">🏪</span><span data-i18n="register.type.marchand">Marchand</span>
            </label>
            <label>
                <input type="radio" name="type_compte" value="agence">
                <span class="icon">🏢</span><span data-i18n="register.type.agence">Agence</span>
            </label>
        </div>

        <input name="password" type="password" placeholder="Mot de passe" data-i18n-ph="register.ph.password" required minlength="6">
        <input type="hidden" name="ref" value="${refCode}">
        <button type="submit" data-i18n="register.submit">Créer mon compte</button>
    </form>
    <div class="msg" id="msg"></div>
    <small><span data-i18n="register.hasaccount">Déjà un compte ?</span> <a href="/login" data-i18n="login.submit">Se connecter</a></small>
</div>
<script>
const I18N = {
    fr: {
        'register.title': '👑 Créer mon compte',
        'register.sub.metier_prefix': 'Pour votre activité', 'register.sub.default': 'Rejoignez OG Technology',
        'register.ph.nom': 'Nom', 'register.ph.prenom': 'Prénom', 'register.ph.email': 'Email', 'register.ph.telephone': 'Téléphone',
        'register.type_label': "Je m'inscris en tant que :",
        'register.type.client': 'Particulier', 'register.type.marchand': 'Marchand', 'register.type.agence': 'Agence',
        'register.metier.ecommerce': 'E-commerçant', 'register.metier.restaurant': 'Restaurateur', 'register.metier.immobilier': 'Immobilier',
        'register.metier.livreur': 'Livreur (bientôt)', 'register.metier.fournisseur': 'Fournisseur (bientôt)',
        'register.ph.password': 'Mot de passe', 'register.submit': 'Créer mon compte',
        'register.hasaccount': 'Déjà un compte ?', 'login.submit': 'Se connecter',
        'msg.creating': '⏳ Création en cours...', 'msg.created_default': '✅ Compte créé !',
        'msg.error_default': '❌ Erreur. Réessayez.',
    },
    en: {
        'register.title': '👑 Create my account',
        'register.sub.metier_prefix': 'For your business', 'register.sub.default': 'Join OG Technology',
        'register.ph.nom': 'Last name', 'register.ph.prenom': 'First name', 'register.ph.email': 'Email', 'register.ph.telephone': 'Phone',
        'register.type_label': 'I am signing up as:',
        'register.type.client': 'Individual', 'register.type.marchand': 'Merchant', 'register.type.agence': 'Agency',
        'register.metier.ecommerce': 'E-commerce seller', 'register.metier.restaurant': 'Restaurant owner', 'register.metier.immobilier': 'Real estate',
        'register.metier.livreur': 'Delivery (coming soon)', 'register.metier.fournisseur': 'Supplier (coming soon)',
        'register.ph.password': 'Password', 'register.submit': 'Create my account',
        'register.hasaccount': 'Already have an account?', 'login.submit': 'Log in',
        'msg.creating': '⏳ Creating account...', 'msg.created_default': '✅ Account created!',
        'msg.error_default': '❌ Error. Please try again.',
    },
    ar: {
        'register.title': '👑 إنشاء حسابي',
        'register.sub.metier_prefix': 'من أجل نشاطك', 'register.sub.default': 'انضم إلى OG Technology',
        'register.ph.nom': 'اللقب', 'register.ph.prenom': 'الاسم', 'register.ph.email': 'البريد الإلكتروني', 'register.ph.telephone': 'الهاتف',
        'register.type_label': 'أسجّل بصفتي:',
        'register.type.client': 'فرد', 'register.type.marchand': 'تاجر', 'register.type.agence': 'وكالة',
        'register.metier.ecommerce': 'تاجر إلكتروني', 'register.metier.restaurant': 'صاحب مطعم', 'register.metier.immobilier': 'عقارات',
        'register.metier.livreur': 'موصل (قريبًا)', 'register.metier.fournisseur': 'مورّد (قريبًا)',
        'register.ph.password': 'كلمة المرور', 'register.submit': 'إنشاء حسابي',
        'register.hasaccount': 'لديك حساب بالفعل؟', 'login.submit': 'تسجيل الدخول',
        'msg.creating': '⏳ جارٍ إنشاء الحساب...', 'msg.created_default': '✅ تم إنشاء الحساب!',
        'msg.error_default': '❌ خطأ. حاول مرة أخرى.',
    },
    zh: {
        'register.title': '👑 创建我的账号',
        'register.sub.metier_prefix': '为您的', 'register.sub.default': '加入 OG Technology',
        'register.ph.nom': '姓', 'register.ph.prenom': '名', 'register.ph.email': '电子邮箱', 'register.ph.telephone': '电话号码',
        'register.type_label': '我要以以下身份注册：',
        'register.type.client': '个人', 'register.type.marchand': '商家', 'register.type.agence': '代理机构',
        'register.metier.ecommerce': '电商卖家', 'register.metier.restaurant': '餐饮业主', 'register.metier.immobilier': '房地产',
        'register.metier.livreur': '配送员（即将推出）', 'register.metier.fournisseur': '供应商（即将推出）',
        'register.ph.password': '密码', 'register.submit': '创建我的账号',
        'register.hasaccount': '已有账号？', 'login.submit': '登录',
        'msg.creating': '⏳ 正在创建账号...', 'msg.created_default': '✅ 账号创建成功！',
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

document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = t('msg.creating');
    msg.className   = 'msg';

    const res  = await fetch('/register', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json();

    if (json.success) {
        msg.textContent = json.message || t('msg.created_default');
        msg.className   = 'msg ok';
        if (json.redirect) setTimeout(() => window.location.href = json.redirect, 1200);
    } else {
        msg.textContent = json.error || t('msg.error_default');
    }
});
</script>
</body>
</html>`);
});

// ── PAGE : compte en attente ────────────────────────────────────
router.get("/en-attente", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Confirme ton email — SAMII</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#0b0b0b; font-family:Arial; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:420px; background:#181818; padding:40px; border-radius:14px; border:1px solid #333; text-align:center; }
        .icon{ font-size:3rem; margin-bottom:16px; }
        h1{ color:#d4af37; font-size:1.3rem; margin-bottom:10px; }
        p{ color:#999; font-size:.88rem; line-height:1.6; }
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
    <div class="icon">📬</div>
    <h1 data-i18n="enattente.title">Vérifie ta boîte mail</h1>
    <p><span data-i18n="enattente.line1">On t'a envoyé un lien de confirmation. Clique dessus pour activer ton compte.</span><br><br><span data-i18n="enattente.line2_prefix">Le lien expire dans</span> ${TOKEN_VALIDITE_HEURES}h <span data-i18n="enattente.line2_suffix">— si tu ne le vois pas, regarde tes spams.</span></p>
</div>
<script>
const I18N = {
    fr: {
        'enattente.title': 'Vérifie ta boîte mail',
        'enattente.line1': "On t'a envoyé un lien de confirmation. Clique dessus pour activer ton compte.",
        'enattente.line2_prefix': 'Le lien expire dans',
        'enattente.line2_suffix': '— si tu ne le vois pas, regarde tes spams.',
    },
    en: {
        'enattente.title': 'Check your inbox',
        'enattente.line1': 'We sent you a confirmation link. Click it to activate your account.',
        'enattente.line2_prefix': 'The link expires in',
        'enattente.line2_suffix': "— if you don't see it, check your spam folder.",
    },
    ar: {
        'enattente.title': 'تحقق من بريدك الإلكتروني',
        'enattente.line1': 'أرسلنا لك رابط تأكيد. اضغط عليه لتفعيل حسابك.',
        'enattente.line2_prefix': 'تنتهي صلاحية الرابط خلال',
        'enattente.line2_suffix': '— إذا لم تجده، تحقق من مجلد الرسائل غير المرغوب فيها.',
    },
    zh: {
        'enattente.title': '请查收您的邮箱',
        'enattente.line1': '我们已向您发送确认链接，点击即可激活账号。',
        'enattente.line2_prefix': '链接将在',
        'enattente.line2_suffix': '后失效 — 如果没有看到邮件，请检查垃圾邮件文件夹。',
    },
};

let currentLang = localStorage.getItem('samii_lang') || 'fr';

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
    document.querySelectorAll('.lang-switch span').forEach(s => s.classList.toggle('active', s.dataset.lang === lang));
}

document.querySelectorAll('.lang-switch span').forEach(span => {
    span.addEventListener('click', () => applyLang(span.dataset.lang));
});

applyLang(currentLang);
</script>
</body>
</html>`);
});

// ── GET /register/confirmer?token=xxx ───────────────────────────
router.get("/confirmer", async (req, res) => {
    const { token } = req.query;
    if (!token) return res.redirect("/login?error=token_manquant");

    try {
        const rows = await db.query(
            `SELECT * FROM utilisateurs WHERE token_verification = $1`,
            [token]
        );
        const user = rows[0];
        if (!user) return res.redirect("/login?error=token_invalide");

        if (!user.token_expire_le || new Date() > new Date(user.token_expire_le)) {
            return res.redirect("/login?error=token_expire");
        }

        await db.query(
            `UPDATE utilisateurs SET email_verifie = true, token_verification = NULL, token_expire_le = NULL WHERE id = $1`,
            [user.id]
        );

        console.log(`✅ Email vérifié (PostgreSQL) : ${user.email}`);
        res.redirect("/login?verified=1");

    } catch (err) {
        console.error("❌ /register/confirmer :", err.message);
        res.redirect("/login?error=erreur_serveur");
    }
});

// ── POST /register ───────────────────────────────────────────────
router.post("/", async (req, res) => {
    const { nom, prenom, email, telephone, metier, password, type_compte, theme_visuel, ref } = req.body;
    // "agence" est un type d'inscription à part entière : l'agence entre
    // directement dans son QG Agence et crée les espaces de ses clients en
    // autonomie. Le contrôle se fait en aval (trace admin + email envoyé au
    // client concerné), pas par un verrou à l'entrée — voir routes/agence.js.
    const TYPES_VALIDES = ["client", "marchand", "agence"];
    const typeCompte = TYPES_VALIDES.includes(type_compte) ? type_compte : "client";

    // Un nouveau compte démarre toujours au grade Soldat : seuls les thèmes
    // débloqués dès le départ sont acceptés à l'inscription (pas de triche
    // possible en forçant "aventurier"/"gaming" via une requête directe).
    const themeChoisi = gradeService.themeEstDebloque(theme_visuel, "Soldat")
        ? theme_visuel
        : "strategiste";

    if (!nom || !prenom || !email || !telephone || !password) {
        return res.json({ success: false, error: "Tous les champs sont obligatoires." });
    }
    if (password.length < 6) {
        return res.json({ success: false, error: "Le mot de passe doit faire au moins 6 caractères." });
    }

    try {
        const existing = await db.query(`SELECT * FROM utilisateurs WHERE email = $1`, [email]);

        if (existing.length > 0) {
            const user = existing[0];

            // Compte déjà existant (vérifié ou non) : on ne bloque plus derrière
            // la confirmation email — si le mot de passe fourni correspond, on
            // connecte directement, comme un login classique. L'email de
            // confirmation reste utile pour la récupération de compte, mais ne
            // conditionne plus jamais l'accès (cf. inscription plus bas).
            const passwordOk = await bcrypt.compare(password, user.password_hash || "");
            if (!passwordOk) {
                return res.json({ success: false, error: "Cet email est déjà utilisé — mot de passe incorrect si c'est ton compte." });
            }

            if (!user.email_verifie) {
                await db.query(
                    `UPDATE utilisateurs SET email_verifie = true, token_verification = NULL, token_expire_le = NULL WHERE id = $1`,
                    [user.id]
                );
            }

            const typeCompteExistant = user.type_compte === "client" ? "client" : user.type_compte;
            req.session.regenerate(async (sessErr) => {
                if (sessErr) return res.json({ success: false, error: "Erreur session." });

                req.session.loggedIn   = true;
                req.session.email      = email;
                req.session.userId     = user.id;
                req.session.nom        = `${user.prenom || ""} ${user.nom || ""}`.trim();
                req.session.typeCompte = typeCompteExistant;

                if (typeCompteExistant === "client") {
                    req.session.workspaceId = null;
                    return res.json({ success: true, redirect: "/client-qg" });
                }

                const workspaces = await db.query(`SELECT * FROM workspaces WHERE owner_email = $1`, [email]);
                const workspace = workspaces[0] || null;
                req.session.workspaceId = workspace?.id || null;
                if (workspace) req.session.metier = workspace.metier;

                res.json({ success: true, redirect: workspace ? "/qg" : "/hub" });
            });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const token = crypto.randomBytes(32).toString("hex");
        const expireLe = new Date(Date.now() + TOKEN_VALIDITE_HEURES * 60 * 60 * 1000);

        const nouveauRows = await db.query(
            `INSERT INTO utilisateurs
                (nom, prenom, email, telephone, metier, type_compte, password_hash, role, statut_acces, last_login, actif, email_verifie, token_verification, token_expire_le, theme_visuel)
             VALUES
                ($1, $2, $3, $4, $5, $6, $7, 'owner', 'actif', CURRENT_DATE, true, false, $8, $9, $10)
             RETURNING id`,
            [
                nom, prenom, email, telephone,
                typeCompte === "marchand" ? (metier || "ecommerce") : "",
                typeCompte, passwordHash, token, expireLe, themeChoisi,
            ]
        );

        if (ref && nouveauRows[0]?.id) {
            await referralService.enregistrerParrainage(nouveauRows[0].id, ref.trim().toUpperCase());
        }

        const lienConfirmation = `${CONFIG.APP_URL}/register/confirmer?token=${token}`;

        // L'email de confirmation part toujours (utile pour la récupération de
        // compte), mais en tâche de fond : un souci d'envoi ne doit plus jamais
        // empêcher quelqu'un d'entrer dans l'app — l'accès est immédiat.
        gmail.send({
            to: email,
            subject: "Confirme ton compte SAMII OS",
            html: `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#C5A059;">Bienvenue chez OG Technology, ${prenom} 👑</h2>
        <p>Clique sur le bouton ci-dessous pour confirmer ton adresse email et activer ton compte.</p>
        <a href="${lienConfirmation}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;background:#C5A059;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0;font-size:16px;">
            👉 Confirmer mon email maintenant
        </a>
        <p style="color:#888;font-size:.8rem;">Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br>
        <a href="${lienConfirmation}" style="color:#5FD4FF;word-break:break-all;">${lienConfirmation}</a></p>
        <p style="color:#888;font-size:.85rem;">Ce lien expire dans ${TOKEN_VALIDITE_HEURES} heures.</p>
    </div>
`,

        }).catch((err) => console.warn("⚠️ Envoi email confirmation inscription :", err.message));

        console.log(`✅ Nouveau compte PostgreSQL (${typeCompte}) : ${email}`);

        // ── Accès immédiat, sans attendre la confirmation email ──
        // Comme les grandes plateformes : on facilite l'entrée, la vérification
        // email reste utile (récupération de compte) mais ne bloque plus rien.
        //
        // Cas particulier "QG Agence" : une agence peut avoir créé la boutique
        // AVANT que ce marchand n'ait de compte (workspaces.owner_email déjà
        // renseigné). On le détecte ici pour l'envoyer direct sur /qg plutôt
        // que de le faire passer par /hub → créer un workspace en double.
        const userId = nouveauRows[0].id;
        let workspaceExistant = null;
        if (typeCompte === "marchand") {
            const workspaces = await workspaceService.getByOwner(email);
            workspaceExistant = workspaces[0] || null;
        }

        req.session.regenerate((sessErr) => {
            if (sessErr) return res.json({ success: false, error: "Erreur session." });

            req.session.loggedIn    = true;
            req.session.email       = email;
            req.session.userId      = userId;
            req.session.nom         = `${prenom || ""} ${nom || ""}`.trim();
            req.session.typeCompte  = typeCompte;
            req.session.workspaceId = workspaceExistant?.workspaceId || null;
            if (workspaceExistant) req.session.metier = workspaceExistant.metier;

            const redirection =
                typeCompte === "agence"  ? "/agence" :
                typeCompte === "client"  ? "/client-qg" :
                workspaceExistant        ? "/qg" : "/hub";

            res.json({ success: true, message: "✅ Compte créé !", redirect: redirection });
        });

    } catch (err) {
        console.error("❌ Register (PostgreSQL) :", err.message);
        res.json({ success: false, error: "Erreur serveur. Réessayez." });
    }
});

module.exports = router;
