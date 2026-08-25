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
const journalService = require("../services/journalService");
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

// Prix de référence des paliers payants. Source unique : config/paliers.js —
// la page, Chargily, le CCP et le rappel de renouvellement lisent le même
// chiffre, pour qu'on ne puisse plus facturer un montant jamais affiché.
const paliers = require("../config/paliers");
const PRIX_AFFICHE = Object.fromEntries(paliers.PAYANTS.map(id => [id, paliers.prixUSD(id)]));

const gmail = require("../services/gmail");
const courriel = require("../services/emailTemplate");
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
    const griotNote = `<p class="bill-daily-note" data-i18n="billing.griot.note">🎨 Génération IA (Griot) : 0,80 $/seconde</p>`;
    // Le premier palier payant est affiché comme un prix de lancement : c'est
    // vrai (il montera avec le parc installé) et ça vaut mieux qu'une fausse
    // promotion à compte à rebours. Piloté par config/paliers.js.
    const lancementNote = (plan) => paliers.PALIERS[plan]?.prixDeLancement
        ? `<p class="bill-lancement" data-i18n="billing.lancement">Prix de lancement</p>` : "";

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
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        :root {
            --lux-onyx: #07070a; --lux-panel: #101013; --lux-panel-2: #16161a;
            --lux-gold: #c9a961; --lux-gold-bright: #f0d99b;
            --lux-steel: #9497a1; --lux-cyan: #5fd4ff; --lux-cyan-dim: rgba(95,212,255,0.12);
            --lux-ivory: #f3f1e9; --lux-smoke: #7d7f89;
            --lux-border: rgba(201,169,97,0.16); --lux-border-steel: rgba(148,151,161,0.22);
        }
        body { background: var(--lux-onyx); }
        .lux-serif { font-family: "Didot", "Bodoni MT", "Playfair Display", Georgia, "Times New Roman", serif; }
        .bill-shell { max-width: 1160px; margin: 0 auto; padding: 56px 24px 90px; color: var(--lux-ivory); }
        .bill-wordmark { text-align: center; font-family: "Didot", "Bodoni MT", Georgia, serif; font-size: 12px; letter-spacing: .5em; text-indent: .5em; color: var(--lux-gold); text-transform: uppercase; margin-bottom: 16px; }
        .bill-shell h1 { font-family: "Didot", "Bodoni MT", "Playfair Display", Georgia, serif; font-weight: 400; color: var(--lux-ivory); font-size: clamp(1.9rem, 4vw, 2.6rem); text-align: center; margin: 0 0 12px; text-wrap: balance; }
        .bill-shell p.sub { color: var(--lux-smoke); text-align: center; font-size: .92rem; max-width: 46ch; margin: 0 auto 40px; }
        .bill-steps { display: flex; justify-content: center; align-items: center; gap: 0; margin-bottom: 48px; flex-wrap: wrap; }
        .bill-step { display: flex; align-items: center; gap: 10px; }
        .bill-step-num { width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(95,212,255,.35); background: var(--lux-cyan-dim); display: grid; place-items: center; font-family: var(--font-mono); font-size: 11px; color: var(--lux-cyan); flex-shrink: 0; }
        .bill-step-label { font-size: .74rem; color: var(--lux-smoke); white-space: nowrap; }
        .bill-step-label b { color: var(--lux-ivory); font-weight: 600; }
        .bill-step-rule { width: 40px; height: 1px; background: linear-gradient(90deg, var(--lux-border), var(--lux-border-steel)); margin: 0 16px; }
        @media (max-width: 640px) { .bill-step-rule { display: none; } .bill-steps { flex-direction: column; gap: 14px; } }
        .bill-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; align-items: stretch; }
        @media (max-width: 980px) { .bill-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) {
            .bill-grid { grid-template-columns: 1fr; }
            .bill-shell { padding-top: 32px; }
            .lang-switch span { padding: 9px 12px; font-size: .68rem; }
            .bill-btn { padding: 15px; font-size: .76rem; }
            .bill-card { padding: 26px 20px; }
        }
        .bill-card { background: linear-gradient(180deg, var(--lux-panel-2), var(--lux-panel)); border: 1px solid var(--lux-border-steel); border-radius: 4px; padding: 30px 24px; display: flex; flex-direction: column; box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 24px 60px rgba(0,0,0,.5); transition: border-color .25s ease, box-shadow .25s ease; }
        .bill-card:hover { border-color: rgba(95,212,255,.4); box-shadow: 0 0 0 1px rgba(95,212,255,.25), 0 24px 60px rgba(0,0,0,.5); }
        .bill-card--pro { border-color: var(--lux-gold); box-shadow: 0 0 0 1px var(--lux-gold), 0 24px 60px rgba(0,0,0,.5); transform: translateY(-8px); }
        .bill-card--pro:hover { border-color: var(--lux-gold); box-shadow: 0 0 0 1px var(--lux-gold), 0 24px 60px rgba(0,0,0,.5); }
        @media (max-width: 980px) { .bill-card--pro { transform: none; } }
        .bill-card--societe { border-color: var(--lux-border-steel); }
        .bill-card-eyebrow { font-size: .66rem; letter-spacing: .16em; text-transform: uppercase; color: var(--lux-steel); margin-bottom: 8px; }
        .bill-card--pro .bill-card-eyebrow { color: var(--lux-gold); }
        .bill-card h2 { font-family: "Didot", "Bodoni MT", "Playfair Display", Georgia, serif; color: var(--lux-ivory); font-size: 1.4rem; font-weight: 400; margin: 0 0 4px; }
        .bill-card-tagline { font-size: .76rem; color: var(--lux-smoke); margin: 0 0 20px; min-height: 28px; }
        .bill-price { font-family: var(--font-mono); font-size: 1.7rem; color: var(--lux-gold); margin: 0 0 20px; }
        .bill-price[data-free] { font-family: "Didot", "Bodoni MT", Georgia, serif; font-size: 1.4rem; color: var(--lux-ivory); }
        .bill-price span { font-size: .72rem; color: var(--lux-smoke); font-family: -apple-system, sans-serif; }
        .bill-card-rule { height: 1px; background: var(--lux-border-steel); margin: 0 0 20px; }
        .bill-card ul { list-style: none; margin: 0 0 22px; padding: 0; flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .bill-card li { color: var(--lux-smoke); font-size: .78rem; padding: 0; line-height: 1.5; }
        .bill-card li::before { content: "— "; color: var(--lux-gold); }
        .bill-btn { width: 100%; padding: 13px; border-radius: 2px; border: 1px solid var(--lux-gold); background: transparent; color: var(--lux-gold); font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; font-weight: 600; cursor: pointer; transition: all .2s ease; }
        .bill-btn:hover { background: var(--lux-gold); color: var(--lux-onyx); }
        .bill-btn--free { border-color: var(--lux-border-steel); color: var(--lux-steel); cursor: default; }
        .bill-btn--free:hover { background: transparent; color: var(--lux-steel); }
        .bill-card--pro .bill-btn { background: var(--lux-gold); color: var(--lux-onyx); }
        .bill-card--pro .bill-btn:hover { background: var(--lux-gold-bright); border-color: var(--lux-gold-bright); }
        .bill-lancement { margin: -14px 0 20px; font-size: .64rem; letter-spacing: .14em; text-transform: uppercase; color: var(--lux-gold); opacity: .8; }
        .bill-daily-note { text-align: center; font-family: var(--font-mono); font-size: .64rem; color: var(--lux-cyan); opacity: .85; margin: 10px 0 0; }
        .callout-regularisation { max-width: 640px; margin: 0 auto 28px; padding: 14px 18px; border-radius: 2px; background: rgba(229,85,85,0.08); border: 1px solid rgba(229,85,85,0.3); color: #e88; font-size: .8rem; text-align: center; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; }
        .bill-btn--regulariser { width: auto; padding: 8px 14px; font-size: .7rem; background: #e55; border-color: #e55; color: #fff; }
        .bill-ccp { margin-top: auto; padding: 14px; border-radius: 2px; background: var(--lux-cyan-dim); border: 1px solid rgba(95,212,255,.25); margin-bottom: 10px; }
        .bill-ccp-label { color: var(--lux-cyan); font-size: .74rem; font-weight: 700; margin-bottom: 8px; }
        .bill-ccp-details { font-size: .72rem; color: var(--lux-smoke); line-height: 1.6; margin-bottom: 10px; }
        .bill-ccp-details b { color: var(--lux-ivory); }
        .bill-btn--ccp { border-color: var(--lux-cyan); color: var(--lux-cyan); }
        .bill-btn--ccp:hover { background: var(--lux-cyan); color: var(--lux-onyx); }
        .bill-btn--stripe { margin-top: 8px; border-color: var(--lux-border-steel); color: var(--lux-steel); }
        .bill-btn--stripe:hover { background: var(--lux-border-steel); color: var(--lux-ivory); }
        .bill-btn--chargily { margin-top: 8px; }
        .bill-trust { margin-top: 56px; padding-top: 28px; border-top: 1px solid var(--lux-border-steel); display: flex; justify-content: center; gap: 36px; flex-wrap: wrap; }
        .bill-trust-item { display: flex; align-items: center; gap: 8px; font-size: .7rem; color: var(--lux-smoke); }
        .bill-trust-item .dot { width: 5px; height: 5px; border-radius: 50%; background: #7fae8a; flex-shrink: 0; }
        .bill-cards-link { text-align: center; margin-top: 22px; }
        .bill-cards-link a { color: var(--lux-gold); font-size: .82rem; text-decoration: none; }
        .bill-topbar { display: flex; justify-content: flex-end; margin-bottom: 16px; }
        .lang-switch { display: flex; gap: 2px; font-family: var(--font-mono); font-size: .64rem; padding: 3px; border: 1px solid var(--lux-border-steel); border-radius: 4px; }
        .lang-switch span { padding: 5px 7px; border-radius: 2px; cursor: pointer; color: var(--lux-smoke); transition: .2s ease; }
        .lang-switch span.active, .lang-switch span:hover { color: var(--lux-gold); background: var(--lux-border); }
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
    <div class="bill-wordmark">S A M I I &nbsp; O S</div>
    <h1 data-i18n="billing.title">Choisis ton palier</h1>
    <p class="sub" data-i18n="billing.subtitle">Plus tu fais confiance à SAMII, plus il peut agir seul pour toi.</p>

    <div class="bill-steps">
        <div class="bill-step"><div class="bill-step-num">1</div><div class="bill-step-label" data-i18n="billing.step1"><b data-i18n="billing.step1b">Découvre</b> les paliers</div></div>
        <div class="bill-step-rule"></div>
        <div class="bill-step"><div class="bill-step-num">2</div><div class="bill-step-label" data-i18n="billing.step2"><b data-i18n="billing.step2b">Choisis</b> ton palier</div></div>
        <div class="bill-step-rule"></div>
        <div class="bill-step"><div class="bill-step-num">3</div><div class="bill-step-label" data-i18n="billing.step3"><b data-i18n="billing.step3b">Règle</b> et c'est parti</div></div>
    </div>

    ${regularisationHtml}
    <div class="bill-grid">
        <div class="bill-card">
            <div class="bill-card-eyebrow" data-i18n="billing.free.eyebrow">Palier I</div>
            <h2 data-i18n="billing.free.title">🌑 Découverte</h2>
            <p class="bill-card-tagline" data-i18n="billing.free.tagline">Pour tester SAMII sans engagement.</p>
            <div class="bill-price" data-free data-i18n="billing.free.price">Gratuit</div>
            <div class="bill-card-rule"></div>
            <ul>
                <li data-i18n="billing.free.canaux">1 canal au choix — Telegram, par exemple</li>
                <li data-i18n="billing.free.whatsapp">WhatsApp : 3 jours d'essai, une seule fois</li>
                <li data-i18n="billing.free.creatif">Scripts, photos et vidéos réelles — sans limite</li>
                <li data-i18n="billing.free.li1">150 confirmations & suivi / mois</li>
                <li data-i18n="billing.free.li2">SAMII te propose chaque action, tu valides avant qu'elle parte</li>
                <li data-i18n="billing.free.li3">30 messages SAMII toutes les 7h</li>
                <li data-i18n="billing.free.li4">Suivi de colis basique</li>
                <li>🃏 ${NB_CARTES_PAR_PALIER.free} <span data-i18n="billing.cards.unlocked">fonctionnalités bonus débloquées</span></li>
            </ul>
            <button class="bill-btn bill-btn--free" disabled data-i18n="billing.free.btn">Palier actuel</button>
            ${dailyNote("free")}
        </div>
        <div class="bill-card">
            <div class="bill-card-eyebrow" data-i18n="billing.standard.eyebrow">Palier II</div>
            <h2 data-i18n="billing.standard.title">🚀 Actif</h2>
            <p class="bill-card-tagline" data-i18n="billing.standard.tagline">Pour un commerce qui tourne déjà.</p>
            <div class="bill-price">${prixHtml("standard")}</div>
            ${lancementNote("standard")}
            <div class="bill-card-rule"></div>
            <ul>
                <li data-i18n="billing.standard.li1">2 100 confirmations & suivi / mois (+0,50 $ au-delà)</li>
                <li data-i18n="billing.standard.canaux">3 canaux au choix — WhatsApp, Telegram, Gmail, Instagram…</li>
                <li data-i18n="billing.standard.publication">Publication automatique 3× par semaine</li>
                <li data-i18n="billing.standard.google">Emails et agenda : SAMII lit, répond, planifie</li>
                <li data-i18n="billing.standard.rdv">Rendez-vous pris et confirmés sans toi</li>
                <li data-i18n="billing.standard.ia">Créations IA, image et vidéo — payées à la seconde</li>
                <li data-i18n="billing.standard.topproduits">Top Produits : ce qui se vend le mieux sur ton marché</li>
                <li data-i18n="billing.standard.li3">Client fidèle (VIP) + liste noire automatiques</li>
                <li data-i18n="billing.standard.li5">1 carte premium offerte chaque mois</li>
                <li data-i18n="billing.standard.li6">50 messages SAMII toutes les 7h (+0,12 $/message au-delà)</li>
                <li>🃏 ${NB_CARTES_PAR_PALIER.standard} <span data-i18n="billing.cards.unlocked">fonctionnalités bonus débloquées</span></li>
            </ul>
            ${chargilyBlock("standard")}
            ${ccpBlock("standard")}
            ${stripeBlock("standard")}
            ${dailyNote("standard")}
            ${griotNote}
        </div>
        <div class="bill-card bill-card--pro">
            <div class="bill-card-eyebrow" data-i18n="billing.pro.eyebrow">Palier III · Recommandé</div>
            <h2 data-i18n="billing.pro.title">👑 Souverain</h2>
            <p class="bill-card-tagline" data-i18n="billing.pro.tagline">Pour ne plus jamais attendre une validation.</p>
            <div class="bill-price">${prixHtml("pro")}</div>
            <div class="bill-card-rule"></div>
            <ul>
                <li data-i18n="billing.pro.li1">30 000 confirmations & suivi / mois (+0,50 $ au-delà)</li>
                <li data-i18n="billing.pro.li2">Tout le palier Actif, plus :</li>
                <li data-i18n="billing.pro.canaux">Canaux illimités — Facebook, Drive, YouTube, TikTok…</li>
                <li data-i18n="billing.pro.radar">SAMII cherche seul les opportunités, sources à l'appui</li>
                <li data-i18n="billing.pro.veille">Fournisseurs, prix du marché et concurrents surveillés</li>
                <li data-i18n="billing.pro.api">API et webhooks : branche tes propres outils</li>
                <li data-i18n="billing.pro.apps">Applications tierces installables</li>
                <li data-i18n="billing.pro.publication">Publication Facebook et Instagram jusqu'à 2× par jour</li>
                <li data-i18n="billing.pro.li3">SAMII lance directement tes pubs prêtes, sans attendre ta validation</li>
                <li data-i18n="billing.pro.li4">3 cartes premium offertes chaque mois</li>
                <li data-i18n="billing.pro.li5">Support prioritaire</li>
                <li data-i18n="billing.pro.li6">150 messages SAMII toutes les 7h (+0,12 $/message au-delà)</li>
                <li>🃏 ${NB_CARTES_PAR_PALIER.pro} <span data-i18n="billing.cards.unlocked">fonctionnalités bonus débloquées</span></li>
            </ul>
            ${chargilyBlock("pro")}
            ${ccpBlock("pro")}
            ${stripeBlock("pro")}
            ${dailyNote("pro")}
            ${griotNote}
        </div>
        <div class="bill-card bill-card--societe">
            <div class="bill-card-eyebrow" data-i18n="billing.societe.eyebrow">Palier IV</div>
            <h2 data-i18n="billing.societe.title">🏛️ Société</h2>
            <p class="bill-card-tagline" data-i18n="billing.societe.tagline">Pour plusieurs comptes, un seul contrat.</p>
            <div class="bill-price" data-free data-i18n="billing.societe.price">Sur devis</div>
            <div class="bill-card-rule"></div>
            <ul>
                <li><span data-i18n="billing.societe.li1">Toutes les fonctionnalités bonus débloquées</span> (${NB_CARTES_PAR_PALIER.societe}/${NB_CARTES_PAR_PALIER.societe})</li>
                <li data-i18n="billing.societe.li2">Multi-comptes, multi-boutiques</li>
                <li data-i18n="billing.societe.illimite">Confirmations et messages sans limite</li>
                <li data-i18n="billing.societe.wa">WhatsApp Business API par notre compte vérifié</li>
                <li data-i18n="billing.societe.li3">Contrat et facturation dédiés</li>
                <li data-i18n="billing.societe.li4">Accompagnement personnalisé</li>
            </ul>
            <form id="societe-form" style="margin-top:auto;display:flex;flex-direction:column;gap:8px;">
                <input type="email" name="email" placeholder="Ton email" data-i18n-ph="billing.societe.ph.email" required style="padding:10px;border-radius:2px;border:1px solid var(--lux-border-steel);background:rgba(255,255,255,0.03);color:var(--lux-ivory);font-size:.78rem;">
                <textarea name="message" placeholder="Décris ton besoin (nombre de boutiques, volume...)" data-i18n-ph="billing.societe.ph.message" rows="2" style="padding:10px;border-radius:2px;border:1px solid var(--lux-border-steel);background:rgba(255,255,255,0.03);color:var(--lux-ivory);font-size:.78rem;resize:vertical;"></textarea>
                <button type="submit" class="bill-btn" data-i18n="billing.societe.btn">Nous contacter</button>
                <div id="societe-msg" style="font-size:.72rem;color:var(--lux-smoke);min-height:16px;text-align:center;"></div>
            </form>
        </div>
    </div>

    <p class="bill-cards-link"><a href="/cartes" data-i18n="billing.cards.link">🃏 Voir le détail des cartes débloquées à chaque palier →</a></p>

    <div class="bill-trust">
        <div class="bill-trust-item"><span class="dot"></span><span data-i18n="billing.trust1">Edahabia / CIB via Chargily</span></div>
        <div class="bill-trust-item"><span class="dot"></span><span data-i18n="billing.trust2">Virement CCP accepté</span></div>
        <div class="bill-trust-item"><span class="dot"></span><span data-i18n="billing.trust3">Changement de palier à tout moment</span></div>
        <div class="bill-trust-item"><span class="dot"></span><span data-i18n="billing.trust4">Assistance 24 h/24, 7 j/7 sur tous les paliers</span></div>
    </div>


</div>
<script>
const I18N = {
    fr: {
        'billing.title': 'Choisis ton palier',
        'billing.subtitle': 'Plus tu fais confiance à SAMII, plus il peut agir seul pour toi.',
        'billing.free.eyebrow': 'Palier I', 'billing.free.tagline': 'Pour tester SAMII sans engagement.',
        'billing.free.title': '🌑 Découverte', 'billing.free.price': 'Gratuit',
        'billing.free.li1': '150 confirmations & suivi / mois',
        'billing.free.li2': "SAMII te propose chaque action, tu valides avant qu'elle parte",
        'billing.free.li3': '30 messages SAMII toutes les 7h',
        'billing.free.li4': 'Suivi de colis basique',
        'billing.free.btn': 'Plan actuel',
        'billing.cards.unlocked': 'fonctionnalités bonus débloquées',
        'billing.standard.eyebrow': 'Palier II', 'billing.standard.tagline': 'Pour un commerce qui tourne déjà.',
        'billing.standard.title': '🚀 Actif',
        'billing.standard.li1': '2 100 confirmations & suivi / mois (+0,50 $ au-delà)',
        'billing.standard.li2': 'WhatsApp + Telegram + Shopify connectés',
        'billing.standard.li3': 'Client fidèle (VIP) + liste noire automatiques',
        'billing.standard.li5': '1 carte premium offerte chaque mois',
        'billing.standard.li6': '50 messages SAMII toutes les 7h (+0,12 $/message au-delà)',
        'billing.pro.eyebrow': 'Palier III · Recommandé', 'billing.pro.tagline': 'Pour ne plus jamais attendre une validation.',
        'billing.pro.title': '👑 Souverain',
        'billing.pro.li1': '30 000 confirmations & suivi / mois (+0,50 $ au-delà)',
        'billing.pro.li2': 'Tout le palier Actif, plus :',
        'billing.pro.li3': 'SAMII lance directement tes pubs prêtes, sans attendre ta validation',
        'billing.pro.li4': '3 cartes premium offertes chaque mois',
        'billing.pro.li5': 'Support prioritaire',
        'billing.pro.li6': '150 messages SAMII toutes les 7h (+0,12 $/message au-delà)',
        'billing.griot.note': '🎨 Génération IA (Griot) : 0,80 $/seconde',
        'billing.free.canaux': '1 canal au choix — Telegram, par exemple',
        'billing.free.whatsapp': "WhatsApp : 3 jours d'essai, une seule fois",
        'billing.standard.canaux': '3 canaux au choix — WhatsApp, Telegram, Gmail, Instagram…',
        'billing.standard.publication': 'Publication automatique 3× par semaine',
        'billing.pro.canaux': 'Canaux illimités — Facebook, Instagram, Drive, Sheets…',

        'billing.standard.google': 'Emails et agenda : SAMII lit, répond, planifie',
        'billing.free.creatif': 'Scripts, photos et vidéos réelles — sans limite',
        'billing.standard.rdv': 'Rendez-vous pris et confirmés sans toi',
        'billing.standard.ia': 'Créations IA, image et vidéo — payées à la seconde',
        'billing.standard.topproduits': 'Top Produits : ce qui se vend le mieux sur ton marché',
        'billing.pro.radar': "SAMII cherche seul les opportunités, sources à l'appui",
        'billing.pro.veille': 'Fournisseurs, prix du marché et concurrents surveillés',
        'billing.societe.wa': 'WhatsApp Business API par notre compte vérifié',
        'billing.trust4': 'Assistance 24 h/24, 7 j/7 sur tous les paliers',
        'billing.pro.api': 'API et webhooks : branche tes propres outils',
        'billing.pro.apps': 'Applications tierces installables',
        'billing.pro.publication': "Publication Facebook et Instagram jusqu'à 2× par jour",
        'billing.societe.illimite': 'Confirmations et messages sans limite',
        'billing.lancement': 'Prix de lancement',
       
       
        'billing.step1': 'Découvre les paliers', 'billing.step1b': 'Découvre',
        'billing.step2': 'Choisis ton palier', 'billing.step2b': 'Choisis',
        'billing.step3': "Règle et c'est parti", 'billing.step3b': 'Règle',
        'billing.societe.eyebrow': 'Palier IV', 'billing.societe.title': '🏛️ Société',
        'billing.societe.tagline': 'Pour plusieurs comptes, un seul contrat.', 'billing.societe.price': 'Sur devis',
        'billing.societe.li1': 'Toutes les fonctionnalités bonus débloquées', 'billing.societe.li2': 'Multi-comptes, multi-boutiques',
        'billing.societe.li3': 'Contrat et facturation dédiés', 'billing.societe.li4': 'Accompagnement personnalisé',
        'billing.societe.ph.email': 'Ton email', 'billing.societe.ph.message': 'Décris ton besoin (nombre de boutiques, volume...)',
        'billing.societe.btn': 'Nous contacter',
        'billing.cards.link': '🃏 Voir le détail des cartes débloquées à chaque palier →',
        'billing.trust1': 'Edahabia / CIB via Chargily', 'billing.trust2': 'Virement CCP accepté',
        'billing.trust3': 'Changement de palier à tout moment',
        'billing.permonth': '/mois', 'billing.permonth_filleul': '/mois — filleul -5%',
        'billing.ccp.label': '🏦 Payer par CCP',
        'billing.ccp.titulaire': 'Titulaire :', 'billing.ccp.numero': 'Numéro CCP :', 'billing.ccp.cle': 'Clé RIP :', 'billing.ccp.montant': 'Montant à virer :',
        'billing.ccp.btn': "J'ai payé, préviens l'équipe",
        'billing.stripe.btn': 'Payer par carte →',
        'billing.msg.redirecting': 'Redirection...',
        'billing.msg.error_generic': 'Erreur, réessaye.',
        'billing.msg.subscribe': "S'abonner",
        'billing.msg.sending': 'Envoi...',
        'billing.msg.ccp_success': '✅ Équipe prévenue, activation sous 24h',
    },
    en: {
        'billing.title': 'Choose your tier',
        'billing.subtitle': 'The more you trust SAMII, the more it can act on its own for you.',
        'billing.free.eyebrow': 'Tier I', 'billing.free.tagline': 'To try SAMII with no commitment.',
        'billing.free.title': '🌑 Discovery', 'billing.free.price': 'Free',
        'billing.free.li1': '150 confirmations & tracking / month',
        'billing.free.li2': "SAMII suggests every action, you approve before it's sent",
        'billing.free.li3': '30 SAMII messages every 7h',
        'billing.free.li4': 'Basic package tracking',
        'billing.free.btn': 'Current plan',
        'billing.cards.unlocked': 'bonus features unlocked',
        'billing.standard.eyebrow': 'Tier II', 'billing.standard.tagline': 'For a business that is already running.',
        'billing.standard.title': '🚀 Active',
        'billing.standard.li1': '2,100 confirmations & tracking / month (+$0.50 beyond)',
        'billing.standard.li2': 'WhatsApp + Telegram + Shopify connected',
        'billing.standard.li3': 'Automatic VIP client + blacklist detection',
        'billing.standard.li5': '1 premium card granted every month',
        'billing.standard.li6': '50 SAMII messages every 7h (+$0.12/message beyond)',
        'billing.pro.eyebrow': 'Tier III · Recommended', 'billing.pro.tagline': 'To never wait for approval again.',
        'billing.pro.title': '👑 Sovereign',
        'billing.pro.li1': '30,000 confirmations & tracking / month (+$0.50 beyond)',
        'billing.pro.li2': 'Everything in the Active tier, plus:',
        'billing.pro.li3': 'SAMII launches your ready ads instantly, no approval needed',
        'billing.pro.li4': '3 premium cards granted every month',
        'billing.pro.li5': 'Priority support',
        'billing.pro.li6': '150 SAMII messages every 7h (+$0.12/message beyond)',
        'billing.griot.note': '🎨 AI generation (Griot): $0.80/second',
        'billing.free.canaux': '1 channel of your choice — Telegram, for instance',
        'billing.free.whatsapp': 'WhatsApp: 3-day trial, once',
        'billing.standard.canaux': '3 channels of your choice — WhatsApp, Telegram, Gmail, Instagram…',
        'billing.standard.publication': 'Automatic publishing 3× a week',
        'billing.pro.canaux': 'Unlimited channels — Facebook, Instagram, Drive, Sheets…',

        'billing.standard.google': 'Email and calendar: SAMII reads, replies, schedules',
        'billing.free.creatif': 'Scripts, real photos and videos — no limit',
        'billing.standard.rdv': 'Appointments booked and confirmed without you',
        'billing.standard.ia': 'AI image and video creations — billed by the second',
        'billing.standard.topproduits': 'Top Products: what sells best on your market',
        'billing.pro.radar': 'SAMII hunts opportunities on its own, with sources',
        'billing.pro.veille': 'Suppliers, market prices and competitors watched',
        'billing.societe.wa': 'WhatsApp Business API through our verified account',
        'billing.trust4': 'Support 24/7 on every tier',
        'billing.pro.api': 'API and webhooks: plug in your own tools',
        'billing.pro.apps': 'Third-party apps you can install',
        'billing.pro.publication': 'Facebook and Instagram publishing up to 2× a day',
        'billing.societe.illimite': 'Confirmations and messages with no limit',
        'billing.lancement': 'Launch price',
       
       
        'billing.step1': 'Discover the tiers', 'billing.step1b': 'Discover',
        'billing.step2': 'Choose your tier', 'billing.step2b': 'Choose',
        'billing.step3': "Pay and you're set", 'billing.step3b': 'Pay',
        'billing.societe.eyebrow': 'Tier IV', 'billing.societe.title': '🏛️ Enterprise',
        'billing.societe.tagline': 'For several accounts, one contract.', 'billing.societe.price': 'Custom quote',
        'billing.societe.li1': 'All bonus features unlocked', 'billing.societe.li2': 'Multi-account, multi-store',
        'billing.societe.li3': 'Dedicated contract and billing', 'billing.societe.li4': 'Personalized onboarding',
        'billing.societe.ph.email': 'Your email', 'billing.societe.ph.message': 'Describe your needs (number of stores, volume...)',
        'billing.societe.btn': 'Contact us',
        'billing.cards.link': '🃏 See the card details for each tier →',
        'billing.trust1': 'Edahabia / CIB via Chargily', 'billing.trust2': 'CCP transfer accepted',
        'billing.trust3': 'Change tier anytime',
        'billing.permonth': '/month', 'billing.permonth_filleul': '/month — referral -5%',
        'billing.ccp.label': '🏦 Pay by CCP',
        'billing.ccp.titulaire': 'Account holder:', 'billing.ccp.numero': 'CCP number:', 'billing.ccp.cle': 'RIP key:', 'billing.ccp.montant': 'Amount to transfer:',
        'billing.ccp.btn': "I've paid, notify the team",
        'billing.stripe.btn': 'Pay by card →',
        'billing.msg.redirecting': 'Redirecting...',
        'billing.msg.error_generic': 'Error, try again.',
        'billing.msg.subscribe': 'Subscribe',
        'billing.msg.sending': 'Sending...',
        'billing.msg.ccp_success': '✅ Team notified, activation within 24h',
    },
    ar: {
        'billing.title': 'اختر باقتك',
        'billing.subtitle': 'كلما زادت ثقتك بـ SAMII، زادت قدرته على التصرف بمفرده من أجلك.',
        'billing.free.eyebrow': 'الباقة الأولى', 'billing.free.tagline': 'لتجربة SAMII بدون التزام.',
        'billing.free.title': '🌑 الاكتشاف', 'billing.free.price': 'مجاني',
        'billing.free.li1': '150 تأكيد وتتبع / شهريًا',
        'billing.free.li2': 'SAMII يقترح كل إجراء، وأنت توافق قبل تنفيذه',
        'billing.free.li3': '30 رسالة SAMII كل 7 ساعات',
        'billing.free.li4': 'تتبع أساسي للطرود',
        'billing.free.btn': 'الباقة الحالية',
        'billing.cards.unlocked': 'ميزة إضافية مفتوحة',
        'billing.standard.eyebrow': 'الباقة الثانية', 'billing.standard.tagline': 'لتجارة تعمل بالفعل.',
        'billing.standard.title': '🚀 نشط',
        'billing.standard.li1': '2100 تأكيد وتتبع / شهريًا (+0.50$ لكل تأكيد إضافي)',
        'billing.standard.li2': 'ربط WhatsApp + Telegram + Shopify',
        'billing.standard.li3': 'عميل مخلص (VIP) + قائمة سوداء تلقائية',
        'billing.standard.li5': 'بطاقة مميزة واحدة مجانًا كل شهر',
        'billing.standard.li6': '50 رسالة SAMII كل 7 ساعات (+0.12$ لكل رسالة إضافية)',
        'billing.pro.eyebrow': 'الباقة الثالثة · موصى بها', 'billing.pro.tagline': 'لكي لا تنتظر موافقة أبدًا.',
        'billing.pro.title': '👑 سيادي',
        'billing.pro.li1': '30000 تأكيد وتتبع / شهريًا (+0.50$ لكل تأكيد إضافي)',
        'billing.pro.li2': 'كل ما في باقة نشِط، بالإضافة إلى:',
        'billing.pro.li3': 'SAMII يُطلق إعلاناتك الجاهزة فورًا، دون الحاجة لموافقتك',
        'billing.pro.li4': '3 بطاقات مميزة مجانًا كل شهر',
        'billing.pro.li5': 'دعم ذو أولوية',
        'billing.pro.li6': '150 رسالة SAMII كل 7 ساعات (+0.12$ لكل رسالة إضافية)',
        'billing.griot.note': '🎨 توليد بالذكاء الاصطناعي (Griot): 0.80$/ثانية',
        'billing.free.canaux': 'قناة واحدة من اختيارك — تيليغرام مثلًا',
        'billing.free.whatsapp': 'واتساب: 3 أيام تجربة، مرة واحدة',
        'billing.standard.canaux': '3 قنوات من اختيارك — واتساب، تيليغرام، جيميل، إنستغرام…',
        'billing.standard.publication': 'نشر تلقائي 3 مرات أسبوعيًا',
        'billing.pro.canaux': 'قنوات بلا حدود — فيسبوك، إنستغرام، درايف، شيتس…',

        'billing.standard.google': 'البريد والأجندة: سامي يقرأ ويردّ ويُبرمج المواعيد',
        'billing.free.creatif': 'نصوص وصور وفيديوهات حقيقية — بلا حدود',
        'billing.standard.rdv': 'مواعيد تُحجز وتُؤكَّد دون تدخّلك',
        'billing.standard.ia': 'إبداعات بالذكاء الاصطناعي، صورة وفيديو — تُحتسب بالثانية',
        'billing.standard.topproduits': 'أفضل المنتجات: ما يُباع أكثر في سوقك',
        'billing.pro.radar': 'سامي يبحث وحده عن الفرص، مع المصادر',
        'billing.pro.veille': 'مراقبة المورّدين وأسعار السوق والمنافسين',
        'billing.societe.wa': 'واجهة واتساب بزنس عبر حسابنا الموثّق',
        'billing.trust4': 'دعم على مدار الساعة طوال أيام الأسبوع لجميع الباقات',
        'billing.pro.api': 'واجهة برمجية وويب‑هوك: اربط أدواتك الخاصة',
        'billing.pro.apps': 'تطبيقات خارجية قابلة للتثبيت',
        'billing.pro.publication': 'نشر على فيسبوك وإنستغرام حتى مرتين يوميًا',
        'billing.societe.illimite': 'تأكيدات ورسائل بلا حدود',
        'billing.lancement': 'سعر الإطلاق',
       
       
        'billing.step1': 'اكتشف الباقات', 'billing.step1b': 'اكتشف',
        'billing.step2': 'اختر باقتك', 'billing.step2b': 'اختر',
        'billing.step3': 'ادفع وانطلق', 'billing.step3b': 'ادفع',
        'billing.societe.eyebrow': 'الباقة الرابعة', 'billing.societe.title': '🏛️ شركة',
        'billing.societe.tagline': 'لعدة حسابات، عقد واحد.', 'billing.societe.price': 'عرض سعر مخصص',
        'billing.societe.li1': 'جميع الميزات الإضافية مفتوحة', 'billing.societe.li2': 'حسابات ومتاجر متعددة',
        'billing.societe.li3': 'عقد وفوترة مخصصة', 'billing.societe.li4': 'مرافقة شخصية',
        'billing.societe.ph.email': 'بريدك الإلكتروني', 'billing.societe.ph.message': 'صف احتياجك (عدد المتاجر، الحجم...)',
        'billing.societe.btn': 'تواصل معنا',
        'billing.cards.link': '🃏 عرض تفاصيل البطاقات لكل باقة ←',
        'billing.trust1': 'Edahabia / CIB عبر Chargily', 'billing.trust2': 'التحويل عبر CCP مقبول',
        'billing.trust3': 'تغيير الباقة في أي وقت',
        'billing.permonth': '/شهر', 'billing.permonth_filleul': '/شهر — خصم الإحالة 5%-',
        'billing.ccp.label': '🏦 الدفع عبر CCP',
        'billing.ccp.titulaire': 'صاحب الحساب:', 'billing.ccp.numero': 'رقم CCP:', 'billing.ccp.cle': 'مفتاح RIP:', 'billing.ccp.montant': 'المبلغ المطلوب تحويله:',
        'billing.ccp.btn': 'لقد دفعت، أبلغ الفريق',
        'billing.stripe.btn': 'الدفع بالبطاقة ←',
        'billing.msg.redirecting': 'جارٍ التحويل...',
        'billing.msg.error_generic': 'خطأ، حاول مجددًا.',
        'billing.msg.subscribe': 'اشترك',
        'billing.msg.sending': 'جارٍ الإرسال...',
        'billing.msg.ccp_success': '✅ تم إبلاغ الفريق، التفعيل خلال 24 ساعة',
    },
    zh: {
        'billing.title': '选择你的方案',
        'billing.subtitle': '你对 SAMII 的信任度越高，它就能为你独立完成越多操作。',
        'billing.free.eyebrow': '第一档', 'billing.free.tagline': '无需承诺，体验 SAMII。',
        'billing.free.title': '🌑 探索版', 'billing.free.price': '免费',
        'billing.free.li1': '每月150次确认与跟踪',
        'billing.free.li2': 'SAMII 会为每个操作先给出建议，你确认后才会发送',
        'billing.free.li3': '每7小时30条 SAMII 消息',
        'billing.free.li4': '基础包裹跟踪',
        'billing.free.btn': '当前方案',
        'billing.cards.unlocked': '解锁的额外功能',
        'billing.standard.eyebrow': '第二档', 'billing.standard.tagline': '适合已在运营的生意。',
        'billing.standard.title': '🚀 活跃版',
        'billing.standard.li1': '每月2100次确认与跟踪（超出部分每次+0.50$）',
        'billing.standard.li2': '已连接 WhatsApp + Telegram + Shopify',
        'billing.standard.li3': '自动识别VIP忠实客户 + 黑名单',
        'billing.standard.li5': '每月赠送1张高级卡牌',
        'billing.standard.li6': '每7小时50条 SAMII 消息（超出部分每条+0.12$）',
        'billing.pro.eyebrow': '第三档 · 推荐', 'billing.pro.tagline': '再也不用等待批准。',
        'billing.pro.title': '👑 至尊版',
        'billing.pro.li1': '每月30000次确认与跟踪（超出部分每次+0.50$）',
        'billing.pro.li2': '包含活跃版全部，另加：',
        'billing.pro.li3': '准备好的广告无需等待确认，SAMII 立即启动',
        'billing.pro.li4': '每月赠送3张高级卡牌',
        'billing.pro.li5': '优先支持',
        'billing.pro.li6': '每7小时150条 SAMII 消息（超出部分每条+0.12$）',
        'billing.griot.note': '🎨 AI生成（Griot）：0.80$/秒',
        'billing.free.canaux': '任选 1 个渠道 — 例如 Telegram',
        'billing.free.whatsapp': 'WhatsApp：3 天试用，仅一次',
        'billing.standard.canaux': '任选 3 个渠道 — WhatsApp、Telegram、Gmail、Instagram…',
        'billing.standard.publication': '每周自动发布 3 次',
        'billing.pro.canaux': '渠道不限 — Facebook、Instagram、Drive、Sheets…',

        'billing.standard.google': '邮件与日程：SAMII 阅读、回复、安排',
        'billing.free.creatif': '文案、真实照片与视频 — 不限量',
        'billing.standard.rdv': '预约自动接收并确认，无需您动手',
        'billing.standard.ia': 'AI 图片与视频创作 — 按秒计费',
        'billing.standard.topproduits': '热销产品：您所在市场卖得最好的',
        'billing.pro.radar': 'SAMII 自主搜寻商机，并附来源',
        'billing.pro.veille': '持续监测供应商、市场价格与竞争对手',
        'billing.societe.wa': '通过我们已认证的账号接入 WhatsApp Business API',
        'billing.trust4': '全部套餐均享 7×24 小时支持',
        'billing.pro.api': 'API 与 webhook：接入您自己的工具',
        'billing.pro.apps': '可安装第三方应用',
        'billing.pro.publication': 'Facebook 与 Instagram 每天最多发布 2 次',
        'billing.societe.illimite': '确认与消息不设上限',
        'billing.lancement': '首发价格',
       
       
        'billing.step1': '了解各档位', 'billing.step1b': '了解',
        'billing.step2': '选择你的档位', 'billing.step2b': '选择',
        'billing.step3': '支付，立即开始', 'billing.step3b': '支付',
        'billing.societe.eyebrow': '第四档', 'billing.societe.title': '🏛️ 企业版',
        'billing.societe.tagline': '多账户，单一合同。', 'billing.societe.price': '定制报价',
        'billing.societe.li1': '解锁全部额外功能', 'billing.societe.li2': '多账户、多店铺',
        'billing.societe.li3': '专属合同与结算', 'billing.societe.li4': '专属服务支持',
        'billing.societe.ph.email': '你的邮箱', 'billing.societe.ph.message': '描述你的需求（店铺数量、业务量……）',
        'billing.societe.btn': '联系我们',
        'billing.cards.link': '🃏 查看每个档位解锁的卡牌详情 →',
        'billing.trust1': '通过 Chargily 支持 Edahabia / CIB', 'billing.trust2': '支持 CCP 转账',
        'billing.trust3': '随时更改档位',
        'billing.permonth': '/月', 'billing.permonth_filleul': '/月 — 推荐折扣 -5%',
        'billing.ccp.label': '🏦 通过 CCP 支付',
        'billing.ccp.titulaire': '账户持有人：', 'billing.ccp.numero': 'CCP 账号：', 'billing.ccp.cle': 'RIP 密钥：', 'billing.ccp.montant': '需转账金额：',
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
document.getElementById("regulariser-confirm")?.addEventListener("click", async (btnEvent) => {
    const btn = btnEvent.target;
    btn.disabled = true;
    btn.textContent = "...";
    try {
        const res = await fetch("/billing/regulariser-confirmations", { method: "POST" });
        const json = await res.json();
        if (json.url) {
            window.location.href = json.url;
        } else {
            alert(json.error || t('billing.msg.error_generic'));
            btn.disabled = false;
            btn.textContent = "Régulariser →";
        }
    } catch {
        alert(t('billing.msg.error_generic'));
        btn.disabled = false;
        btn.textContent = "Régulariser →";
    }
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

        await journalService.log({ action: "abonnement.demande.societe", details: `Demande de contrat Société — ${email} — ${(message || "").trim()}`, workspaceId: req.session.workspaceId });

        gmail.send({
            to: ADMIN_EMAIL,
            subject: "🏛️ Demande de contrat Société — SAMII",
            html: courriel.construire({
                titre: "Demande palier Société",
                preheader: `Un prospect demande un devis Société — ${email}`,
                corps: courriel.p(`<strong style="color:#f3f1e9;">Email :</strong> ${courriel.echapper(email)}`)
                     + courriel.p(`<strong style="color:#f3f1e9;">Message :</strong><br />${courriel.echapper(message || "—").replace(/\n/g, "<br />")}`),
                cta: { url: `mailto:${email}`, libelle: "Répondre maintenant" },
                lienDeRepli: false,
            }),
        }).catch(() => {});

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /billing/contact-societe :", err.message);
        res.json({ success: false, error: "Erreur interne." });
    }
});

// Régularisation du dépassement de confirmations sur le palier gratuit —
// aucun cycle de renouvellement Chargily n'existe pour lui accrocher la
// dette (réservé aux paliers payants, voir engines/abonnementEngine.js),
// donc un lien de paiement à part est généré à la demande.
router.post("/regulariser-confirmations", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session.workspaceId;
        if (!workspaceId) return res.json({ error: "Aucun workspace actif." });
        if (!chargily.isEnabled()) return res.json({ error: "Paiement Chargily indisponible pour le moment." });

        const url = await confirmationsQuota.genererLienRegularisation(workspaceId);
        if (!url) return res.json({ error: "Rien à régulariser." });
        res.json({ url });
    } catch (err) {
        console.error("❌ POST /billing/regulariser-confirmations :", err.message);
        res.json({ error: "Erreur serveur." });
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
            success_url: `${CONFIG.APP_URL}/billing/success`,
            cancel_url : `${CONFIG.APP_URL}/billing`,
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
        if (!paliers.estAchetable(plan)) return res.json({ success: false, error: "Plan invalide." });
        const workspaceId = req.session.workspaceId;
        const montantDzd = Math.round(devises.depuisUSD(PRIX_AFFICHE[plan], "DZD"));

        await journalService.log({ action: "abonnement.demande.ccp", details: `Demande d'activation ${plan} par virement CCP`, workspaceId });
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
