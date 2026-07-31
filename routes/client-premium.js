// ==========================================================================
// SAMII OS — CLIENT : PREMIUM — Abonnement (CCP manuel + Stripe automatique)
// ==========================================================================
const express = require("express");
const router  = express.Router();
const axios   = require("axios");
const stripe  = require("stripe")(process.env.STRIPE_SECRET_KEY);
const CONFIG  = require("../config");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_USERS      = process.env.TABLE_UTILISATEURS || "UTILISATEURS";

// ⚠️ À remplacer par tes vraies coordonnées CCP
const CCP_INFOS = {
    numero: "0000000000 00",
    cle: "00",
    titulaire: "OG EMPIRE",
};

const PRIX_PREMIUM = { montant: "1500", devise: "DZD", stripeAmountCents: 500 }; // ~5$ exemple

router.get("/", requireAuth, async (req, res) => {
    let abonnementActuel = "gratuit";
    try {
        const search = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}?filterByFormula={email}="${req.session.email}"`,
            { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
        );
        abonnementActuel = search.data.records[0]?.fields?.abonnement || "gratuit";
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
        .pr-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
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
    <a href="/client-qg" class="pr-back">← Retour à mon espace</a>

    <div class="pr-hero">
        <div class="pr-hero-icon">👑</div>
        <h1>SAMII Premium</h1>
        <p>Débloque tout le potentiel de SAMII, sans limite.</p>
    </div>

    ${abonnementActuel === "premium" ? `
    <div class="pr-status">✅ Tu es déjà Premium — profite de tout SAMII sans limite !</div>
    ` : `
    <div class="pr-features">
        <div class="pr-feature"><span class="check">✓</span><span>Messages SAMII illimités, chaque jour</span></div>
        <div class="pr-feature"><span class="check">✓</span><span>SAMII gère tes réseaux sociaux et répond à ta place</span></div>
        <div class="pr-feature"><span class="check">✓</span><span>Accès prioritaire aux nouvelles fonctionnalités</span></div>
        <div class="pr-feature"><span class="check">✓</span><span>Badge Premium visible sur ton profil</span></div>
    </div>

    <div class="pr-options">
        <div class="pr-option">
            <h3>💳 Carte bancaire</h3>
            <p>Paiement instantané, activation immédiate</p>
            <button class="pr-btn pr-btn--stripe" id="btn-stripe">Payer avec Stripe</button>
        </div>
        <div class="pr-option">
            <h3>🏦 CCP</h3>
            <p>Virement manuel, validation sous 24h</p>
            <button class="pr-btn pr-btn--ccp" id="btn-ccp">Payer par CCP</button>
        </div>
    </div>

    <div class="pr-ccp-details" id="ccp-details">
        <div class="pr-ccp-row"><span>Numéro CCP</span><span>${CCP_INFOS.numero}</span></div>
        <div class="pr-ccp-row"><span>Clé</span><span>${CCP_INFOS.cle}</span></div>
        <div class="pr-ccp-row"><span>Titulaire</span><span>${CCP_INFOS.titulaire}</span></div>
        <div class="pr-ccp-row"><span>Montant</span><span>${PRIX_PREMIUM.montant} ${PRIX_PREMIUM.devise}</span></div>

        <form class="pr-ccp-form" id="form-ccp">
            <label style="display:block;color:var(--text-muted);font-size:.75rem;margin-top:14px;">Référence du virement / preuve (optionnel)</label>
            <textarea name="preuve" placeholder="Ex : numéro de transaction, ou toute info utile pour identifier ton virement"></textarea>
            <button type="submit" class="pr-btn pr-btn--ccp" style="width:100%;margin-top:10px;">J'ai effectué le virement</button>
        </form>
        <div class="pr-msg" id="msg-ccp"></div>
    </div>
    `}
</div>

<script>
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
    msg.textContent = '⏳ Envoi...';
    msg.className = 'pr-msg';

    const res  = await fetch('/client-qg/premium/ccp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) {
        msg.textContent = '✅ Reçu ! On valide ton paiement sous 24h.';
        msg.className = 'pr-msg ok';
    } else {
        msg.textContent = json.error || '❌ Erreur.';
    }
});
</script>
</body>
</html>`);
});

router.post("/ccp", requireAuth, async (req, res) => {
    try {
        const { preuve } = req.body;

        const search = await axios.get(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}?filterByFormula={email}="${req.session.email}"`,
            { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
        );
        const record = search.data.records[0];
        if (!record) return res.json({ success: false, error: "Utilisateur introuvable." });

        await axios.patch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_USERS}/${record.id}`,
            { fields: { statut_paiement_ccp: "en_attente", preuve_paiement_ccp: preuve || "Pas de preuve fournie" } },
            { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" } }
        );

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
