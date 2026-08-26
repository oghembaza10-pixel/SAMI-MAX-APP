const express = require("express");
const router   = express.Router();
const db = require("../services/db");
const gradeService = require("../services/gradeService");
const chargily = require("../services/chargily");
const CONFIG = require("../config");
const { mobileNav } = require("../views/partials/mobileNav");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// tier : palier de grade (index dans gradeService.SEUILS) requis pour débloquer
// gratuitement par progression. 33 lois réparties en 6 paliers (Soldat →
// Général), ~5-6 lois par palier. Chaque loi de tier >= 1 est aussi
// achetable à l'unité (prix EUR, durée en jours) pour la débloquer avant
// d'avoir atteint le grade/abonnement requis — même mécanisme que
// config/cartes-catalog.js (table cartes_achats, Chargily).
const PRIX_PAR_TIER = {
    1: { prix: 1.99, dureeJours: 7 },
    2: { prix: 2.99, dureeJours: 5 },
    3: { prix: 3.49, dureeJours: 4 },
    4: { prix: 3.99, dureeJours: 3 },
    5: { prix: 4.99, dureeJours: 3 },
};

const CARDS = [
    { loi: "T-001", name: "Genèse",            icon: "sparkle",       desc: "Identité fondatrice de ta marque", tier: 0, href: "/samii" },
    { loi: "T-002", name: "Code d'Honneur",     icon: "scroll",        desc: "Charte éthique envers tes clients", tier: 0, href: "/samii" },
    { loi: "T-003", name: "Vision Clients",     icon: "eye",           desc: "Analyse du sentiment client", tier: 0, href: "/samii" },
    { loi: "T-004", name: "Œil Concurrentiel",  icon: "search",        desc: "Surveillance des prix concurrents", tier: 0, href: "/samii/oeil-concurrentiel" },
    { loi: "T-005", name: "Diplomate",          icon: "message-circle",desc: "Réponse automatique aux avis négatifs", tier: 0, href: "/samii/diplomate" },
    { loi: "T-006", name: "Mémoire Client",     icon: "brain",         desc: "Historique relationnel enrichi", tier: 1, href: "/samii/memoire-client" },
    { loi: "T-007", name: "Bibliothèque SAMII", icon: "book-open",     desc: "Base de connaissance de ton métier", tier: 1, href: "/samii" },
    { loi: "T-008", name: "Commandement",       icon: "sliders-horizontal", desc: "Les 5 modes d'autonomie de SAMII", tier: 1, href: "/samii/mode" },
    { loi: "T-009", name: "Messager Éclair",    icon: "zap",           desc: "Suivi colis et notifications client en temps réel", tier: 1, href: "/samii/messager-eclair" },
    { loi: "T-010", name: "Verrou de Sécurité", icon: "lock",          desc: "Protection renforcée de ton compte", tier: 1, href: "/settings" },
    { loi: "T-011", name: "Cadence",            icon: "music",         desc: "Rythme optimal de publication", tier: 1, href: "/samii" },
    { loi: "T-012", name: "Chronomaître",       icon: "clock",         desc: "Planification multi-fuseaux horaires", tier: 2, href: "/samii" },
    { loi: "T-013", name: "Sérénité",           icon: "leaf",          desc: "Rapport quotidien apaisé, chaque soir à 22h", tier: 2, href: "/samii" },
    { loi: "T-014", name: "Miroir",             icon: "circle-dot",    desc: "Auto-diagnostic de ton activité", tier: 2, href: "/samii/miroir" },
    { loi: "T-015", name: "Oracle Financier",   icon: "line-chart",    desc: "Prévisions de revenus", tier: 2, href: "/samii/oracle-financier" },
    { loi: "T-016", name: "Vérité Absolue",     icon: "bar-chart-2",   desc: "Rapport détaillé produits/zones performants", tier: 2, href: "/samii" },
    { loi: "T-017", name: "Constitution",       icon: "gavel",         desc: "Règles business par défaut", tier: 2, href: "/samii" },
    { loi: "T-018", name: "Évolution",          icon: "trending-up",   desc: "SAMII apprend de tes résultats", tier: 3, href: "/samii" },
    { loi: "T-019", name: "Verbe Adaptatif",    icon: "languages",     desc: "Ton de communication ajusté automatiquement", tier: 3, href: "/samii" },
    { loi: "T-020", name: "Boost Marketing",    icon: "megaphone",     desc: "Création et gestion de campagnes publicitaires", tier: 3, href: "/ads/create" },
    { loi: "T-021", name: "Forteresse",         icon: "shield",        desc: "Protège ta réputation pendant 7 jours", tier: 3, href: "/coffre" },
    { loi: "T-022", name: "Bouclier Anti-Fraude", icon: "shield-alert", desc: "Vérification renforcée des commandes à risque", tier: 3, href: "/samii" },
    { loi: "T-023", name: "Radar Opportunités", icon: "radar",         desc: "Analyse quotidienne de tendances", tier: 4, href: "/samii/opportunites" },
    { loi: "T-024", name: "Chasseur de Stock",  icon: "package-search",desc: "Alertes de réapprovisionnement intelligentes", tier: 4, href: "/samii/chasseur-stock" },
    { loi: "T-025", name: "Ambassadeur",        icon: "heart-handshake", desc: "Offres de fidélité pour tes clients VIP", tier: 4, href: "/samii" },
    { loi: "T-026", name: "Griot",              icon: "feather",       desc: "Storytelling automatique de ta marque", tier: 4, href: "/samii/griot" },
    { loi: "T-027", name: "Artillerie Promo",   icon: "rocket",        desc: "Génère et programme une campagne flash", tier: 4, href: "/samii" },
    { loi: "T-028", name: "Sanctuaire",         icon: "moon",          desc: "Temps protégé sans interruption", tier: 5, href: "/samii" },
    { loi: "T-029", name: "Chronos",            icon: "hourglass",     desc: "Automatisation calendaire avancée", tier: 5, href: "/automatisations" },
    { loi: "T-030", name: "Cartographe",        icon: "map",           desc: "Carte de performance par région", tier: 5, href: "/samii" },
    { loi: "T-031", name: "Scalpel",            icon: "scissors",      desc: "Aide à la décision rapide", tier: 5, href: "/samii" },
    { loi: "T-032", name: "Sceau",              icon: "stamp",         desc: "Validation finale avant action critique", tier: 5, href: "/samii" },
    { loi: "T-033", name: "Souverain",          icon: "crown",         desc: "Lance directement tes actions déjà prêtes, sans validation finale", tier: 5, href: "/samii/mode" },
    { loi: "T-034", name: "Boost Visibilité",   icon: "star",          desc: "Augmente ta visibilité pendant 3 jours", tier: 0, href: "/coffre" },
].map(c => ({ ...c, ...(PRIX_PAR_TIER[c.tier] || { prix: null, dureeJours: null }) }));

