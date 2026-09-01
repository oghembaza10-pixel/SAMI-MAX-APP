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
// `chemins` : LES ROUTES QUE CE MODULE POSSÈDE.
//
// « Cache le hub pour les gens qui s'inscrivent. Enlève tout ce qui relève
// de chez nous, sauf ce qu'on a décidé de laisser. »
//
// Retirer une entrée de la colonne de gauche ne retire pas la page : elle
// reste servie à qui tape son adresse. Un membre de chez elle qui écrit
// /hub, /marketplace ou /arsenal dans sa barre d'adresse voyait donc encore
// notre maison entière — et un lien partagé dans un groupe WhatsApp suffit
// à ce que ça arrive sans mauvaise intention.
//
// En rattachant les routes au module plutôt qu'à une liste séparée, le jour
// où on ouvre un module à une partenaire, ses pages s'ouvrent avec — et le
// jour où on en ajoute un chez nous, il reste fermé chez elle par défaut.
// Une seule liste à tenir, pas deux qui divergent.
const MODULES = [
    // ── Le haut : ce qu'on voit sans déplier ─────────────────────────────
    { id: "hub",         libelle: "Hub",                 cle: "qg.nav.hub",          icone: "layout-grid",     href: "/hub",            rang: "core", chemins: ["/hub"] },
    { id: "marketplace", libelle: "Marketplace",         cle: "qg.nav.marketplace",  icone: "store",           href: "/marketplace",    rang: "core", chemins: ["/marketplace"] },
    // Sa communauté vit sous /c ; la nôtre sous /community. Une partenaire
    // qui a ce module reçoit /c, jamais /community.
    { id: "communaute",  libelle: "Community",           cle: "qg.nav.community",    icone: "users",           href: (COM) => require("./communautes").accueil(COM), rang: "core",
      chemins: (COM) => COM.ecosysteme ? ["/community", "/stories"] : ["/c"] },
    { id: "academy",     libelle: "Academy",             cle: "qg.nav.academy",      icone: "graduation-cap",  href: "/academy",        rang: "core", chemins: ["/academy"] },

    // ── Le repli : « Plus » ──────────────────────────────────────────────
    // « Mes affaires » c'est le QG marchand : il ne s'ouvre pas sans un
    // espace de travail, donc /workspace vient avec, sinon le module est
    // donné mais inutilisable.
    // « /livraisons à enlever » : c'est notre réseau de livreurs, pas le
    // sien. Douala n'est pas Alger, et lui laisser un suivi de livraison
    // branché sur des transporteurs qu'elle n'a pas serait une promesse
    // vide. Seuls /qg et /workspace restent.
    { id: "affaires",    libelle: "Mes affaires",        cle: "qg.nav.myBusiness",   icone: "briefcase",       href: "/qg",             rang: "more", separateurAvant: true, chemins: ["/qg", "/workspace"] },
    { id: "connect",     libelle: "Connecter mes outils", cle: "qg.nav.connectTools", icone: "plug-zap",       href: "/connect/tools",  rang: "more", chemins: ["/connect"] },
    { id: "discussions", libelle: "Discussions",        cle: "qg.nav.discussions",  icone: "messages-square", href: "/discussions",    rang: "more", chemins: ["/discussions"] },
    // « Mes messages » n'est PAS « Discussions ». Les discussions sont des
    // salons — plusieurs personnes, ouverts à la communauté. Ici, deux
    // personnes et personne d'autre : c'est là qu'arrivent les questions
    // laissées sur un profil ou sous une annonce. Les confondre dans la
    // colonne, c'est chercher sa question de client dans un salon public.
    { id: "messages",    libelle: "Mes messages",        cle: "qg.nav.messages",     icone: "mail",            href: "/messages",       rang: "more", badge: "badge-messages-non-lus", chemins: ["/messages"] },
    { id: "api",         libelle: "API & Webhooks",      cle: "qg.nav.api",          icone: "terminal",        href: "/developpeurs",   rang: "more", chemins: ["/developpeurs", "/api/v1", "/api-docs"] },
    { id: "apps",        libelle: "Applications",        cle: "qg.nav.apps",         icone: "blocks",          href: "/apps",           rang: "more", chemins: ["/apps"] },
    { id: "arsenal",     libelle: "Arsenal",             cle: "qg.nav.arsenal",      icone: "sword",           href: "/arsenal",        rang: "more", chemins: ["/arsenal", "/guerre"] },
    { id: "coffre",      libelle: "Coffre OG",           cle: "qg.nav.vault",        icone: "vault",           href: "/coffre",         rang: "more", chemins: ["/coffre"] },
    // L'assistant, c'est le moteur ET ses outils (Griot, Miroir, Oracle…),
    // tous montés sous /samii. C'est ce qu'on lui a promis : l'automatisation.
    { id: "assistant",   libelle: "SAMII",               cle: "qg.nav.samii",        icone: "bot",             href: "/samii",          rang: "more", separateurAvant: true, pastille: true, chemins: ["/samii", "/automatisations"] },

    // ── Le bas de la colonne ─────────────────────────────────────────────
    { id: "vitrine",     libelle: "Ma Vitrine",          cle: "qg.nav.vitrine",      icone: "user-circle",     href: (COM, ctx) => `/vitrine/${ctx.userId || ""}`, rang: "bas", nouvelOnglet: true, chemins: ["/vitrine"] },
    { id: "parrainage",  libelle: "Parrainage",          cle: "qg.nav.parrainage",   icone: "handshake",       href: "/parrainage",     rang: "bas", badge: "badge-gains-parrainage", chemins: ["/parrainage"] },
    { id: "agence",      libelle: "QG Agence",           cle: "qg.nav.agence",       icone: "building-2",      href: "/agence",         rang: "bas", siAgence: true, chemins: ["/agence"] },
    { id: "abonnement",  libelle: "Abonnement",          cle: "qg.nav.billing",      icone: "crown",           href: "/billing",        rang: "bas", chemins: ["/billing", "/cartes"] },
    { id: "reglages",    libelle: "Paramètres",          cle: "qg.nav.settings",     icone: "settings",        href: "/settings",       rang: "bas", chemins: ["/settings", "/profile"] },
];

