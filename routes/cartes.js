// ==========================================================================
// SAMII OS — CARTES (outils/moteurs stratégiques débloquables)
// Grille de toutes les cartes du catalogue (config/cartes-catalog.js) :
// débloquées par palier d'abonnement, par grade (progression gratuite),
// ou achetées à l'unité via Chargily.
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");
const chargily = require("../services/chargily");
const CONFIG = require("../config");
const { CARTES, carteEstDebloquee } = require("../config/cartes-catalog");
const { confirmChargilyCartePurchase } = require("../services/orders");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

async function chargerContexte(req) {
    const workspaceId = req.session?.workspaceId;
    // Le palier vient d'abonnementService, jamais d'une lecture directe :
    // c'est ce que voit le marchand sur la grille des cartes, et ça doit être
    // exactement ce que le produit applique derrière.
    const palierWorkspace = workspaceId
        ? await require("../services/abonnementService").getPalier(workspaceId)
        : "free";
    const userRows = await db.query(`SELECT grade_actuel FROM utilisateurs WHERE id = $1`, [req.session.userId]);
    const achatsRows = workspaceId
        ? await db.query(`SELECT carte_id, expire_le FROM cartes_achats WHERE workspace_id = $1 AND statut = 'payée' AND expire_le > now()`, [workspaceId])
        : [];

    const expirations = {};
    achatsRows.forEach(r => { expirations[r.carte_id] = r.expire_le; });

    return {
        workspaceId,
        palierWorkspace,
        gradeClient: userRows[0]?.grade_actuel || "Soldat",
        cartesActivesIds: achatsRows.map(r => r.carte_id),
        expirations,
    };
}

function joursRestants(expireLe) {
    if (!expireLe) return null;
    const ms = new Date(expireLe).getTime() - Date.now();
    return Math.max(1, Math.ceil(ms / 86400000));
}

