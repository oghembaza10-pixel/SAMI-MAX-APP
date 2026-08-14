// ==========================================================================
// SAMII OS — ABONNEMENTS (Stripe Checkout + Webhooks)
// ==========================================================================
// Variables d'environnement nécessaires :
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//   STRIPE_PRICE_STANDARD, STRIPE_PRICE_PRO
// ==========================================================================

const express = require("express");
const router   = express.Router();
const workspaceService = require("../services/workspaceService");
const db = require("../services/db");
const referralService = require("../services/referralService");
const abonnementService = require("../services/abonnementService");
const devises = require("../services/devises");
const chargily = require("../services/chargily");
const confirmationsQuota = require("../services/confirmationsQuota");
const { confirmChargilyAbonnement } = require("../services/orders");
const CONFIG = require("../config");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// Compte CCP officiel SAMII — paiement manuel en attendant Stripe.
const CCP_SAMII = { titulaire: "GHEMBAZA OUAHID", numero: "0044766935", cle: "72" };

let stripe = null;
try {
    stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
} catch {
    console.warn("⚠️ Module 'stripe' non installé — lance `npm install stripe` sur ton projet.");
}

const COUPON_FILLEUL_ID = "samii-filleul-5pct-12m";

// Coupon partagé -5%/12 mois pour les filleuls : créé une seule fois chez Stripe, réutilisé ensuite.
async function assurerCouponFilleul() {
    try {
        await stripe.coupons.retrieve(COUPON_FILLEUL_ID);
        return COUPON_FILLEUL_ID;
    } catch {
        await stripe.coupons.create({
            id: COUPON_FILLEUL_ID,
            percent_off: referralService.TAUX_REDUCTION_FILLEUL * 100,
            duration: "repeating",
            duration_in_months: referralService.FENETRE_MOIS,
        });
        return COUPON_FILLEUL_ID;
    }
}

const PRIX_AFFICHE = { standard: 9.99, pro: 39.99 };

const gmail = require("../services/gmail");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "ghembazao@gmail.com";

// Nombre de cartes (config/cartes-catalog.js) débloquées d'office à chaque palier —
// affiché sur cette page pour que le choix d'un palier soit concret, pas juste marketing.
const { CARTES } = require("../config/cartes-catalog");
const NB_CARTES_PAR_PALIER = {
    free: CARTES.filter(c => c.palier === "free").length,
    standard: CARTES.filter(c => ["free", "standard"].includes(c.palier)).length,
    pro: CARTES.filter(c => ["free", "standard", "pro"].includes(c.palier)).length,
    societe: CARTES.length,
};