// ── CE QUI EST OUVERT À TOUT LE MONDE, QUELLE QUE SOIT LA COMMUNAUTÉ ─────
//
// Ce ne sont pas des modules : ce sont les fondations. Les fermer ne
// « retirerait » rien à une partenaire, ça casserait son application.
//
// Chaque ligne dit pourquoi elle est là. Une entrée sans raison lisible est
// une entrée que le prochain lecteur n'osera pas retirer.
const SOCLE = [
    "/health",          // la sonde de Render — sans elle, le service est déclaré mort
    "/webhook",         // Stripe, Chargily, Telegram, WhatsApp, Meta : ça vient du dehors
    // Le rappel d'abonnement de Stripe. « /billing » est fermé chez elle —
    // c'est notre facturation — mais ce chemin-ci n'est pas une page : c'est
    // Stripe qui appelle. Un webhook qu'on ferme ne se plaint pas, il tombe
    // en 404 en silence, et on découvre le trou sur un relevé bancaire.
    "/billing/webhook",
    // « /telegram à enlever » — et je l'ai gardé, volontairement.
    //
    // Ce n'est pas une page : le fichier ne déclare que deux POST, et aucun
    // GET. Personne ne peut donc « tomber » dessus, et il n'y a rien de
    // chez nous à y voir. C'est l'adresse que TELEGRAM appelle, déclarée
    // par Connect Tools au moment où un marchand branche son bot
    // (connector.js : setWebhook → /telegram/<workspaceId>).
    //
    // La fermer ne cacherait rien à personne, et couperait tous les bots
    // connectés par le module qu'on lui a justement laissé. Comme les
    // webhooks de paiement : ça ne se plaint pas, ça arrête juste de
    // marcher. À rouvrir la discussion si on veut lui retirer Telegram —
    // mais alors c'est Connect Tools qu'il faut changer, pas cette ligne.
    "/telegram",
    "/socket.io",       // le temps réel (messages, commandes)
    "/api",             // ses propres pages l'appellent (données du QG, traductions)
    "/login", "/register", "/password-reset", "/logout",
    "/c",               // son inscription et sa connexion à sa marque vivent sous /c
    "/paiement",        // encaisser : c'est la raison d'être de tout le reste
    "/admin/communaute",// SON tableau de bord à elle
    "/verification",    // vérification d'e-mail
    // OAuth. Ces routes sont montées à la RACINE, sans préfixe : elles ne
    // ressemblent à aucun module et se seraient fait fermer sans bruit.
    // « Se connecter avec Google » aurait cessé de marcher chez elle, et
    // « Connecter mes outils » — qu'on lui a justement laissé — aussi.
    "/auth",
    "/langue",          // le sélecteur de langue de toutes ses pages
    // Les pages légales. On ne ferme pas ce que la loi oblige à publier, et
    // Meta comme Google vérifient que ces adresses répondent.
    "/privacy", "/privacy.html", "/terms", "/terms.html",
    "/confidentialite", "/politique-de-confidentialite",
    "/conditions", "/conditions-de-service", "/cgu", "/cgv", "/mentions-legales",
    "/suppression", "/suppression-des-donnees", "/data-deletion.html",
    "/favicon.ico", "/manifest.json", "/robots.txt", "/sw.js",
];

