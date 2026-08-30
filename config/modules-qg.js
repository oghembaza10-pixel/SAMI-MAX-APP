// ==========================================================================
// SAMII OS — LES MODULES DU QG
//
// POURQUOI CE FICHIER EXISTE.
// « Leur QG, ils n'ont pas ce qu'on a dans les QG. On peut leur laisser
// juste Connect Tools pour l'instant. »
//
// Un membre qui ouvre sa boutique depuis la communauté d'une partenaire
// atterrissait dans un QG à quatorze entrées : Marketplace, Academy,
// Arsenal, Coffre OG, API & Webhooks, Parrainage… et « OG · TECHNOLOGY »
// écrit en haut à gauche. Rien de tout ça n'est à elle, et rien de tout ça
// ne lui a été promis. Elle envoie son monde chez elle, et son monde se
// retrouve devant notre catalogue.
//
// CE QU'ON FAIT. La navigation devient une LISTE DE DONNÉES, et chaque
// communauté déclare ce à quoi ses membres ont droit. La maison a tout ;
// une partenaire a ce qu'on lui a donné, et rien d'autre.
//
// LE CHOIX QUI COMPTE : UNE LISTE BLANCHE, PAS UNE LISTE NOIRE.
// On déclare ce qu'une communauté A, jamais ce qu'elle n'a pas. Avec une
// liste noire, chaque module ajouté au QG apparaîtrait automatiquement chez
// toutes les partenaires jusqu'à ce que quelqu'un pense à l'exclure — et
// personne n'y pensera. Avec une liste blanche, un nouveau module reste
// chez nous par défaut : l'oubli va dans le sens sûr.
//
// `href` peut être une fonction : la communauté d'une partenaire n'est pas
// à /community mais à /c/<son-slug>, et son QG doit ramener chez ELLE.
// ==========================================================================

// `communautes` se requiert DANS la fonction, pas en haut du fichier : ces
// deux modules se demandent l'un l'autre (communautes.js lit MINIMAL ici),
// et un require en tête rendrait un objet encore vide, figé pour toute la
// vie du processus. Ici, l'appel a lieu au moment du rendu — le cache est
// chaud, et `accueil` existe.
const MODULES = [
    // ── Le haut : ce qu'on voit sans déplier ─────────────────────────────
    { id: "hub",         libelle: "Hub",                 cle: "qg.nav.hub",          icone: "layout-grid",     href: "/hub",            rang: "core" },
    { id: "marketplace", libelle: "Marketplace",         cle: "qg.nav.marketplace",  icone: "store",           href: "/marketplace",    rang: "core" },
    { id: "communaute",  libelle: "Community",           cle: "qg.nav.community",    icone: "users",           href: (COM) => require("./communautes").accueil(COM), rang: "core" },
    { id: "academy",     libelle: "Academy",             cle: "qg.nav.academy",      icone: "graduation-cap",  href: "/academy",        rang: "core" },

    // ── Le repli : « Plus » ──────────────────────────────────────────────
    { id: "affaires",    libelle: "Mes affaires",        cle: "qg.nav.myBusiness",   icone: "briefcase",       href: "/qg",             rang: "more", separateurAvant: true },
    { id: "connect",     libelle: "Connecter mes outils", cle: "qg.nav.connectTools", icone: "plug-zap",       href: "/connect/tools",  rang: "more" },
    { id: "discussions", libelle: "Discussions",        cle: "qg.nav.discussions",  icone: "messages-square", href: "/discussions",    rang: "more" },
    { id: "api",         libelle: "API & Webhooks",      cle: "qg.nav.api",          icone: "terminal",        href: "/developpeurs",   rang: "more" },
    { id: "apps",        libelle: "Applications",        cle: "qg.nav.apps",         icone: "blocks",          href: "/apps",           rang: "more" },
    { id: "arsenal",     libelle: "Arsenal",             cle: "qg.nav.arsenal",      icone: "sword",           href: "/arsenal",        rang: "more" },
    { id: "coffre",      libelle: "Coffre OG",           cle: "qg.nav.vault",        icone: "vault",           href: "/coffre",         rang: "more" },
    { id: "assistant",   libelle: "SAMII",               cle: "qg.nav.samii",        icone: "bot",             href: "/samii",          rang: "more", separateurAvant: true, pastille: true },

    // ── Le bas de la colonne ─────────────────────────────────────────────
    { id: "vitrine",     libelle: "Ma Vitrine",          cle: "qg.nav.vitrine",      icone: "user-circle",     href: (COM, ctx) => `/vitrine/${ctx.userId || ""}`, rang: "bas", nouvelOnglet: true },
    { id: "parrainage",  libelle: "Parrainage",          cle: "qg.nav.parrainage",   icone: "handshake",       href: "/parrainage",     rang: "bas", badge: "badge-gains-parrainage" },
    { id: "agence",      libelle: "QG Agence",           cle: "qg.nav.agence",       icone: "building-2",      href: "/agence",         rang: "bas", siAgence: true },
    { id: "abonnement",  libelle: "Abonnement",          cle: "qg.nav.billing",      icone: "crown",           href: "/billing",        rang: "bas" },
    { id: "reglages",    libelle: "Paramètres",          cle: "qg.nav.settings",     icone: "settings",        href: "/settings",       rang: "bas" },
];

// Ce qu'une communauté partenaire a par défaut, tant qu'on ne lui donne pas
// plus. Volontairement court : sa boutique, ses outils, ses réglages, et le
// chemin du retour vers chez elle.
//
// « Abonnement » n'y est pas : c'est notre facturation, sous notre marque,
// et ça n'a rien à faire dans un QG qui doit avoir l'air d'être le sien.
// « On lui inclut SAMII pour qu'elle puisse avoir l'automatisation. »
// L'assistant est là : c'est le moteur qui répond aux clients, prend les
// commandes sur WhatsApp et Telegram, relance les paniers. Sans lui, elle a
// une vitrine ; avec lui, elle a une équipe.
//
// Il porte SON nom, pas le nôtre — le libellé vient de `COM.assistant`, et
// le moteur derrière est le même. C'est ce qu'on lui apporte, et c'est la
// raison pour laquelle elle vient chez nous plutôt que sur un site vitrine.
const MINIMAL = ["communaute", "discussions", "affaires", "connect", "assistant", "vitrine", "reglages"];

// La liste blanche d'une communauté. `null` (la maison) = tout.
function autorises(COM) {
    const permis = COM?.qg?.modules;
    if (!permis) return MODULES;
    return MODULES.filter((m) => permis.includes(m.id));
}

// L'adresse d'un module pour une communauté donnée : certaines dépendent
// d'elle (sa communauté à elle) ou du visiteur (sa vitrine).
function lien(module, COM, ctx = {}) {
    return typeof module.href === "function" ? module.href(COM, ctx) : module.href;
}

module.exports = { MODULES, MINIMAL, autorises, lien };
