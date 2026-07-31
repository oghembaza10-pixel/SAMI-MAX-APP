const express = require("express");
const router   = express.Router();

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const CARDS = [
    { loi: "T-001", name: "Genèse",            icon: "sparkle",       desc: "Identité fondatrice de ta marque", available: false },
    { loi: "T-002", name: "Code d'Honneur",     icon: "scroll",        desc: "Charte éthique envers tes clients", available: false },
    { loi: "T-003", name: "Vision Clients",     icon: "eye",           desc: "Analyse du sentiment client", available: false },
   { loi: "T-004", name: "Œil Concurrentiel", icon: "search", desc: "Surveillance des prix concurrents", available: true, href: "/samii/oeil-concurrentiel" },
   { loi: "T-005", name: "Diplomate", icon: "message-circle", desc: "Réponse automatique aux avis négatifs", available: true, href: "/samii/diplomate" },
   { loi: "T-006", name: "Mémoire Client", icon: "brain", desc: "Historique relationnel enrichi", available: true, href: "/samii/memoire-client" },
    { loi: "T-007", name: "Bibliothèque SAMII", icon: "book-open",     desc: "Base de connaissance de ton métier", available: false },
    { loi: "T-008", name: "Commandement",       icon: "sliders-horizontal", desc: "Les 5 modes d'autonomie de SAMII", available: true, href: "/samii/mode" },
    { loi: "T-009", name: "Messager Éclair", icon: "zap", desc: "Suivi colis et notifications client en temps réel", available: true, href: "/samii/messager-eclair" },
    { loi: "T-010", name: "Verrou de Sécurité", icon: "lock",          desc: "Protection renforcée de ton compte", available: false },
    { loi: "T-011", name: "Cadence",            icon: "music",         desc: "Rythme optimal de publication", available: false },
    { loi: "T-012", name: "Chronomaître",       icon: "clock",         desc: "Planification multi-fuseaux horaires", available: false },
   { loi: "T-013", name: "Sérénité", icon: "leaf", desc: "Rapport quotidien apaisé, chaque soir à 22h", available: true, href: "/samii" },
   { loi: "T-014", name: "Miroir", icon: "circle-dot", desc: "Auto-diagnostic de ton activité", available: true, href: "/samii/miroir" },
    { loi: "T-015", name: "Oracle Financier", icon: "line-chart", desc: "Prévisions de revenus", available: true, href: "/samii/oracle-financier" },
    { loi: "T-016", name: "Vérité Absolue",     icon: "bar-chart-2",   desc: "Rapport détaillé produits/zones performants", available: false },
    { loi: "T-017", name: "Constitution",       icon: "gavel",         desc: "Règles business par défaut", available: false },
    { loi: "T-018", name: "Évolution",          icon: "trending-up",   desc: "SAMII apprend de tes résultats", available: false },
    { loi: "T-019", name: "Verbe Adaptatif",    icon: "languages",     desc: "Ton de communication ajusté automatiquement", available: false },
    { loi: "T-020", name: "Boost Marketing",    icon: "megaphone",     desc: "Création et gestion de campagnes publicitaires", available: true, href: "/ads/create" },
    { loi: "T-021", name: "Forteresse",         icon: "shield",        desc: "Protège ta réputation pendant 7 jours", available: true, href: "/coffre" },
    { loi: "T-022", name: "Bouclier Anti-Fraude", icon: "shield-alert", desc: "Vérification renforcée des commandes à risque", available: false },
    { loi: "T-023", name: "Radar Opportunités", icon: "radar",         desc: "Analyse quotidienne de tendances", available: false },
   { loi: "T-024", name: "Chasseur de Stock", icon: "package-search", desc: "Alertes de réapprovisionnement intelligentes", available: true, href: "/samii/chasseur-stock" },
    { loi: "T-025", name: "Ambassadeur",        icon: "heart-handshake", desc: "Offres de fidélité pour tes clients VIP", available: false },
    { loi: "T-026", name: "Griot",              icon: "feather",       desc: "Storytelling automatique de ta marque", available: false },
    { loi: "T-027", name: "Artillerie Promo",   icon: "rocket",        desc: "Génère et programme une campagne flash", available: false },
    { loi: "T-028", name: "Sanctuaire",         icon: "moon",          desc: "Temps protégé sans interruption", available: false },
    { loi: "T-029", name: "Chronos",            icon: "hourglass",     desc: "Automatisation calendaire avancée", available: false },
    { loi: "T-030", name: "Cartographe",        icon: "map",           desc: "Carte de performance par région", available: false },
    { loi: "T-031", name: "Scalpel",            icon: "scissors",      desc: "Aide à la décision rapide", available: false },
    { loi: "T-032", name: "Sceau",              icon: "stamp",         desc: "Validation finale avant action critique", available: false },
    { loi: "T-033", name: "Souverain",          icon: "crown",         desc: "Autonomie quasi-totale sur ta stratégie", available: true, href: "/samii/mode" },
    { loi: "—",     name: "Boost Visibilité",   icon: "star",          desc: "Augmente ta visibilité pendant 3 jours", available: true, href: "/coffre" },
];

router.get("/", requireAuth, (req, res) => {
    const cardsHtml = CARDS.map(c => {
        const tag = c.available
            ? `<a href="${c.href}" class="ars33-card ars33-card--on">`
            : `<div class="ars33-card">`;
        const closeTag = c.available ? "</a>" : "</div>";

        return `${tag}
            <span class="ars33-loi">${c.loi}</span>
            <div class="ars33-icon"><i data-lucide="${c.icon}"></i></div>
            <h3>${c.name}</h3>
            <p>${c.desc}</p>
            <span class="ars33-badge ars33-badge-item ${c.available ? "ars33-badge--on" : ""}" data-available="${c.available}">
                ${c.available ? "Disponible" : "Bientôt disponible"}
            </span>
        ${closeTag}`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Arsenal — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
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
        .og-lang-switch { display: flex; justify-content: flex-start; gap: 10px; margin-bottom: 24px; font-family: var(--font-mono); font-size: .72rem; }
        .og-lang-switch span { cursor: pointer; color: var(--text-muted); padding: 4px 8px; border-radius: 4px; transition: color .2s ease; }
        .og-lang-switch span:hover { color: var(--cyan-tech); }
        .og-lang-switch span.active { color: var(--cyan-tech); font-weight: 600; }
    </style>
</head>
<body>
<div class="ars33-shell">
    <div class="og-lang-switch">
        <span data-lang-btn="fr">FR</span>
        <span data-lang-btn="en">EN</span>
        <span data-lang-btn="ar">AR</span>
        <span data-lang-btn="zh">ZH</span>
    </div>
    <h1>⚔️ <span data-i18n="arsenal.title">L'Arsenal</span></h1>
    <p class="sub" data-i18n="arsenal.subtitle">33 pouvoirs, chacun ancré dans une loi de SAMII. Débloqués progressivement.</p>
    <div class="ars33-grid">${cardsHtml}</div>
</div>
<script src="https://unpkg.com/lucide@latest"></script>
<script src="/js/i18n.js"></script>
<script>
    if (typeof lucide !== "undefined") lucide.createIcons();

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

module.exports = router;