// Abonnement gratuit : plafonné au palier Sergent (index 2, T-001 à T-017).
// Un abonnement payant permet de débloquer jusqu'au palier atteint par le grade.
const PALIER_MAX_GRATUIT = 2;

router.get("/", requireAuth, async (req, res) => {
    let tierAtteint = 0;
    // Palier réel du workspace marchand (Actif/Souverain, routes/billing.js) —
    // pas utilisateurs.abonnement, qui est le micro-abonnement personnel à 5$
    // sans rapport avec l'abonnement business (même confusion déjà corrigée
    // dans services/samiiQuota.js).
    let palierWorkspace = "free";
    let achatsActifsIds = [];

    try {
        const rows = await db.query(`SELECT grade_actuel FROM utilisateurs WHERE id = $1`, [req.session.userId]);
        if (rows[0]) {
            const idx = gradeService.SEUILS.findIndex(s => s.grade === (rows[0].grade_actuel || "Soldat"));
            tierAtteint = idx >= 0 ? idx : 0;
        }
        if (req.session.workspaceId) {
            // Par abonnementService, jamais en lisant palier_abonnement :
            // un second juge finit toujours par juger autrement.
            palierWorkspace = await require("../services/abonnementService").getPalier(req.session.workspaceId);

            const achatsRows = await db.query(
                `SELECT carte_id FROM cartes_achats WHERE workspace_id = $1 AND statut = 'payée' AND expire_le > now()`,
                [req.session.workspaceId]
            );
            achatsActifsIds = achatsRows.map(r => r.carte_id);
        }
    } catch (err) {
        console.error("❌ GET /arsenal (grade) :", err.message);
    }

    const tierMax = palierWorkspace === "free" ? Math.min(tierAtteint, PALIER_MAX_GRATUIT) : tierAtteint;

    const cardsHtml = CARDS.map(c => {
        const achetee = achatsActifsIds.includes(c.loi);
        const available = c.tier <= tierMax || achetee;
        const tag = available
            ? `<a href="${c.href}" class="ars33-card ars33-card--on">`
            : `<div class="ars33-card">`;
        const closeTag = available ? "</a>" : "</div>";
        const badgeLabel = available
            ? "Disponible"
            : (palierWorkspace === "free" && c.tier > PALIER_MAX_GRATUIT ? "Abonnement requis" : "Grade insuffisant");
        const acheterHtml = (!available && c.prix)
            ? `<button type="button" class="ars33-acheter" data-loi="${c.loi}">🔒 ${c.dureeJours}j — ${c.prix.toFixed(2)}€</button>`
            : "";

        return `${tag}
            <span class="ars33-loi">${c.loi}</span>
            <div class="ars33-icon"><i data-lucide="${c.icon}"></i></div>
            <h3>${c.name}</h3>
            <p>${c.desc}</p>
            <span class="ars33-badge ars33-badge-item ${available ? "ars33-badge--on" : ""}" data-available="${available}">
                ${badgeLabel}
            </span>
            ${acheterHtml}
        ${closeTag}`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Arsenal — SAMII</title>
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#070809">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css?v=2">
    <style>
        .ars33-shell { max-width: 1100px; margin: 0 auto; padding: 40px 24px 80px; }
        .ars33-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.8rem; margin-bottom: 6px; }
        .ars33-shell p.sub { color: var(--text-muted); font-size: .88rem; margin-bottom: 20px; }
        .ars33-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
        .ars33-card {
            position: relative; background: var(--bg-glass); backdrop-filter: blur(10px);
            border: var(--border-soft); border-radius: 14px; padding: 18px;
            display: flex; flex-direction: column; gap: 8px; text-decoration: none;
            opacity: .55; transition: all .2s ease;
        }
        .ars33-card--on { opacity: 1; cursor: pointer; }
        .ars33-card--on:hover { border-color: rgba(197,160,89,0.4); transform: translateY(-3px); }
        .ars33-loi { font-family: var(--font-mono); font-size: .62rem; color: var(--cyan-tech); letter-spacing: .05em; }
        .ars33-icon { width: 32px; height: 32px; border-radius: 8px; background: rgba(197,160,89,0.12); color: var(--gold-og); display: flex; align-items: center; justify-content: center; margin: 2px 0; }
        .ars33-card h3 { color: #fff; font-size: .88rem; }
        .ars33-card p { color: var(--text-muted); font-size: .74rem; line-height: 1.4; flex: 1; }
        .ars33-badge { font-family: var(--font-mono); font-size: .6rem; padding: 2px 8px; border-radius: 20px; background: rgba(255,255,255,0.06); color: var(--text-muted); align-self: flex-start; }
        .ars33-badge--on { background: rgba(61,220,132,0.12); color: #3ddc84; }
        .ars33-acheter { margin-top: 4px; padding: 8px; border-radius: 8px; border: 1px solid rgba(197,160,89,0.3); background: rgba(197,160,89,0.1); color: var(--gold-og); font-size: .72rem; font-weight: 700; cursor: pointer; }
        .ars33-acheter:disabled { opacity: .6; cursor: not-allowed; }
        .ars33-msg { text-align: center; margin-top: 16px; font-size: .82rem; color: #e55; min-height: 18px; }
        .og-lang-switch { display: flex; justify-content: flex-start; gap: 10px; margin-bottom: 24px; font-family: var(--font-mono); font-size: .72rem; }
        .og-lang-switch span { cursor: pointer; color: var(--text-muted); padding: 4px 8px; border-radius: 4px; transition: color .2s ease; }
        .og-lang-switch span:hover { color: var(--cyan-tech); }
        .og-lang-switch span.active { color: var(--cyan-tech); font-weight: 600; }
        .ars33-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 16px; transition: color .2s ease; }
        .ars33-back:hover { color: var(--cyan-tech); }
        .mobile-nav { display: none; }
        @media (max-width: 900px) {
            .ars33-shell { padding-bottom: 90px; }
            .ars33-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
            .ars33-card { padding: 16px 14px; font-size: .85rem; }
            .mobile-nav {
                position: fixed; left: 0; right: 0; bottom: 0;
                display: flex; justify-content: space-around;
                padding: 9px; background: rgba(3,6,11,.95);
                border-top: var(--border-soft); z-index: 30;
            }
            .mobile-nav a { display: flex; flex-direction: column; align-items: center; gap: 3px; color: var(--text-muted); text-decoration: none; font-size: 8px; font-weight: 800; }
            .mobile-nav a.active { color: var(--cyan-tech); }
            .mobile-nav svg { width: 17px; }
        }
    </style>
</head>
<body data-theme="og">
<div class="ars33-shell">
    <a href="/qg" class="ars33-back"><i data-lucide="arrow-left"></i> Retour au QG</a>
    <div class="og-lang-switch">
        <span data-lang-btn="fr">FR</span>
        <span data-lang-btn="en">EN</span>
        <span data-lang-btn="ar">AR</span>
        <span data-lang-btn="zh">ZH</span>
    </div>
    <h1>⚔️ <span data-i18n="arsenal.title">L'Arsenal</span></h1>
    <p class="sub" data-i18n="arsenal.subtitle">33 pouvoirs, chacun ancré dans une loi de SAMII. Débloqués progressivement.</p>
    <div class="ars33-grid">${cardsHtml}</div>
    <div class="ars33-msg" id="ars33-msg"></div>
</div>
${mobileNav("/arsenal")}
<script src="https://unpkg.com/lucide@latest"></script>
<script src="/js/i18n.js"></script>
<script src="/js/pwa-register.js"></script>
<script>
    if (typeof lucide !== "undefined") lucide.createIcons();

    document.querySelectorAll(".ars33-acheter").forEach(btn => {
        btn.addEventListener("click", async () => {
            const loi = btn.dataset.loi;
            const msg = document.getElementById("ars33-msg");
            btn.disabled = true;
            btn.textContent = "Redirection...";
            try {
                const res = await fetch("/arsenal/acheter/" + loi, { method: "POST" });
                const data = await res.json();
                if (data.checkoutUrl) {
                    window.location.href = data.checkoutUrl;
                } else {
                    msg.textContent = data.error || "Erreur, réessaie.";
                    btn.disabled = false;
                    btn.textContent = "🔒 Débloquer";
                }
            } catch (err) {
                msg.textContent = "Erreur réseau.";
                btn.disabled = false;
            }
        });
    });

    function updateArsenalBadges(dict) {
        const onText  = dict?.arsenal?.available || "Disponible";
        const offText = dict?.arsenal?.soon || "Bientôt disponible";
        document.querySelectorAll(".ars33-badge-item").forEach(badge => {
            const isAvailable = badge.getAttribute("data-available") === "true";
            badge.textContent = isAvailable ? onText : offText;
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (typeof Language !== "undefined" && Language.onChange) {
            Language.onChange((lang, dict) => updateArsenalBadges(dict));
        }
    });
</script>
</body>
</html>`);
});

// Achat à l'unité d'une loi de l'Arsenal — même mécanisme que config/cartes-
// catalog.js (table cartes_achats, Chargily) : carte_id accepte n'importe
// quel identifiant texte, donc les "T-0XX" fonctionnent sans table à part.
router.post("/acheter/:loi", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.json({ success: false, error: "Aucun espace actif." });

        const loi = CARDS.find(c => c.loi === req.params.loi);
        if (!loi || !loi.prix) return res.json({ success: false, error: "Loi introuvable ou non achetable." });

        if (!chargily.isEnabled()) return res.json({ success: false, error: "Paiement en ligne indisponible pour le moment." });

        const active = await db.query(
            `SELECT 1 FROM cartes_achats WHERE workspace_id = $1 AND carte_id = $2 AND statut = 'payée' AND expire_le > now()`,
            [workspaceId, loi.loi]
        );
        if (active[0]) return res.json({ success: false, error: "Déjà active — attends l'expiration pour la racheter." });

        await db.query(
            `INSERT INTO cartes_achats (workspace_id, carte_id, prix_paye, devise, statut, expire_le)
             VALUES ($1,$2,$3,'EUR','en attente',NULL)
             ON CONFLICT (workspace_id, carte_id) DO UPDATE SET statut = 'en attente', expire_le = NULL`,
            [workspaceId, loi.loi, loi.prix]
        );

        const montantDzd = Math.round(loi.prix * CONFIG.CHARGILY.EUR_TO_DZD_RATE);
        const checkout = await chargily.createCheckout({
            amount: montantDzd,
            currency: "dzd",
            description: `Arsenal SAMII — ${loi.loi} ${loi.name}`,
            successUrl: `${CONFIG.APP_URL}/arsenal?achat=ok`,
            failureUrl: `${CONFIG.APP_URL}/arsenal?achat=echec`,
            webhookUrl: `${CONFIG.APP_URL}/webhook/chargily`,
            metadata: { type: "carte", workspace_id: workspaceId, carte_id: loi.loi },
        });

        if (!checkout.success) return res.json({ success: false, error: "Erreur lors de la création du paiement." });

        await db.query(`UPDATE cartes_achats SET chargily_checkout_id = $1 WHERE workspace_id = $2 AND carte_id = $3`,
            [checkout.checkoutId, workspaceId, loi.loi]);

        res.json({ success: true, checkoutUrl: checkout.checkoutUrl });
    } catch (err) {
        console.error("❌ POST /arsenal/acheter :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
module.exports.CARDS = CARDS;
module.exports.PALIER_MAX_GRATUIT = PALIER_MAX_GRATUIT;
