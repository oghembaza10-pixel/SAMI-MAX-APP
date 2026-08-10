// ======================================================
// views/partials/mobileNav.js
// Barre de navigation mobile UNIQUE, réutilisée par toutes les pages
// (QG, Marketplace, Community, Academy, Arsenal, Coffre, Connecteurs,
// Discussions, Stories, Paramètres...) pour qu'on ne soit plus jamais
// bloqué sans moyen de revenir au QG. Chaque page garde son propre CSS
// ".mobile-nav" (déjà présent partout), seul le contenu des liens est
// centralisé ici — une seule source de vérité, pas de doublure.
// ======================================================
const ITEMS = [
    { href: "/qg",          icon: "layout-dashboard", label: "QG" },
    { href: "/marketplace", icon: "store",            label: "Marché" },
    { href: "/community",   icon: "users",            label: "Communauté" },
    { href: "/academy",     icon: "graduation-cap",   label: "Academy" },
    { href: "/arsenal",     icon: "shield-check",     label: "Arsenal" },
];

function mobileNav(activeHref) {
    const links = ITEMS.map(item =>
        `<a href="${item.href}"${item.href === activeHref ? ' class="active"' : ""}><i data-lucide="${item.icon}"></i>${item.label}</a>`
    ).join("\n");
    return `<nav class="mobile-nav">\n${links}\n</nav>`;
}

module.exports = { mobileNav, ITEMS };
