// ==========================================================================
// SAMII OS — CLIENT : PREMIUM — Abonnement (CCP manuel + Stripe automatique)
// ==========================================================================
const express = require("express");
const router  = express.Router();
const stripe  = require("stripe")(process.env.STRIPE_SECRET_KEY);
const CONFIG  = require("../config");
const db      = require("../services/db");
const journalService = require("../services/journalService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// ⚠️ À remplacer par tes vraies coordonnées CCP
const CCP_INFOS = {
    numero: "0000000000 00",
    cle: "00",
    titulaire: "OG TECHNOLOGY",
};

const PRIX_PREMIUM = { montant: "1500", devise: "DZD", stripeAmountCents: 500 }; // ~5$ exemple

router.get("/", requireAuth, async (req, res) => {
    let abonnementActuel = "gratuit";
    try {
        const rows = await db.query(`SELECT abonnement FROM utilisateurs WHERE id = $1`, [req.session.userId]);
        abonnementActuel = rows[0]?.abonnement || "gratuit";
    } catch (err) {
        console.warn("⚠️ Lecture abonnement :", err.message);
    }

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>SAMII Premium</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/client-style.css">
    <style>
        .pr-shell { max-width: 680px; margin: 0 auto; padding: 40px 24px 80px; }
        .pr-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; gap: 12px; flex-wrap: wrap; }
        .pr-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; }
        .lang-switch { display: flex; gap: 2px; font-family: var(--font-mono); font-size: .64rem; padding: 3px; border: var(--border-soft); border-radius: 9px; background: var(--bg-glass); }
        .lang-switch span { padding: 5px 7px; border-radius: 6px; cursor: pointer; color: var(--text-muted); transition: .2s ease; }
        .lang-switch span.active, .lang-switch span:hover { color: var(--violet-hover); background: rgba(157,92,255,0.15); }
        html[dir="rtl"] .pr-topbar { flex-direction: row-reverse; }
        .pr-hero { text-align: center; margin-bottom: 30px; }
        .pr-hero-icon { font-size: 3rem; margin-bottom: 10px; }
        .pr-hero h1 { font-family: var(--font-display); color: #fff; font-size: 1.7rem; }
        .pr-hero p { color: var(--text-muted); font-size: .9rem; margin-top: 10px; }

        .pr-features { display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px; }
        .pr-feature { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: var(--bg-glass); border: var(--border-soft); border-radius: 12px; }
        .pr-feature .check { color: #3ddc84; }
        .pr-feature span { color: var(--text-main); font-size: .88rem; }

        .pr-status {
            text-align: center; padding: 20px; margin-bottom: 24px; border-radius: 14px;
            background: rgba(61,220,132,0.08); border: 1px solid rgba(61,220,132,0.3); color: #3ddc84; font-weight: 700;
        }

        .pr-options { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .pr-option {
            background: var(--bg-panel); border: 1px solid rgba(157,92,255,0.25); border-radius: 16px; padding: 22px;
            display: flex; flex-direction: column; gap: 10px; text-align: center;
        }
        .pr-option h3 { color: #fff; font-size: 1rem; }
        .pr-option p { color: var(--text-muted); font-size: .78rem; }
        .pr-btn {
            padding: 12px; border-radius: 10px; border: none; font-weight: 700; cursor: pointer; font-size: .88rem;
        }
        .pr-btn--ccp { background: rgba(157,92,255,0.15); color: #b47fff; border: 1px solid rgba(157,92,255,0.4); }
        .pr-btn--stripe { background: linear-gradient(135deg, #9d5cff, #b47fff); color: #fff; }

        .pr-ccp-details { display: none; margin-top: 20px; padding: 20px; background: var(--bg-glass); border-radius: 14px; border: var(--border-soft); }
        .pr-ccp-details.open { display: block; }
        .pr-ccp-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: .85rem; }
        .pr-ccp-row span:first-child { color: var(--text-muted); }
        .pr-ccp-row span:last-child { color: #fff; font-family: var(--font-mono); }
        .pr-ccp-form textarea { width: 100%; margin-top: 14px; padding: 11px 13px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: #fff; font-size: .85rem; min-height: 60px; }
        .pr-msg { text-align: center; margin-top: 12px; font-size: .82rem; color: #e55; min-height: 18px; }
        .pr-msg.ok { color: #3ddc84; }
    </style>
</head>
<body>
<div class="pr-shell">
    <div class="pr-topbar">
        <a href="/client-qg" class="pr-back" data-i18n="premium.back">← Retour à mon espace</a>
        <div class="lang-switch">
            <span data-lang="fr" class="active">FR</span>
            <span data-lang="en">EN</span>
            <span data-lang="ar">AR</span>
            <span data-lang="zh">中</span>
        </div>
    </div>

    <div class="pr-hero">
        <div class="pr-hero-icon">👑</div>
        <h1 data-i18n="premium.title">SAMII Premium</h1>
        <p data-i18n="premium.subtitle">Débloque tout le potentiel de SAMII, sans limite.</p>
    </div>

    ${abonnementActuel === "premium" ? `
    <div class="pr-status" data-i18n="premium.status">✅ Tu es déjà Premium — profite de tout SAMII sans limite !</div>
    ` : `
    <div class="pr-features">
        <div class="pr-feature"><span class="check">✓</span><span data-i18n="premium.feature1">Messages SAMII illimités, chaque jour</span></div>
        <div class="pr-feature"><span class="check">✓</span><span data-i18n="premium.feature2">SAMII gère tes réseaux sociaux et répond à ta place</span></div>
        <div class="pr-feature"><span class="check">✓</span><span data-i18n="premium.feature3">Accès prioritaire aux nouvelles fonctionnalités</span></div>
        <div class="pr-feature"><span class="check">✓</span><span data-i18n="premium.feature4">Badge Premium visible sur ton profil</span></div>
    </div>

    <div class="pr-options">
        <div class="pr-option">
            <h3 data-i18n="premium.option.stripe.title">💳 Carte bancaire</h3>
            <p data-i18n="premium.option.stripe.desc">Paiement instantané, activation immédiate</p>
            <button class="pr-btn pr-btn--stripe" id="btn-stripe" data-i18n="premium.option.stripe.btn">Payer avec Stripe</button>
        </div>
        <div class="pr-option">
            <h3 data-i18n="premium.option.ccp.title">🏦 CCP</h3>
            <p data-i18n="premium.option.ccp.desc">Virement manuel, validation sous 24h</p>
            <button class="pr-btn pr-btn--ccp" id="btn-ccp" data-i18n="premium.option.ccp.btn">Payer par CCP</button>
        </div>
    </div>

    <div class="pr-ccp-details" id="ccp-details">
        <div class="pr-ccp-row"><span data-i18n="premium.ccp.numero">Numéro CCP</span><span>${CCP_INFOS.numero}</span></div>
        <div class="pr-ccp-row"><span data-i18n="premium.ccp.cle">Clé</span><span>${CCP_INFOS.cle}</span></div>
        <div class="pr-ccp-row"><span data-i18n="premium.ccp.titulaire">Titulaire</span><span>${CCP_INFOS.titulaire}</span></div>
        <div class="pr-ccp-row"><span data-i18n="premium.ccp.montant">Montant</span><span>${PRIX_PREMIUM.montant} ${PRIX_PREMIUM.devise}</span></div>

        <form class="pr-ccp-form" id="form-ccp">
            <label style="display:block;color:var(--text-muted);font-size:.75rem;margin-top:14px;" data-i18n="premium.ccp.form.label">Référence du virement / preuve (optionnel)</label>
            <textarea name="preuve" placeholder="Ex : numéro de transaction, ou toute info utile pour identifier ton virement" data-i18n-ph="premium.ccp.form.ph"></textarea>
            <button type="submit" class="pr-btn pr-btn--ccp" style="width:100%;margin-top:10px;" data-i18n="premium.ccp.form.submit">J'ai effectué le virement</button>
        </form>
        <div class="pr-msg" id="msg-ccp"></div>
    </div>
    `}
</div>

<script>
const I18N = {
    fr: {
        'premium.back': '← Retour à mon espace',
        'premium.title': 'SAMII Premium',
        'premium.subtitle': 'Débloque tout le potentiel de SAMII, sans limite.',
        'premium.status': '✅ Tu es déjà Premium — profite de tout SAMII sans limite !',
        'premium.feature1': 'Messages SAMII illimités, chaque jour',
        'premium.feature2': 'SAMII gère tes réseaux sociaux et répond à ta place',
        'premium.feature3': 'Accès prioritaire aux nouvelles fonctionnalités',
        'premium.feature4': 'Badge Premium visible sur ton profil',
        'premium.option.stripe.title': '💳 Carte bancaire',
        'premium.option.stripe.desc': 'Paiement instantané, activation immédiate',
        'premium.option.stripe.btn': 'Payer avec Stripe',
        'premium.option.ccp.title': '🏦 CCP',
        'premium.option.ccp.desc': 'Virement manuel, validation sous 24h',
        'premium.option.ccp.btn': 'Payer par CCP',
        'premium.ccp.numero': 'Numéro CCP', 'premium.ccp.cle': 'Clé',
        'premium.ccp.titulaire': 'Titulaire', 'premium.ccp.montant': 'Montant',
        'premium.ccp.form.label': 'Référence du virement / preuve (optionnel)',
        'premium.ccp.form.ph': 'Ex : numéro de transaction, ou toute info utile pour identifier ton virement',
        'premium.ccp.form.submit': "J'ai effectué le virement",
        'premium.msg.sending': '⏳ Envoi...',
        'premium.msg.success': '✅ Reçu ! On valide ton paiement sous 24h.',
        'premium.msg.error': '❌ Erreur.',
    },
    en: {
        'premium.back': '← Back to my space',
        'premium.title': 'SAMII Premium',
        'premium.subtitle': "Unlock SAMII's full potential, without limits.",
        'premium.status': "✅ You're already Premium — enjoy unlimited SAMII!",
        'premium.feature1': 'Unlimited SAMII messages, every day',
        'premium.feature2': 'SAMII manages your social media and replies for you',
        'premium.feature3': 'Priority access to new features',
        'premium.feature4': 'Premium badge visible on your profile',
        'premium.option.stripe.title': '💳 Credit card',
        'premium.option.stripe.desc': 'Instant payment, immediate activation',
        'premium.option.stripe.btn': 'Pay with Stripe',
        'premium.option.ccp.title': '🏦 CCP',
        'premium.option.ccp.desc': 'Manual transfer, validated within 24h',
        'premium.option.ccp.btn': 'Pay by CCP',
        'premium.ccp.numero': 'CCP number', 'premium.ccp.cle': 'Key',
        'premium.ccp.titulaire': 'Account holder', 'premium.ccp.montant': 'Amount',
        'premium.ccp.form.label': 'Transfer reference / proof (optional)',
        'premium.ccp.form.ph': 'E.g.: transaction number, or any info that helps identify your transfer',
        'premium.ccp.form.submit': "I've made the transfer",
        'premium.msg.sending': '⏳ Sending...',
        'premium.msg.success': "✅ Received! We'll confirm your payment within 24h.",
        'premium.msg.error': '❌ Error.',
    },
    ar: {
        'premium.back': '← العودة إلى مساحتي',
        'premium.title': 'SAMII Premium',
        'premium.subtitle': 'أطلق العنان لكامل إمكانيات SAMII، بلا حدود.',
        'premium.status': '✅ أنت بالفعل مشترك Premium — استمتع بـ SAMII بلا حدود!',
        'premium.feature1': 'رسائل SAMII غير محدودة، كل يوم',
        'premium.feature2': 'SAMII يدير حساباتك على وسائل التواصل ويرد نيابة عنك',
        'premium.feature3': 'وصول ذو أولوية للميزات الجديدة',
        'premium.feature4': 'شارة Premium ظاهرة على ملفك الشخصي',
        'premium.option.stripe.title': '💳 بطاقة بنكية',
        'premium.option.stripe.desc': 'دفع فوري، تفعيل مباشر',
        'premium.option.stripe.btn': 'الدفع عبر Stripe',
        'premium.option.ccp.title': '🏦 CCP',
        'premium.option.ccp.desc': 'تحويل يدوي، التحقق خلال 24 ساعة',
        'premium.option.ccp.btn': 'الدفع عبر CCP',
        'premium.ccp.numero': 'رقم CCP', 'premium.ccp.cle': 'المفتاح',
        'premium.ccp.titulaire': 'صاحب الحساب', 'premium.ccp.montant': 'المبلغ',
        'premium.ccp.form.label': 'مرجع التحويل / إثبات (اختياري)',
        'premium.ccp.form.ph': 'مثال: رقم المعاملة، أو أي معلومة تساعد على تحديد تحويلك',
        'premium.ccp.form.submit': 'لقد قمت بالتحويل',
        'premium.msg.sending': '⏳ جارٍ الإرسال...',
        'premium.msg.success': '✅ تم الاستلام! سنؤكد دفعتك خلال 24 ساعة.',
        'premium.msg.error': '❌ خطأ.',
    },
    zh: {
        'premium.back': '← 返回我的空间',
        'premium.title': 'SAMII Premium',
        'premium.subtitle': '解锁 SAMII 的全部潜力，畅享无限制体验。',
        'premium.status': '✅ 你已经是 Premium 会员 —— 尽享无限制的 SAMII！',
        'premium.feature1': '每天无限的 SAMII 消息',
        'premium.feature2': 'SAMII 帮你管理社交媒体并代为回复',
        'premium.feature3': '新功能优先体验',
        'premium.feature4': '个人主页显示 Premium 徽章',
        'premium.option.stripe.title': '💳 银行卡',
        'premium.option.stripe.desc': '即时付款，立即激活',
        'premium.option.stripe.btn': '使用 Stripe 支付',
        'premium.option.ccp.title': '🏦 CCP',
        'premium.option.ccp.desc': '人工转账，24小时内完成验证',
        'premium.option.ccp.btn': '通过 CCP 支付',
        'premium.ccp.numero': 'CCP 账号', 'premium.ccp.cle': '密钥',
        'premium.ccp.titulaire': '账户持有人', 'premium.ccp.montant': '金额',
        'premium.ccp.form.label': '转账参考 / 凭证（可选）',
        'premium.ccp.form.ph': '例如：交易编号，或任何有助于识别你转账的信息',
        'premium.ccp.form.submit': '我已完成转账',
        'premium.msg.sending': '⏳ 发送中...',
        'premium.msg.success': '✅ 已收到！我们将在24小时内确认你的付款。',
        'premium.msg.error': '❌ 出错了。',
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

document.getElementById('btn-ccp')?.addEventListener('click', () => {
    document.getElementById('ccp-details').classList.toggle('open');
});

document.getElementById('btn-stripe')?.addEventListener('click', async () => {
    const res = await fetch('/client-qg/premium/stripe-checkout', { method: 'POST' });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
});

document.getElementById('form-ccp')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg-ccp');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = t('premium.msg.sending');
    msg.className = 'pr-msg';

    const res  = await fetch('/client-qg/premium/ccp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) {
        msg.textContent = t('premium.msg.success');
        msg.className = 'pr-msg ok';
    } else {
        msg.textContent = json.error || t('premium.msg.error');
    }
});
</script>
</body>
</html>`);
});

router.post("/ccp", requireAuth, async (req, res) => {
    try {
        const { preuve } = req.body;
        const userId = req.session.userId;

        const updated = await db.query(
            `UPDATE utilisateurs SET statut_paiement_ccp = 'en_attente', preuve_paiement_ccp = $1 WHERE id = $2 RETURNING id`,
            [preuve || "Pas de preuve fournie", userId]
        );
        if (!updated[0]) return res.json({ success: false, error: "Utilisateur introuvable." });

        // Pas de file d'attente admin dédiée pour ce palier individuel (contrairement
        // aux abonnements marchand — voir routes/admin.js) : au minimum, la demande
        // reste visible dans le journal plutôt que de s'évaporer silencieusement.
        await journalService.log({ action: "premium.ccp.demande", details: `Demande CCP Premium — utilisateur ${userId} — preuve: ${preuve || "aucune"}` });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /client-qg/premium/ccp :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

router.post("/stripe-checkout", requireAuth, async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{
                price_data: {
                    currency: "usd",
                    product_data: { name: "SAMII Premium — Abonnement mensuel" },
                    unit_amount: PRIX_PREMIUM.stripeAmountCents,
                    recurring: { interval: "month" },
                },
                quantity: 1,
            }],
            mode: "subscription",
            success_url: `${CONFIG.APP_URL}/client-qg/premium?success=1`,
            cancel_url: `${CONFIG.APP_URL}/client-qg/premium`,
            customer_email: req.session.email,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("❌ Stripe checkout :", err.message);
        res.json({ success: false, error: "Erreur Stripe." });
    }
});

module.exports = router;