router.get("/", requireAuth, async (req, res) => {
    // Filet de sécurité : si le webhook Chargily n'est jamais arrivé, on
    // revérifie activement au retour du client sur cette page.
    if (req.query.achat === "ok" && req.session?.workspaceId) {
        try {
            const rows = await db.query(
                `SELECT chargily_checkout_id FROM cartes_achats WHERE workspace_id = $1 AND statut != 'payée' ORDER BY achete_le DESC LIMIT 1`,
                [req.session.workspaceId]
            );
            if (rows[0]?.chargily_checkout_id) await confirmChargilyCartePurchase(rows[0].chargily_checkout_id);
        } catch (err) {
            console.error("❌ Vérification retour achat carte :", err.message);
        }
    }

    const ctx = await chargerContexte(req);

    const cartesHtml = CARTES.map(carte => {
        const debloquee = carteEstDebloquee(carte, ctx);
        const achatActif = ctx.expirations[carte.id];
        const restant = achatActif ? joursRestants(achatActif) : null;

        let action;
        if (debloquee && restant) {
            action = `<a href="${carte.route}" class="carte-btn carte-btn--ouvrir">Ouvrir →</a><div class="carte-expire">⏳ expire dans ${restant} j</div>`;
        } else if (debloquee) {
            action = `<a href="${carte.route}" class="carte-btn carte-btn--ouvrir">Ouvrir →</a>`;
        } else {
            action = `<button class="carte-btn carte-btn--acheter" data-carte="${carte.id}">🔒 ${carte.dureeJours} jours — ${carte.prix.toFixed(2)}€</button>`;
        }

        return `
        <div class="carte ${debloquee ? "carte--ouverte" : "carte--verrouillee"}">
            <div class="carte-icone">${carte.icone}</div>
            <h3>${carte.nom}</h3>
            <p>${carte.description}</p>
            ${action}
        </div>`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Cartes SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .cartes-shell { max-width: 1100px; margin: 0 auto; padding: 40px 24px 80px; }
        .cartes-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.7rem; text-align: center; }
        .cartes-shell p.sub { color: var(--text-muted); text-align: center; font-size: .9rem; margin: 8px 0 30px; }
        .cartes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
        .carte { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
        .carte--verrouillee { opacity: .65; }
        .carte-icone { font-size: 1.8rem; }
        .carte h3 { color: #fff; font-size: .98rem; }
        .carte p { color: var(--text-muted); font-size: .8rem; flex: 1; line-height: 1.5; }
        .carte-btn { margin-top: 6px; padding: 10px; border-radius: 10px; border: none; font-weight: 700; cursor: pointer; font-size: .82rem; text-align: center; text-decoration: none; }
        .carte-btn--ouvrir { background: var(--gold-og); color: #000; }
        .carte-btn--acheter { background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid rgba(255,255,255,0.15); }
        .carte-expire { text-align: center; font-size: .72rem; color: var(--text-muted); margin-top: 4px; }
        .carte-msg { text-align: center; margin-top: 20px; font-size: .82rem; color: #e55; min-height: 18px; }
    </style>
</head>
<body data-theme="og">
<div class="cartes-shell">
    <h1>🃏 Cartes SAMII</h1>
    <p class="sub">Chaque carte est un outil stratégique. Débloque-les via ton abonnement, ta progression de grade, ou à l'unité pour une durée limitée.</p>
    <div class="cartes-grid">${cartesHtml}</div>
    <div class="carte-msg" id="msg"></div>
</div>

<script>
document.querySelectorAll(".carte-btn--acheter").forEach(btn => {
    btn.addEventListener("click", async () => {
        const carteId = btn.dataset.carte;
        btn.disabled = true;
        btn.textContent = "Redirection...";
        try {
            const res = await fetch("/cartes/acheter/" + carteId, { method: "POST" });
            const data = await res.json();
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                document.getElementById("msg").textContent = data.error || "Erreur, réessaie.";
                btn.disabled = false;
                btn.textContent = "🔒 Débloquer";
            }
        } catch (err) {
            document.getElementById("msg").textContent = "Erreur réseau.";
            btn.disabled = false;
        }
    });
});
</script>
</body>
</html>`);
});

router.post("/acheter/:carteId", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.json({ success: false, error: "Aucun espace actif." });

        const carte = CARTES.find(c => c.id === req.params.carteId);
        if (!carte || !carte.prix) return res.json({ success: false, error: "Carte introuvable." });

        if (!chargily.isEnabled()) return res.json({ success: false, error: "Paiement en ligne indisponible pour le moment." });

        const active = await db.query(
            `SELECT 1 FROM cartes_achats WHERE workspace_id = $1 AND carte_id = $2 AND statut = 'payée' AND expire_le > now()`,
            [workspaceId, carte.id]
        );
        if (active[0]) return res.json({ success: false, error: "Carte déjà active — attends l'expiration pour la racheter." });

        await db.query(
            `INSERT INTO cartes_achats (workspace_id, carte_id, prix_paye, devise, statut, expire_le)
             VALUES ($1,$2,$3,'EUR','en attente',NULL)
             ON CONFLICT (workspace_id, carte_id) DO UPDATE SET statut = 'en attente', expire_le = NULL`,
            [workspaceId, carte.id, carte.prix]
        );

        const montantDzd = Math.round(carte.prix * CONFIG.CHARGILY.EUR_TO_DZD_RATE);
        const checkout = await chargily.createCheckout({
            amount: montantDzd,
            currency: "dzd",
            description: `Carte SAMII — ${carte.nom}`,
            successUrl: `${CONFIG.APP_URL}/cartes?achat=ok`,
            failureUrl: `${CONFIG.APP_URL}/cartes?achat=echec`,
            webhookUrl: `${CONFIG.APP_URL}/webhook/chargily`,
            metadata: { type: "carte", workspace_id: workspaceId, carte_id: carte.id },
        });

        if (!checkout.success) return res.json({ success: false, error: "Erreur lors de la création du paiement." });

        await db.query(`UPDATE cartes_achats SET chargily_checkout_id = $1 WHERE workspace_id = $2 AND carte_id = $3`,
            [checkout.checkoutId, workspaceId, carte.id]);

        res.json({ success: true, checkoutUrl: checkout.checkoutUrl });
    } catch (err) {
        console.error("❌ POST /cartes/acheter :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