router.get("/", requireAuth, async (req, res) => {
    const stripeReady = !!stripe;
    const { reduit } = await referralService.appliquerReductionFilleul(req.session.userId, 1);
    const workspace = await workspaceService.getById(req.session.workspaceId);
    const devise = devises.deviseAffichage(workspace?.devise);
    const estAlgerie = devise === "DZD";

    // Dépassement confirmations en attente (services/confirmationsQuota.js) —
    // sur un palier payant, ajouté automatiquement au prochain renouvellement
    // (engines/abonnementEngine.js) ; sur le gratuit, aucun cycle de
    // renouvellement auquel l'accrocher, donc un lien de paiement à part.
    const depassementConfirm = await confirmationsQuota.getDepassementMois(req.session.workspaceId);
    const regularisationHtml = depassementConfirm.montantDu ? `
    <div class="callout-regularisation">
        ⚠️ ${depassementConfirm.count} confirmation(s) au-delà de ton quota gratuit ce mois-ci
        (${devises.formater(devises.depuisUSD(depassementConfirm.montantDu, devise), devise)}).
        <button class="bill-btn bill-btn--regulariser" id="regulariser-confirm">Régulariser →</button>
    </div>` : "";
    const dailyNote = (plan) => `<p class="bill-daily-note">≈ ${confirmationsQuota.QUOTA_PAR_PALIER[plan]}/jour</p>`;

    // Prix affiché toujours converti depuis le prix de référence en USD, dans
    // la devise du marchand (marché parallèle pour le DZD, marché réel pour
    // MAD/TND — voir CONFIG.DEVISES).
    const prixHtml = (plan) => {
        const base = PRIX_AFFICHE[plan];
        const baseLocal = devises.formater(devises.depuisUSD(base, devise), devise);
        if (!reduit) return `${baseLocal} <span data-i18n="billing.permonth">/mois</span>`;
        const remise = Math.round(base * (1 - referralService.TAUX_REDUCTION_FILLEUL) * 100) / 100;
        const remiseLocal = devises.formater(devises.depuisUSD(remise, devise), devise);
        return `<s style="opacity:.5;font-size:.6em;">${baseLocal}</s> ${remiseLocal} <span data-i18n="billing.permonth_filleul">/mois — filleul -5%</span>`;
    };
    // CCP = virement postal algérien, n'a de sens que pour un marchand en Algérie.
    const ccpBlock = (plan) => !estAlgerie ? "" : `
            <div class="bill-ccp">
                <div class="bill-ccp-label" data-i18n="billing.ccp.label">🏦 Payer par CCP</div>
                <div class="bill-ccp-details">
                    <span data-i18n="billing.ccp.titulaire">Titulaire :</span> <b>${CCP_SAMII.titulaire}</b><br>
                    <span data-i18n="billing.ccp.numero">Numéro CCP :</span> <b>${CCP_SAMII.numero}</b><br>
                    <span data-i18n="billing.ccp.cle">Clé RIP :</span> <b>${CCP_SAMII.cle}</b><br>
                    <span data-i18n="billing.ccp.montant">Montant à virer :</span> <b>${devises.formater(devises.depuisUSD(PRIX_AFFICHE[plan], "DZD"), "DZD")}</b>
                </div>
                <button class="bill-btn bill-btn--ccp" data-plan-ccp="${plan}" data-i18n="billing.ccp.btn">J'ai payé, préviens l'équipe</button>
            </div>`;
    // Chargily (Edahabia/CIB) : seul moyen de paiement carte qui marche vraiment
    // en Algérie. Pas de prélèvement récurrent possible côté Chargily — chaque
    // renouvellement est un nouveau paiement, relancé par lien (engines/abonnementEngine.js).
    const chargilyBlock = (plan) => (!estAlgerie || !chargily.isEnabled()) ? "" : `
            <button class="bill-btn bill-btn--chargily" data-plan-chargily="${plan}">💳 Payer par Edahabia/CIB (Chargily) →</button>`;
    const stripeBlock = (plan) => stripeReady
        ? `<button class="bill-btn bill-btn--stripe" data-plan="${plan}" data-i18n="billing.stripe.btn">Payer par carte →</button>`
        : "";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Abonnement — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .bill-shell { max-width: 960px; margin: 0 auto; padding: 40px 24px 80px; }
        .bill-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.8rem; text-align: center; margin-bottom: 8px; }
        .bill-shell p.sub { color: var(--text-muted); text-align: center; font-size: .9rem; margin-bottom: 34px; }
        .bill-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
        .bill-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 18px; padding: 26px; display: flex; flex-direction: column; }
        .bill-card--pro { border-color: rgba(197,160,89,0.5); box-shadow: 0 0 30px rgba(197,160,89,0.12); }
        .bill-card--societe { border-color: rgba(93,156,236,0.4); }
        .bill-card h2 { color: #fff; font-size: 1.1rem; }
        .bill-price { font-family: var(--font-display); font-size: 1.8rem; color: var(--gold-og); margin: 12px 0; }
        .bill-price span { font-size: .85rem; color: var(--text-muted); }
        .bill-card ul { list-style: none; margin: 14px 0 20px; flex: 1; }
        .bill-card li { color: var(--text-muted); font-size: .85rem; padding: 5px 0; }
        .bill-card li::before { content: "✓ "; color: var(--cyan-tech); }
        .bill-btn { padding: 12px; border-radius: 10px; border: none; background: var(--gold-og); color: #000; font-weight: 700; cursor: pointer; }
        .bill-btn--free { background: rgba(255,255,255,0.08); color: var(--text-main); }
        .bill-daily-note { text-align: center; font-size: .68rem; color: var(--text-muted); opacity: .7; margin: 8px 0 0; }
        .callout-regularisation { max-width: 640px; margin: 0 auto 24px; padding: 14px 18px; border-radius: 12px; background: rgba(229,85,85,0.1); border: 1px solid rgba(229,85,85,0.3); color: #e55; font-size: .82rem; text-align: center; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; }
        .bill-btn--regulariser { padding: 8px 14px; font-size: .78rem; background: #e55; color: #fff; }
        .bill-ccp { margin-top: auto; padding: 14px; border-radius: 12px; background: rgba(245,166,35,0.1); border: 1px solid rgba(245,166,35,0.3); }
        .bill-ccp-label { color: #F5A623; font-size: .8rem; font-weight: 700; margin-bottom: 8px; }
        .bill-ccp-details { font-size: .78rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 10px; }
        .bill-ccp-details b { color: #fff; }
        .bill-btn--ccp { width: 100%; background: #F5A623; color: #000; }
        .bill-btn--stripe { width: 100%; margin-top: 8px; background: rgba(255,255,255,0.08); color: var(--text-main); }
        .bill-btn--chargily { width: 100%; margin-top: 8px; background: #2e7d32; color: #fff; }
        .bill-topbar { display: flex; justify-content: flex-end; margin-bottom: 16px; }
        .lang-switch { display: flex; gap: 2px; font-family: var(--font-mono); font-size: .64rem; padding: 3px; border: var(--border-soft); border-radius: 9px; background: var(--bg-glass); }
        .lang-switch span { padding: 5px 7px; border-radius: 6px; cursor: pointer; color: var(--text-muted); transition: .2s ease; }
        .lang-switch span.active, .lang-switch span:hover { color: var(--gold-og); background: rgba(197,160,89,0.12); }
        html[dir="rtl"] .bill-topbar { justify-content: flex-start; }
    </style>
</head>
<body data-theme="og">
<div class="bill-shell">
    <div class="bill-topbar">
        <div class="lang-switch">
            <span data-lang="fr" class="active">FR</span>
            <span data-lang="en">EN</span>
            <span data-lang="ar">AR</span>
            <span data-lang="zh">中</span>
        </div>
    </div>
    <h1 data-i18n="billing.title">👑 Choisis ton palier</h1>
    <p class="sub" data-i18n="billing.subtitle">Plus tu fais confiance à SAMII, plus il peut agir seul pour toi.</p>
    ${regularisationHtml}
    <div class="bill-grid">
        <div class="bill-card">
            <h2 data-i18n="billing.free.title">🌑 Découverte</h2>
            <div class="bill-price" data-i18n="billing.free.price">Gratuit</div>
            <ul>
                <li data-i18n="billing.free.li1">150 confirmations & suivi / mois</li>
                <li data-i18n="billing.free.li2">Mode Ombre + Copilote (SAMII propose, tu valides)</li>
                <li data-i18n="billing.free.li3">30 messages SAMII toutes les 7h</li>
                <li data-i18n="billing.free.li4">Suivi de colis basique</li>
                <li>🃏 ${NB_CARTES_PAR_PALIER.free} cartes débloquées</li>
            </ul>
            <button class="bill-btn bill-btn--free" disabled data-i18n="billing.free.btn">Plan actuel</button>
            ${dailyNote("free")}
        </div>
        <div class="bill-card">
            <h2 data-i18n="billing.standard.title">🚀 Actif</h2>
            <div class="bill-price">${prixHtml("standard")}</div>
            <ul>
                <li data-i18n="billing.standard.li1">2 100 confirmations & suivi / mois (+0,12 $ au-delà)</li>
                <li data-i18n="billing.standard.li2">WhatsApp + Telegram + Shopify connectés</li>
                <li data-i18n="billing.standard.li3">Client fidèle (VIP) + liste noire automatiques</li>
                <li data-i18n="billing.standard.li4">Pubs Meta illimitées, créées par SAMII</li>
                <li data-i18n="billing.standard.li5">1 Forteresse offerte chaque mois</li>
                <li data-i18n="billing.standard.li6">50 messages SAMII toutes les 7h (+0,50 $/message au-delà)</li>
                <li>🃏 ${NB_CARTES_PAR_PALIER.standard} cartes débloquées</li>
            </ul>
            ${chargilyBlock("standard")}
            ${ccpBlock("standard")}
            ${stripeBlock("standard")}
            ${dailyNote("standard")}
        </div>
        <div class="bill-card bill-card--pro">
            <h2 data-i18n="billing.pro.title">👑 Souverain</h2>
            <div class="bill-price">${prixHtml("pro")}</div>
            <ul>
                <li data-i18n="billing.pro.li1">30 000 confirmations & suivi / mois (+0,12 $ au-delà)</li>
                <li data-i18n="billing.pro.li2">Tout le plan Actif, en plus généreux</li>
                <li data-i18n="billing.pro.li3">Modes Autonome + Souverain (SAMII lance directement tes pubs déjà prêtes, sans attendre ta validation)</li>
                <li data-i18n="billing.pro.li4">2 Forteresse + 1 Boost offerts chaque mois</li>
                <li data-i18n="billing.pro.li5">Support prioritaire</li>
                <li data-i18n="billing.pro.li6">150 messages SAMII toutes les 7h (+0,50 $/message au-delà)</li>
                <li>🃏 ${NB_CARTES_PAR_PALIER.pro} cartes débloquées</li>
            </ul>
            ${chargilyBlock("pro")}
            ${ccpBlock("pro")}
            ${stripeBlock("pro")}
            ${dailyNote("pro")}
        </div>
        <div class="bill-card bill-card--societe">
            <h2>🏛️ Société</h2>
            <div class="bill-price">Sur devis</div>
            <ul>
                <li>Toutes les cartes débloquées (${NB_CARTES_PAR_PALIER.societe}/${NB_CARTES_PAR_PALIER.societe})</li>
                <li>Multi-comptes, multi-boutiques</li>
                <li>Contrat et facturation dédiés</li>
                <li>Accompagnement personnalisé</li>
            </ul>
            <form id="societe-form" style="margin-top:auto;display:flex;flex-direction:column;gap:8px;">
                <input type="email" name="email" placeholder="Ton email" required style="padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:#fff;font-size:.82rem;">
                <textarea name="message" placeholder="Décris ton besoin (nombre de boutiques, volume...)" rows="2" style="padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:#fff;font-size:.82rem;resize:vertical;"></textarea>
                <button type="submit" class="bill-btn" style="background:rgba(255,255,255,0.08);color:var(--text-main);">Nous contacter</button>
                <div id="societe-msg" style="font-size:.78rem;color:var(--text-muted);min-height:16px;"></div>
            </form>
        </div>
    </div>
    <p class="sub" style="margin-top:24px;"><a href="/cartes" style="color:var(--gold-og);">🃏 Voir le détail des cartes débloquées à chaque palier →</a></p>

</div>
<script>
const I18N = {
    fr: {
        'billing.title': '👑 Choisis ton palier',
        'billing.subtitle': 'Plus tu fais confiance à SAMII, plus il peut agir seul pour toi.',
        'billing.free.title': '🌑 Découverte', 'billing.free.price': 'Gratuit',
        'billing.free.li1': '100 confirmations & suivi / mois',
        'billing.free.li2': 'Mode Ombre + Copilote (SAMII propose, tu valides)',
        'billing.free.li3': '30 messages SAMII toutes les 7h',
        'billing.free.li4': 'Suivi de colis basique',
        'billing.free.btn': 'Plan actuel',
        'billing.standard.title': '🚀 Actif',
        'billing.standard.li1': '1 000 confirmations & suivi / mois (+0,12 $ au-delà)',
        'billing.standard.li2': 'WhatsApp + Telegram + Shopify connectés',
        'billing.standard.li3': 'Client fidèle (VIP) + liste noire automatiques',
        'billing.standard.li4': 'Pubs Meta illimitées, créées par SAMII',
        'billing.standard.li5': '1 Forteresse offerte chaque mois',
        'billing.standard.li6': '50 messages SAMII toutes les 7h (+0,50 $/message au-delà)',
        'billing.pro.title': '👑 Souverain',
        'billing.pro.li1': '10 000 confirmations & suivi / mois (+0,12 $ au-delà)',
        'billing.pro.li2': 'Tout le plan Actif, en plus généreux',
        'billing.pro.li3': 'Modes Autonome + Souverain (SAMII lance directement tes pubs déjà prêtes, sans attendre ta validation)',
        'billing.pro.li4': '2 Forteresse + 1 Boost offerts chaque mois',
        'billing.pro.li5': 'Support prioritaire',
        'billing.pro.li6': '150 messages SAMII toutes les 7h (+0,50 $/message au-delà)',
        'billing.permonth': '/mois', 'billing.permonth_filleul': '/mois — filleul -5%',
        'billing.ccp.label': '🏦 Payer par CCP',
        'billing.ccp.titulaire': 'Titulaire :', 'billing.ccp.numero': 'Numéro CCP :', 'billing.ccp.cle': 'Clé RIP :',
        'billing.ccp.btn': "J'ai payé, préviens l'équipe",
        'billing.stripe.btn': 'Payer par carte →',
        'billing.msg.redirecting': 'Redirection...',
        'billing.msg.error_generic': 'Erreur, réessaye.',
        'billing.msg.subscribe': "S'abonner",
        'billing.msg.sending': 'Envoi...',
        'billing.msg.ccp_success': '✅ Équipe prévenue, activation sous 24h',
    },
    en: {
        'billing.title': '👑 Choose your tier',
        'billing.subtitle': 'The more you trust SAMII, the more it can act on its own for you.',
        'billing.free.title': '🌑 Discovery', 'billing.free.price': 'Free',
        'billing.free.li1': '100 confirmations & tracking / month',
        'billing.free.li2': 'Shadow Mode + Copilot (SAMII suggests, you approve)',
        'billing.free.li3': '30 SAMII messages every 7h',
        'billing.free.li4': 'Basic package tracking',
        'billing.free.btn': 'Current plan',
        'billing.standard.title': '🚀 Active',
        'billing.standard.li1': '1,000 confirmations & tracking / month (+$0.12 beyond)',
        'billing.standard.li2': 'WhatsApp + Telegram + Shopify connected',
        'billing.standard.li3': 'Automatic VIP client + blacklist detection',
        'billing.standard.li4': 'Unlimited Meta ads, created by SAMII',
        'billing.standard.li5': '1 Fortress granted every month',
        'billing.standard.li6': '50 SAMII messages every 7h (+$0.50/message beyond)',
        'billing.pro.title': '👑 Sovereign',
        'billing.pro.li1': '10,000 confirmations & tracking / month (+$0.12 beyond)',
        'billing.pro.li2': 'Everything in the Active plan, more generous',
        'billing.pro.li3': 'Autonomous + Sovereign Modes (SAMII launches your ready ads instantly, no validation wait)',
        'billing.pro.li4': '2 Fortresses + 1 Boost granted every month',
        'billing.pro.li5': 'Priority support',
        'billing.pro.li6': '150 SAMII messages every 7h (+$0.50/message beyond)',
        'billing.permonth': '/month', 'billing.permonth_filleul': '/month — referral -5%',
        'billing.ccp.label': '🏦 Pay by CCP',
        'billing.ccp.titulaire': 'Account holder:', 'billing.ccp.numero': 'CCP number:', 'billing.ccp.cle': 'RIP key:',
        'billing.ccp.btn': "I've paid, notify the team",
        'billing.stripe.btn': 'Pay by card →',
        'billing.msg.redirecting': 'Redirecting...',
        'billing.msg.error_generic': 'Error, try again.',
        'billing.msg.subscribe': 'Subscribe',
        'billing.msg.sending': 'Sending...',
        'billing.msg.ccp_success': '✅ Team notified, activation within 24h',
    },
    ar: {
        'billing.title': '👑 اختر باقتك',
        'billing.subtitle': 'كلما زادت ثقتك بـ SAMII، زادت قدرته على التصرف بمفرده من أجلك.',
        'billing.free.title': '🌑 الاكتشاف', 'billing.free.price': 'مجاني',
        'billing.free.li1': '100 تأكيد وتتبع / شهريًا',
        'billing.free.li2': 'وضع الظل + المساعد (SAMII يقترح، أنت توافق)',
        'billing.free.li3': '30 رسالة SAMII كل 7 ساعات',
        'billing.free.li4': 'تتبع أساسي للطرود',
        'billing.free.btn': 'الباقة الحالية',
        'billing.standard.title': '🚀 نشط',
        'billing.standard.li1': '1000 تأكيد وتتبع / شهريًا (+0.12$ لكل تأكيد إضافي)',
        'billing.standard.li2': 'ربط WhatsApp + Telegram + Shopify',
        'billing.standard.li3': 'عميل مخلص (VIP) + قائمة سوداء تلقائية',
        'billing.standard.li4': 'إعلانات Meta غير محدودة، ينشئها SAMII',
        'billing.standard.li5': 'حصن واحد مجانًا كل شهر',
        'billing.standard.li6': '50 رسالة SAMII كل 7 ساعات (+0.50$ لكل رسالة إضافية)',
        'billing.pro.title': '👑 سيادي',
        'billing.pro.li1': '10000 تأكيد وتتبع / شهريًا (+0.12$ لكل تأكيد إضافي)',
        'billing.pro.li2': 'كل مزايا باقة نشط، بسخاء أكبر',
        'billing.pro.li3': 'وضعا مستقل + سيادي (SAMII يُطلق إعلاناتك الجاهزة فورًا، دون انتظار موافقتك)',
        'billing.pro.li4': 'حصنان + تعزيز واحد مجانًا كل شهر',
        'billing.pro.li5': 'دعم ذو أولوية',
        'billing.pro.li6': '150 رسالة SAMII كل 7 ساعات (+0.50$ لكل رسالة إضافية)',
        'billing.permonth': '/شهر', 'billing.permonth_filleul': '/شهر — خصم الإحالة 5%-',
        'billing.ccp.label': '🏦 الدفع عبر CCP',
        'billing.ccp.titulaire': 'صاحب الحساب:', 'billing.ccp.numero': 'رقم CCP:', 'billing.ccp.cle': 'مفتاح RIP:',
        'billing.ccp.btn': 'لقد دفعت، أبلغ الفريق',
        'billing.stripe.btn': 'الدفع بالبطاقة ←',
        'billing.msg.redirecting': 'جارٍ التحويل...',
        'billing.msg.error_generic': 'خطأ، حاول مجددًا.',
        'billing.msg.subscribe': 'اشترك',
        'billing.msg.sending': 'جارٍ الإرسال...',
        'billing.msg.ccp_success': '✅ تم إبلاغ الفريق، التفعيل خلال 24 ساعة',
    },
    zh: {
        'billing.title': '👑 选择你的方案',
        'billing.subtitle': '你对 SAMII 的信任度越高，它就能为你独立完成越多操作。',
        'billing.free.title': '🌑 探索版', 'billing.free.price': '免费',
        'billing.free.li1': '每月100次确认与跟踪',
        'billing.free.li2': '影子模式 + 副驾驶模式（SAMII 提议，你来确认）',
        'billing.free.li3': '每7小时30条 SAMII 消息',
        'billing.free.li4': '基础包裹跟踪',
        'billing.free.btn': '当前方案',
        'billing.standard.title': '🚀 活跃版',
        'billing.standard.li1': '每月1000次确认与跟踪（超出部分每次+0.12$）',
        'billing.standard.li2': '已连接 WhatsApp + Telegram + Shopify',
        'billing.standard.li3': '自动识别VIP忠实客户 + 黑名单',
        'billing.standard.li4': '无限 Meta 广告，由 SAMII 创建',
        'billing.standard.li5': '每月赠送1座堡垒',
        'billing.standard.li6': '每7小时50条 SAMII 消息（超出部分每条+0.50$）',
        'billing.pro.title': '👑 至尊版',
        'billing.pro.li1': '每月10000次确认与跟踪（超出部分每次+0.12$）',
        'billing.pro.li2': '活跃版全部功能，额度更高',
        'billing.pro.li3': '自主模式 + 至尊模式（准备好的广告无需等待确认，SAMII 立即启动）',
        'billing.pro.li4': '每月赠送2座堡垒 + 1次加速',
        'billing.pro.li5': '优先支持',
        'billing.pro.li6': '每7小时150条 SAMII 消息（超出部分每条+0.50$）',
        'billing.permonth': '/月', 'billing.permonth_filleul': '/月 — 推荐折扣 -5%',
        'billing.ccp.label': '🏦 通过 CCP 支付',
        'billing.ccp.titulaire': '账户持有人：', 'billing.ccp.numero': 'CCP 账号：', 'billing.ccp.cle': 'RIP 密钥：',
        'billing.ccp.btn': '我已付款，通知团队',
        'billing.stripe.btn': '银行卡支付 →',
        'billing.msg.redirecting': '正在跳转...',
        'billing.msg.error_generic': '出错了，请重试。',
        'billing.msg.subscribe': '订阅',
        'billing.msg.sending': '发送中...',
        'billing.msg.ccp_success': '✅ 已通知团队，24小时内完成激活',
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

document.querySelectorAll(".bill-btn[data-plan]").forEach(btn => {
    btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = t('billing.msg.redirecting');
        const res = await fetch("/billing/checkout", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: btn.dataset.plan }),
        });
        const json = await res.json();
        if (json.url) {
            window.location.href = json.url;
        } else {
            alert(json.error || t('billing.msg.error_generic'));
            btn.disabled = false;
            btn.textContent = t('billing.msg.subscribe');
        }
    });
});
document.querySelectorAll("[data-plan-chargily]").forEach(btn => {
    btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = t('billing.msg.redirecting');
        try {
            const res = await fetch("/billing/checkout-chargily", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan: btn.dataset.planChargily }),
            });
            const json = await res.json();
            if (json.url) {
                window.location.href = json.url;
            } else {
                alert(json.error || t('billing.msg.error_generic'));
                btn.disabled = false;
                btn.textContent = "💳 Payer par Edahabia/CIB (Chargily) →";
            }
        } catch {
            alert(t('billing.msg.error_generic'));
            btn.disabled = false;
        }
    });
});
document.getElementById("societe-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector("button[type=submit]");
    const msg = document.getElementById("societe-msg");
    btn.disabled = true;
    try {
        const res = await fetch("/billing/contact-societe", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email.value, message: form.message.value }),
        });
        const json = await res.json();
        msg.textContent = json.success ? "✅ Reçu, on te recontacte sous 24h." : (json.error || t('billing.msg.error_generic'));
        if (json.success) form.reset();
    } catch {
        msg.textContent = "Erreur réseau.";
    }
    btn.disabled = false;
});
document.querySelectorAll("[data-plan-ccp]").forEach(btn => {
    btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = t('billing.msg.sending');
        const res = await fetch("/billing/ccp-request", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: btn.dataset.planCcp }),
        });
        const json = await res.json();
        btn.textContent = json.success ? t('billing.msg.ccp_success') : (json.error || t('billing.msg.error_generic'));
        if (!json.success) btn.disabled = false;
    });
});
</script>
</body>
</html>`);
});

router.post("/contact-societe", requireAuth, async (req, res) => {
    try {
        const { email, message } = req.body;
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.json({ success: false, error: "Email invalide." });

        await db.query(
            `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
            ["abonnement.demande.societe", `Demande de contrat Société — ${email} — ${(message || "").trim()}`, req.session.workspaceId]
        );

        gmail.send({
            to: ADMIN_EMAIL,
            subject: "🏛️ Demande de contrat Société — SAMII",
            html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
                <h2 style="color:#C5A059;">Demande palier Société</h2>
                <p><b>Email :</b> ${email}</p>
                <p><b>Message :</b><br>${(message || "—")}</p>
            </div>`,
        }).catch(() => {});

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /billing/contact-societe :", err.message);
        res.json({ success: false, error: "Erreur interne." });
    }
});

router.post("/checkout-chargily", requireAuth, async (req, res) => {
    try {
        const { plan } = req.body;
        if (!PRIX_AFFICHE[plan]) return res.json({ error: "Plan invalide." });
        if (!chargily.isEnabled()) return res.json({ error: "Paiement Chargily indisponible pour le moment." });

        const workspaceId = req.session.workspaceId;
        const { reduit } = await referralService.appliquerReductionFilleul(req.session.userId, 1);
        const montantUSD = reduit
            ? Math.round(PRIX_AFFICHE[plan] * (1 - referralService.TAUX_REDUCTION_FILLEUL) * 100) / 100
            : PRIX_AFFICHE[plan];
        const montantDzd = Math.round(devises.depuisUSD(montantUSD, "DZD"));

        const inserted = await db.query(
            `INSERT INTO abonnements (workspace_id, type, statut, methode_paiement, montant, devise, date_debut)
             VALUES ($1,$2,'en attente','chargily',$3,'DZD',now()) RETURNING id`,
            [workspaceId, plan, montantDzd]
        );
        const abonnementId = inserted[0].id;

        const checkout = await chargily.createCheckout({
            amount: montantDzd,
            currency: "dzd",
            description: `Abonnement SAMII — ${plan}`,
            successUrl: `${CONFIG.APP_URL}/billing/success?method=chargily`,
            failureUrl: `${CONFIG.APP_URL}/billing?achat=echec`,
            webhookUrl: `${CONFIG.APP_URL}/webhook/chargily`,
            metadata: { type: "abonnement", workspace_id: workspaceId, plan, abonnement_id: String(abonnementId) },
        });

        if (!checkout.success) return res.json({ error: "Erreur lors de la création du paiement." });

        await db.query(`UPDATE abonnements SET chargily_checkout_id = $1 WHERE id = $2`, [checkout.checkoutId, abonnementId]);

        res.json({ url: checkout.checkoutUrl });
    } catch (err) {
        console.error("❌ POST /billing/checkout-chargily :", err.message);
        res.json({ error: "Erreur lors de la création du paiement." });
    }
});

router.post("/checkout", requireAuth, async (req, res) => {
    if (!stripe) return res.json({ error: "Stripe non configuré côté serveur." });

    try {
        const { plan } = req.body;
        const priceId = plan === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_STANDARD;
        if (!priceId) return res.json({ error: "Plan invalide." });

        const workspace = await workspaceService.getById(req.session.workspaceId);
        if (!workspace) return res.json({ error: "Workspace introuvable." });

        const { reduit } = await referralService.appliquerReductionFilleul(req.session.userId, 1);
        const discounts = reduit ? [{ coupon: await assurerCouponFilleul() }] : undefined;

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [{ price: priceId, quantity: 1 }],
            discounts,
            success_url: "https://samii.souverain-store.com/billing/success",
            cancel_url : "https://samii.souverain-store.com/billing",
            client_reference_id: workspace.workspaceId,
            metadata: { workspaceId: workspace.workspaceId, plan },
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("❌ POST /billing/checkout :", err.message);
        res.json({ error: "Erreur lors de la création du paiement." });
    }
});

router.post("/ccp-request", requireAuth, async (req, res) => {
    try {
        const { plan } = req.body;
        if (!["standard", "pro"].includes(plan)) return res.json({ success: false, error: "Plan invalide." });
        const workspaceId = req.session.workspaceId;
        const montantDzd = Math.round(devises.depuisUSD(PRIX_AFFICHE[plan], "DZD"));

        await db.query(
            `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
            ["abonnement.demande.ccp", `Demande d'activation ${plan} par virement CCP`, workspaceId]
        );
        // Ligne "en attente" que l'équipe confirme d'un clic dans le Centre de
        // contrôle une fois le virement CCP vérifié (pas d'API Algérie Poste).
        await db.query(
            `INSERT INTO abonnements (workspace_id, type, statut, methode_paiement, montant, devise, date_debut)
             VALUES ($1,$2,'en attente','ccp',$3,'DZD',now())`,
            [workspaceId, plan, montantDzd]
        );

        // Le plan lui-même n'est activé que manuellement par l'équipe (comme pour tout CCP) ;
        // la commission suit le même circuit et reste "en_attente" jusqu'à cette validation.
        const { montant } = await referralService.appliquerReductionFilleul(req.session.userId, PRIX_AFFICHE[plan]);
        await referralService.crediterCommission({
            filleulId: req.session.userId,
            montantPaye: montant,
            devise: "USD",
            plan,
            source: "ccp",
            statut: "en_attente",
        });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /billing/ccp-request :", err.message);
        res.json({ success: false, error: "Erreur interne." });
    }
});

