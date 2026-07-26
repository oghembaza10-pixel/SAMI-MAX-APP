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

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const PLAN_GRANTS = {
    standard: { forteresse: 1, boost: 0 },
    pro      : { forteresse: 2, boost: 1 },
};

let stripe = null;
try {
    stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
} catch {
    console.warn("⚠️ Module 'stripe' non installé — lance `npm install stripe` sur ton projet.");
}

router.get("/", requireAuth, (req, res) => {
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
        .bill-card h2 { color: #fff; font-size: 1.1rem; }
        .bill-price { font-family: var(--font-display); font-size: 1.8rem; color: var(--gold-og); margin: 12px 0; }
        .bill-price span { font-size: .85rem; color: var(--text-muted); }
        .bill-card ul { list-style: none; margin: 14px 0 20px; flex: 1; }
        .bill-card li { color: var(--text-muted); font-size: .85rem; padding: 5px 0; }
        .bill-card li::before { content: "✓ "; color: var(--cyan-tech); }
        .bill-btn { padding: 12px; border-radius: 10px; border: none; background: var(--gold-og); color: #000; font-weight: 700; cursor: pointer; }
        .bill-btn--free { background: rgba(255,255,255,0.08); color: var(--text-main); }
    </style>
</head>
<body>
<div class="bill-shell">
    <h1>👑 Choisis ton palier</h1>
    <p class="sub">Plus tu fais confiance à SAMII, plus il peut agir seul pour toi.</p>
    <div class="bill-grid">
        <div class="bill-card">
            <h2>🌑 Découverte</h2>
            <div class="bill-price">Gratuit</div>
            <ul>
                <li>10 confirmations/jour</li>
                <li>Modes Ombre + Copilote</li>
                <li>10 messages stratégie/mois</li>
            </ul>
            <button class="bill-btn bill-btn--free" disabled>Plan actuel</button>
        </div>
        <div class="bill-card">
            <h2>🚀 Actif</h2>
            <div class="bill-price">9,99$ <span>/mois</span></div>
            <ul>
                <li>100 confirmations/jour</li>
                <li>WhatsApp + Telegram + Shopify</li>
                <li>+ Mode Stratège débloqué</li>
                <li>Messages illimités</li>
            </ul>
            <button class="bill-btn" data-plan="standard">S'abonner</button>
        </div>
        <div class="bill-card bill-card--pro">
            <h2>👑 Souverain</h2>
            <div class="bill-price">29,99$ <span>/mois</span></div>
            <ul>
                <li>1000 confirmations/jour</li>
                <li>Tout le plan Actif +</li>
                <li>Modes Autonome et Souverain</li>
                <li>Support prioritaire</li>
            </ul>
            <button class="bill-btn" data-plan="pro">S'abonner</button>
        </div>
    </div>
</div>
<script>
document.querySelectorAll(".bill-btn[data-plan]").forEach(btn => {
    btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Redirection...";
        const res = await fetch("/billing/checkout", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: btn.dataset.plan }),
        });
        const json = await res.json();
        if (json.url) {
            window.location.href = json.url;
        } else {
            alert(json.error || "Erreur, réessaye.");
            btn.disabled = false;
            btn.textContent = "S'abonner";
        }
    });
});
</script>
</body>
</html>`);
});

router.post("/checkout", requireAuth, async (req, res) => {
    if (!stripe) return res.json({ error: "Stripe non configuré côté serveur." });

    try {
        const { plan } = req.body;
        const priceId = plan === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_STANDARD;
        if (!priceId) return res.json({ error: "Plan invalide." });

        const workspace = await workspaceService.getById(req.session.workspaceId);
        if (!workspace) return res.json({ error: "Workspace introuvable." });

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [{ price: priceId, quantity: 1 }],
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

router.get("/success", requireAuth, (req, res) => {
    res.send(`<!DOCTYPE html><html><body style="background:#050505;color:white;font-family:Arial;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;">
        <div><h1 style="color:#3ddc84;">✅ Abonnement activé !</h1><p><a href="/qg" style="color:#C5A059;">Retour au QG</a></p></div>
    </body></html>`);
});

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
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
                    const grant = PLAN_GRANTS[plan] || { forteresse: 0, boost: 0 };
                    const currentCoffre = workspace.coffre || {};

                    await workspaceService.update(workspace.recordId, {
                        coffre: JSON.stringify({
                            forteresse: {
                                charges: (currentCoffre.forteresse?.charges || 0) + grant.forteresse,
                                activeUntil: currentCoffre.forteresse?.activeUntil || null,
                            },
                            boost: {
                                charges: (currentCoffre.boost?.charges || 0) + grant.boost,
                                activeUntil: currentCoffre.boost?.activeUntil || null,
                            },
                        }),
                        samii: JSON.stringify({ ...workspace.samii, plan }),
                    });

                    console.log(`✅ Abonnement ${plan} activé pour ${workspaceId}`);
                }
            } catch (err) {
                console.error("❌ Erreur mise à jour après paiement :", err.message);
            }
        }
    }

    res.json({ received: true });
});

module.exports = router;
