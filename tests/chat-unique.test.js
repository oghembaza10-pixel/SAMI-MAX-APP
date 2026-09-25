// ==========================================================================
// SAMII OS — UN SEUL CHAT
// ==========================================================================
//
// Il y avait deux chats SAMII, et le moins capable était à la porte d'entrée.
//
//   /        la racine, le SEO, l'anonyme, la première impression — mais
//            réponse d'un bloc, pas de directives, pas de connaissances,
//            pas de résumé, pas de retour, pas de reprise.
//   /samii   rangé en rang « avance », c'est-à-dire derrière un bouton
//            « Plus » — et il avait les six.
//
// Quelqu'un qui paie tombait donc sur la version diminuée, et la version
// complète était à deux clics qu'il ne savait pas devoir faire.
//
// Ce chantier a porté les six vers la racine. Cette suite garde les deux
// choses qui ne doivent pas bouger en le faisant :
//
//   1. L'ANONYME NE CHANGE PAS. Ni son chemin (/vitrine/chat/flux), ni le
//      HTML qu'il reçoit. C'est lui qui porte le référencement.
//   2. LES CAPACITÉS SONT TOUTES DERRIÈRE `CONNECTE`. Les six routes sont
//      derrière requireAuth : un bouton montré à un visiteur est une
//      commande qui répond 302.
//
// Lancer :  node tests/chat-unique.test.js
// ==========================================================================

const path = require("path");
const fs = require("fs");

const RACINE = path.join(__dirname, "..");
const JS = fs.readFileSync(path.join(RACINE, "public", "js", "samii-accueil.js"), "utf8");
const VUE = fs.readFileSync(path.join(RACINE, "views", "samii-accueil.ejs"), "utf8");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ── L'INSTRUMENT : ISOLER LE BLOC RÉSERVÉ AUX COMPTES CONNECTÉS ──────────
//
// ⚠️ PREMIÈRE VERSION : `JS.indexOf("if (CONNECTE) {")`. Mesuré, elle
// attrapait la MAUVAISE occurrence — celle de `envoyerMessage`, six cents
// lignes plus haut, qui aiguille entre les deux chemins. Le « bloc connecté »
// isolé contenait donc tout le reste du fichier : le chemin anonyme et un
// `jauge.innerHTML` d'origine. Deux gardes ont crié pour un code qui allait
// très bien.
//
// Le bloc porte un titre unique ; c'est lui l'ancre. Et on vérifie que
// l'ancre existe : sans ça, une bannière renommée rendrait tous les gardes
// ci-dessous verts sur une chaîne vide.
const ANCRE = "CE QUE SAMII SAIT DE TOI — directives, connaissances, résumé, reprise";
function blocConnecte() {
    const i = JS.indexOf(ANCRE);
    return i === -1 ? "" : JS.slice(i);
}
verifier(blocConnecte().length > 2000,
    "le bloc « ce que SAMII sait de toi » n'a pas été retrouvé dans le chat — "
    + "les gardes qui l'inspectent ne mesureraient plus rien");