function cheminsDe(m, COM) {
    return typeof m.chemins === "function" ? m.chemins(COM) : (m.chemins || []);
}

// Les adresses qu'une communauté a le droit d'ouvrir, et celles qui lui sont
// fermées. `null` (la maison) = aucune restriction, et on le dit
// explicitement plutôt que de laisser la fonction répondre par accident.
//
// LES DEUX LISTES, PAS SEULEMENT LA PREMIÈRE. Le socle ouvre « /api »,
// parce que ses propres pages en ont besoin. Mais « /api/v1 » est l'API
// publique des développeurs, qui appartient à un module qu'elle n'a pas —
// et « /api/v1 » commence par « /api/ ». Sans la seconde liste, le socle
// rouvrait par la bande une porte qu'on venait de fermer.
function cheminsAutorises(COM) {
    if (!COM?.qg?.modules) return null;
    const permisIds = new Set(autorises(COM).map((m) => m.id));
    const ouverts = new Set([...SOCLE, ...autorises(COM).flatMap((m) => cheminsDe(m, COM))]);

    // Ce qu'un module vaut CHEZ NOUS. Un module peut vivre à une adresse
    // différente selon la communauté : « Community », c'est /community chez
    // nous et /c chez elle. Elle a bien le module — mais pas notre adresse.
    //
    // Sans cette ligne, /community n'était fermé nulle part : il ne tenait
    // qu'au fait que « /c » ne préfixe pas « /community » par segments. Ça
    // marchait, mais par accident — et un accident finit toujours par
    // tomber du mauvais côté.
    // Requis ici et pas en tête de fichier : dépendance circulaire, même
    // raison que pour `accueil` plus haut. Au moment de l'appel — une
    // requête — le cache est chaud.
    const MAISON = { ecosysteme: true, slug: require("./communautes").DEFAUT };
    const fermes = new Set();
    for (const m of MODULES) {
        const aElle = new Set(permisIds.has(m.id) ? cheminsDe(m, COM) : []);
        for (const c of [...cheminsDe(m, MAISON), ...(permisIds.has(m.id) ? [] : cheminsDe(m, COM))]) {
            if (!aElle.has(c)) fermes.add(c);
        }
    }
    for (const c of ouverts) fermes.delete(c);
    return { ouverts: [...ouverts], fermes: [...fermes] };
}

// Cette adresse passe-t-elle la porte ?
//
// LE PRÉFIXE LE PLUS PRÉCIS DÉCIDE. « /api » est ouvert, « /api/v1 » est
// fermé : pour « /api/v1/produits », c'est « /api/v1 » qui parle, parce
// qu'il en dit plus. Une règle plus courte ne doit jamais annuler une règle
// plus longue — sinon l'ordre dans lequel on a écrit les listes déciderait
// à notre place.
//
// La comparaison se fait sur des SEGMENTS entiers : sans ça, « /apps »
// laisserait passer « /apps-de-chez-nous », et « /c » laisserait passer
// « /coffre ». C'est le genre de détail qui transforme une porte en
// décoration.
function chemineAutorise(chemin, regles) {
    if (!regles) return true;
    const propre = String(chemin || "/").split("?")[0].replace(/\/+$/, "") || "/";
    if (propre === "/") return true;
    const correspond = (a) => propre === a || propre.startsWith(a + "/");
    const plusLong = (liste) => liste.filter(correspond)
        .reduce((max, a) => Math.max(max, a.length), -1);
    return plusLong(regles.ouverts) > plusLong(regles.fermes);
}

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
const MINIMAL = ["communaute", "discussions", "messages", "affaires", "connect", "assistant", "vitrine", "reglages"];

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

module.exports = { MODULES, MINIMAL, SOCLE, autorises, lien, cheminsAutorises, chemineAutorise };