router.get("/success", requireAuth, async (req, res) => {
    // Filet de sécurité pour Chargily : si le webhook n'est jamais arrivé, on
    // revérifie activement au retour du client (même logique que /cartes et le marketplace).
    if (req.query.method === "chargily" && req.session?.workspaceId) {
        try {
            const rows = await db.query(
                `SELECT chargily_checkout_id FROM abonnements WHERE workspace_id = $1 AND statut != 'payée' ORDER BY date_debut DESC LIMIT 1`,
                [req.session.workspaceId]
            );
            if (rows[0]?.chargily_checkout_id) await confirmChargilyAbonnement(rows[0].chargily_checkout_id);
        } catch (err) {
            console.error("❌ Vérification retour abonnement Chargily :", err.message);
        }
    }

    res.send(`<!DOCTYPE html><html><body style="background:#050505;color:white;font-family:Arial;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;">
        <div><h1 style="color:#3ddc84;" data-i18n="billing.success.title">✅ Abonnement activé !</h1><p><a href="/qg" style="color:#C5A059;" data-i18n="billing.success.back">Retour au QG</a></p></div>
        <script>
        (function () {
            var I18N = {
                fr: { 'billing.success.title': '✅ Abonnement activé !', 'billing.success.back': 'Retour au QG' },
                en: { 'billing.success.title': '✅ Subscription activated!', 'billing.success.back': 'Back to HQ' },
                ar: { 'billing.success.title': '✅ تم تفعيل الاشتراك!', 'billing.success.back': 'العودة إلى المقر' },
                zh: { 'billing.success.title': '✅ 订阅已激活！', 'billing.success.back': '返回指挥部' },
            };
            var lang = localStorage.getItem('samii_lang') || 'fr';
            if (!I18N[lang]) lang = 'fr';
            document.documentElement.lang = lang;
            document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
            document.querySelectorAll('[data-i18n]').forEach(function (el) {
                var key = el.getAttribute('data-i18n');
                if (I18N[lang][key] !== undefined) el.textContent = I18N[lang][key];
            });
        })();
        </script>
    </body></html>`);
});