// ⚠️ ET LA CONDITION ELLE-MÊME, PAS SEULEMENT LA POSITION.
//
// L'ancre ci-dessus est une BANNIÈRE, posée juste au-dessus du `if`. Isoler
// à partir d'elle dit où commence le bloc, jamais à quelle condition il
// s'exécute. Mesuré en remplaçant pour de vrai `if (CONNECTE)` par
// `if (true)` : les gardes de la section 2 restaient TOUS VERTS — quatre
// routes derrière requireAuth se seraient ouvertes aux visiteurs sans que
// rien ne crie.
//
// Un garde qui regarde l'emplacement d'un code et pas ce qui le déclenche
// ne garde pas ce code.
verifier(/\n    if \(CONNECTE\) \{/.test(blocConnecte().slice(0, 4000)),
    "le bloc des capacités ne s'ouvre plus sur « if (CONNECTE) » — il s'exécuterait "
    + "pour un visiteur sans compte, et les quatre routes qu'il appelle sont "
    + "derrière requireAuth");

// ══════════════════════════════════════════════════════════════════════════
// 1. LES SIX CAPACITÉS SONT ARRIVÉES
// ══════════════════════════════════════════════════════════════════════════
for (const [nom, motif] of [
    ["diffusion au fil", /fetch\("\/api\/chat\/flux"/],
    ["directives", /fetch\("\/api\/directives"/],
    ["connaissances", /fetch\("\/api\/connaissances"/],
    ["résumé", /fetch\("\/api\/samii-resume"/],
    ["retour sur une réponse", /fetch\("\/api\/chat\/feedback"/],
    ["reprise de l'historique", /fetch\(url\)[\s\S]{0,80}|\/api\/chat\/historique/],
]) {
    verifier(motif.test(JS),
        `« ${nom} » n'a pas été portée vers le chat de la racine`);
}
verifier(/\/api\/chat\/historique/.test(JS),
    "la reprise de l'historique n'appelle pas sa route");

// ══════════════════════════════════════════════════════════════════════════
// 2. ⚠️ L'ANONYME N'A ACCÈS À AUCUNE D'ELLES
// ══════════════════════════════════════════════════════════════════════════
//
// Les six routes sont derrière `requireAuth`. Un bouton visible sans compte
// est une commande qui répond 302 : on ne le montre pas.
//
// Le garde isole le bloc `if (CONNECTE) {` et vérifie que les appels y sont
// TOUS. Chercher « est-ce que CONNECTE apparaît quelque part » ne prouverait
// rien — le mot figure déjà dix fois dans ce fichier.
{
    const bloc = blocConnecte();
    for (const route of ["/api/directives", "/api/connaissances", "/api/samii-resume", "/api/chat/historique"]) {
        const total = (JS.match(new RegExp(route.replace(/\//g, "\\/"), "g")) || []).length;
        const dedans = (bloc.match(new RegExp(route.replace(/\//g, "\\/"), "g")) || []).length;
        verifier(total > 0 && total === dedans,
            `« ${route} » est appelée ${total - dedans} fois HORS du bloc connecté — `
            + "un visiteur sans compte verrait une commande qui répond 302");
    }
}

// Le retour 👍/👎 est dans une fonction appelée depuis les deux chemins :
// c'est lui-même qui refuse, en première ligne.
verifier(/function poserRetour\([\s\S]{0,200}?if \(!CONNECTE \|\| !messageId/.test(JS),
    "poserRetour ne vérifie plus qu'on est connecté ET qu'il y a un message à noter — "
    + "deux pouces qui ne mènent nulle part valent moins que pas de pouces");

// ══════════════════════════════════════════════════════════════════════════
// 3. LE BALISAGE N'EXISTE PAS POUR UN VISITEUR
// ══════════════════════════════════════════════════════════════════════════
//
// C'est ce qui garantit que Googlebot reçoit exactement la page d'avant :
// il n'est pas connecté, donc rien de tout ceci n'est rendu.
{
    // Le dernier `<% if (loggedIn) { %>` de la barre latérale, jusqu'à sa
    // fermeture. On compare des POSITIONS : chaque identifiant doit tomber
    // à l'intérieur.
    const ouvre = VUE.lastIndexOf("<% if (loggedIn) { %>");
    verifier(ouvre !== -1, "le bloc conditionnel de la barre latérale a disparu");
    const ferme = VUE.indexOf("</aside>", ouvre);
    verifier(ferme > ouvre, "la fin du bloc conditionnel n'a pas été retrouvée");
    for (const id of ["dir-ouvrir", "dir-panneau", "con-ouvrir", "con-panneau", "resume"]) {
        const pos = VUE.indexOf(`id="${id}"`);
        verifier(pos !== -1, `l'élément « ${id} » a disparu du gabarit`);
        verifier(pos > ouvre && pos < ferme,
            `« ${id} » est rendu même pour un visiteur sans compte — `
            + "le HTML servi à Googlebot change, et le bouton ne mène nulle part");
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 4. ⚠️ LE CHEMIN ANONYME N'A PAS BOUGÉ
// ══════════════════════════════════════════════════════════════════════════
verifier(/fetch\("\/vitrine\/chat\/flux"/.test(JS),
    "le chat anonyme n'appelle plus /vitrine/chat/flux — c'est lui qui porte le référencement");
verifier(/fetch\("\/vitrine\/chat"/.test(JS),
    "le repli du chat anonyme (/vitrine/chat) a disparu");
verifier(!/\/vitrine\/chat/.test(blocConnecte()),
    "le chemin anonyme est appelé depuis le bloc connecté — les deux publics se mélangent");

// ══════════════════════════════════════════════════════════════════════════
// 5. UN SEUL LECTEUR DE FLUX, ET IL LIT LES DEUX
// ══════════════════════════════════════════════════════════════════════════
//
// Recopier le lecteur de la page de l'assistant aurait fait deux lecteurs à
// tenir d'accord. Ils parlent le même SSE : il n'en faut qu'un.
{
    const lecteurs = (JS.match(/getReader\(\)/g) || []).length;
    verifier(lecteurs === 1,
        `${lecteurs} lecteurs de flux dans ce fichier au lieu d'un — ils divergeront`);

    // ⚠️ L'ÉVÉNEMENT « reprise » : SAMII commence une phrase puis appelle un
    // outil. Le flux anonyme ne l'émet JAMAIS (il ne porte aucun outil), donc
    // rien ne manquait tant que ce lecteur ne servait qu'à lui. Branché sur
    // /api/chat/flux, l'ignorer laisserait un début de phrase abandonné à
    // l'écran, suivi de la vraie réponse.
    verifier(/evenement === "reprise"/.test(JS),
        "le lecteur de flux ignore l'événement « reprise » — un début de phrase "
        + "abandonné resterait affiché, et SAMII aurait l'air de se contredire");
    verifier(/evenement === "morceau"/.test(JS) && /evenement === "fin"/.test(JS),
        "le lecteur de flux ne gère plus « morceau » ou « fin »");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LE REPLI D'UN BLOC EXISTE TOUJOURS
// ══════════════════════════════════════════════════════════════════════════
//
// Un proxy qui met en tampon, un navigateur sans flux lisible : mieux vaut
// une réponse d'un bloc que pas de réponse. C'est le comportement d'AVANT ce
// chantier, et il est gardé entier.
verifier(/function connecteSansFlux\(/.test(JS),
    "le repli d'un bloc pour le chemin connecté a disparu — un proxy qui met "
    + "en tampon laisserait la personne sans réponse");
verifier(/if \(!window\.ReadableStream \|\| !window\.TextDecoder\) return connecteSansFlux/.test(JS),
    "un navigateur sans flux lisible n'est plus renvoyé vers le repli");
verifier(/\.catch\(function \(\) \{ connecteSansFlux\(corps, cible\); \}\)/.test(JS),
    "un flux qui échoue ne retombe plus sur la réponse d'un bloc");

// ══════════════════════════════════════════════════════════════════════════
// 7. UN SEUL ENVOI VERS CLOUDINARY
// ══════════════════════════════════════════════════════════════════════════
//
// L'image jointe et les fichiers de connaissance passent par le même
// préréglage. Deux copies auraient voulu dire deux préréglages à tenir
// d'accord.
{
    const envois = (JS.match(/api\.cloudinary\.com/g) || []).length;
    verifier(envois === 1,
        `${envois} appels à Cloudinary écrits dans ce fichier au lieu d'un`);
    verifier(/function versCloudinary\(/.test(JS),
        "l'envoi vers Cloudinary n'est plus une fonction réutilisable");
}

// ══════════════════════════════════════════════════════════════════════════
// 8. RIEN N'EST ÉCRIT AVEC innerHTML
// ══════════════════════════════════════════════════════════════════════════
//
// La liste des connaissances affiche des NOMS DE FICHIERS choisis par la
// personne, et un nom de fichier peut contenir du balisage.
{
    const bloc = blocConnecte();
    verifier(bloc.length > 2000, "le bloc connecté n'a pas été retrouvé — le garde ci-dessous ne mesure rien");
    // ⚠️ RÈGLE ABSOLUE, SANS EXCEPTION. La première version tolérait
    // `innerHTML = ""` (vider le fil n'écrit rien). Mesuré : le motif
    // `innerHTML\s*=\s*(?!"")` laissait passer TOUTES les écritures, parce
    // que `\s*` rétro-agit jusqu'à zéro espace et que la négation examine
    // alors une espace, pas les guillemets. Un garde avec exception est un
    // garde avec une faille ; le fil se vide donc nœud par nœud, et la règle
    // n'a plus d'exception à contourner.
    //
    // ⚠️ ET ON DÉCAPE LES COMMENTAIRES D'ABORD. Le commentaire qui EXPLIQUE
    // pourquoi le fil se vide nœud par nœud contient forcément les mots
    // `innerHTML = ""` — et le garde s'est déclenché dessus. Un garde qui
    // crie sur sa propre documentation, c'est arrivé quatre fois dans ce
    // dépôt ; AGENTS.md le dit noir sur blanc.
    const code = bloc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const ecritures = (code.match(/innerHTML\s*=/g) || []).length;
    verifier(ecritures === 0,
        `${ecritures} écriture(s) en innerHTML dans le bloc connecté — les noms de `
        + "fichiers viennent de la personne et peuvent contenir du balisage");
}

// ══════════════════════════════════════════════════════════════════════════
// 9. LES ROUTES EXISTENT DÉJÀ — AUCUN BACKEND N'A ÉTÉ AJOUTÉ
// ══════════════════════════════════════════════════════════════════════════
//
// Ce chantier ne devait toucher qu'au navigateur. Si une de ces routes
// venait à manquer, un bouton porté ici tomberait dans le vide.
{
    const api = fs.readFileSync(path.join(RACINE, "routes", "api.js"), "utf8");
    for (const [route, motif] of [
        ["POST /api/chat/flux", /router\.post\("\/chat\/flux", requireAuth/],
        ["GET /api/directives", /router\.get\("\/directives", requireAuth/],
        ["POST /api/directives", /router\.post\("\/directives", requireAuth/],
        ["GET /api/connaissances", /router\.get\("\/connaissances", requireAuth/],
        ["POST /api/connaissances", /router\.post\("\/connaissances", requireAuth/],
        ["POST /api/samii-resume", /router\.post\("\/samii-resume", requireAuth/],
        ["POST /api/chat/feedback", /router\.post\("\/chat\/feedback", requireAuth/],
        ["GET /api/chat/historique", /router\.get\("\/chat\/historique", requireAuth/],
    ]) {
        verifier(motif.test(api),
            `${route} n'existe plus, ou n'est plus derrière requireAuth — `
            + "le chat de la racine s'appuie dessus");
    }
}

if (echecs.length) {
    console.log(`\n❌ Chat unique : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.log(`   • ${e}`);
    console.log("");
    process.exit(1);
}
console.log(`✅ Chat unique : ${verifs} vérifications passées`);
