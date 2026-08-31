// ======================================================
// views/partials/mobileNav.js
// Barre de navigation mobile UNIQUE, réutilisée par toutes les pages
// (QG, Marketplace, Community, Academy, Arsenal, Coffre, Connecteurs,
// Discussions, Stories, Paramètres...) pour qu'on ne soit plus jamais
// bloqué sans moyen de revenir au QG. Chaque page garde son propre CSS
// ".mobile-nav" (déjà présent partout), seul le contenu des liens est
// centralisé ici — une seule source de vérité, pas de doublure.
//
// ── ELLE SUIT MAINTENANT LA COMMUNAUTÉ ──────────────────────────────────
//
// Les cinq entrées étaient écrites en dur : QG, Marché, Communauté,
// Academy, Arsenal. Sur le service d'une partenaire, cette barre affichait
// donc notre catalogue en bas de chaque page — et sur un téléphone, c'est
// la navigation PRINCIPALE, celle qu'on a sous le pouce.
//
// La porte empêchait d'entrer dans ces pages ; les liens, eux, restaient
// affichés. On appuie, on rebondit sur son fil, on croit que c'est cassé.
//
// Elle se construit désormais à partir de config/modules-qg.js, filtrée par
// ce à quoi la communauté a droit — le même registre que la colonne de
// gauche. Sans communauté passée, on garde la barre d'origine : rien ne
// change chez nous, ni pour une page qui n'a pas encore été convertie.
// ======================================================
const ITEMS = [
    { href: "/qg",          icon: "layout-dashboard", label: "QG" },
    { href: "/marketplace", icon: "store",            label: "Marché" },
    { href: "/community",   icon: "users",            label: "Communauté" },
    { href: "/academy",     icon: "graduation-cap",   label: "Academy" },
    { href: "/arsenal",     icon: "shield-check",     label: "Arsenal" },
];

// Les modules montrés dans la barre du bas, dans cet ordre. C'est un
// sous-ensemble : cinq entrées maximum tiennent sous un pouce, au-delà on
// ne vise plus rien.
const ORDRE = ["affaires", "marketplace", "communaute", "academy", "discussions", "assistant", "arsenal"];
const LIBELLES = { affaires: "QG", marketplace: "Marché", communaute: "Communauté", academy: "Academy", discussions: "Salon", assistant: null, arsenal: "Arsenal" };

function pourCommunaute(COM, ctx = {}) {
    const modulesQg = require("../../config/modules-qg");
    const permis = new Map(modulesQg.autorises(COM).map((m) => [m.id, m]));
    return ORDRE
        .filter((id) => permis.has(id))
        .slice(0, 5)
        .map((id) => {
            const m = permis.get(id);
            return {
                href: modulesQg.lien(m, COM, ctx),
                icon: m.icone,
                // L'assistant porte SON nom, pas le nôtre.
                label: LIBELLES[id] || (id === "assistant" ? COM.assistant : m.libelle),
            };
        });
}

function mobileNav(activeHref, COM = null, ctx = {}) {
    const items = (COM && !COM.ecosysteme) ? pourCommunaute(COM, ctx) : ITEMS;
    const links = items.map(item =>
        `<a href="${item.href}"${item.href === activeHref ? ' class="active"' : ""}><i data-lucide="${item.icon}"></i>${item.label}</a>`
    ).join("\n");
    // La grille est déclarée par page en `repeat(5,1fr)` : on la corrige ici
    // quand il y a moins d'entrées, sinon les liens se tassent à gauche et
    // laissent un grand vide à droite.
    const colonnes = items.length !== 5
        ? ` style="grid-template-columns:repeat(${items.length},1fr)"`
        : "";
    return `<nav class="mobile-nav"${colonnes}>\n${links}\n</nav>`;
}

module.exports = { mobileNav, ITEMS };