router.post("/webhook", async (req, res) => {
    if (!stripe) return res.status(500).send("Stripe non configuré.");

    let event;
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            req.headers["stripe-signature"],
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error("❌ Signature webhook Stripe invalide :", err.message);
        return res.status(400).send("Signature invalide.");
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const workspaceId = session.metadata?.workspaceId;
        const plan = session.metadata?.plan;

        if (workspaceId && plan) {
            try {
                const workspace = await workspaceService.getById(workspaceId);
                if (workspace) {
                    await abonnementService.activerPalier(workspaceId, plan);
                    // Stripe gère lui-même le renouvellement mensuel (mode "subscription") —
                    // pas besoin de date_fin ni de rappel, contrairement à Chargily/CCP.
                    await db.query(
                        `INSERT INTO abonnements (workspace_id, type, statut, methode_paiement, montant, devise, date_debut)
                         VALUES ($1,$2,'payée','stripe',$3,$4,now())`,
                        [workspaceId, plan, (session.amount_total || 0) / 100, (session.currency || "usd").toUpperCase()]
                    );

                    console.log(`✅ Abonnement ${plan} activé pour ${workspaceId}`);

                    const acheteurRows = await db.query(`SELECT id FROM utilisateurs WHERE email = $1`, [workspace.owner]);
                    const acheteurId = acheteurRows[0]?.id;
                    if (acheteurId) {
                        await referralService.crediterCommission({
                            filleulId: acheteurId,
                            montantPaye: (session.amount_total || 0) / 100,
                            devise: (session.currency || "usd").toUpperCase(),
                            plan,
                            source: "stripe",
                            statut: "confirmee",
                        });
                    }
                }
            } catch (err) {
                console.error("❌ Erreur mise à jour après paiement :", err.message);
            }
        }
    }

    res.json({ received: true });
});

module.exports = router;
