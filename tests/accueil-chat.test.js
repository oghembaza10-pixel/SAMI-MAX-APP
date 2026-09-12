// ==========================================================================
// SAMII OS — La nouvelle page d'accueil est-elle vraiment le chat,
//            et l'ancienne est-elle vraiment encore là ?
//
// POURQUOI CE TEST EXISTE.
//
// On vient de changer ce que voit un inconnu qui tape le nom de domaine.
// C'est la modification la plus visible qu'on puisse faire, et elle porte
// deux risques opposés :
//
//   1. LA NOUVELLE PAGE NE MARCHE PAS. Une vue EJS ne casse qu'au moment où
//      quelqu'un l'ouvre — c'est-à-dire en production, devant un visiteur.
//   2. L'ANCIENNE PAGE A DISPARU. 4 257 lignes de vitrine, de SEO et de
//      tarifs. Le jour où on les perd, personne ne s'en aperçoit tout de
//      suite : la nouvelle page s'affiche, tout a l'air normal. On ne le
//      découvrirait qu'en voulant récupérer une section, des mois plus tard.
//      C'était la consigne la plus insistante : NE PERDS AUCUN CODE.
//
// CE QUI EST VÉRIFIÉ ICI.
//   1. La nouvelle accueil se rend réellement, dans les trois langues.
//   2. Elle pose « Tu fais quoi, toi ? » — pas « Comment puis-je vous aider ».
//   3. Toutes ses chaînes passent par le traducteur : rien de français en dur
//      ne subsiste quand la page est servie en anglais.
//   4. L'arabe bascule la page en droite-à-gauche.
//   5. La barre latérale reste COURTE et ne mène nulle part de cassé.
//   6. L'ANCIENNE ACCUEIL EXISTE TOUJOURS, se rend toujours, et garde son
//      contenu (le nombre de lignes est surveillé).
//   7. Le quota anonyme est bien 10 messages sur 5 heures.
//   8. Les conversations sont journalisées pour l'analyse future, sous un
//      identifiant anonyme qui ne peut pas percuter un vrai compte.
//
// COMMENT. On rend vraiment les vues avec le vrai traducteur, et on inspecte
// le HTML servi — jamais le texte source. Un test qui lit le fichier source
// passe même quand la page ne s'affiche pas.
//
// Lancer :  npm test
// ==========================================================================
const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");
const ejs = require(path.join(RACINE, "node_modules", "ejs"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const langue = require(path.join(RACINE, "services", "langue.js"));
const metiers = require(path.join(RACINE, "services", "metiers.js"));
// Les vrais tarifs, pas un objet vide : l'ancienne accueil lit
// tarifs.standard.prix, et un faux jeu de données ferait passer le test
// pendant que la page casserait en production.
const paliers = require(path.join(RACINE, "config", "paliers.js"));

// Les locales que pose services/langue.js + celles que passe index.js.
function locales(lang, extra = {}) {
    return Object.assign({
        lang,
        dir: langue.sens(lang),
        L: langue.traducteur(lang),
        languesDispo: langue.LANGUES,
        nomsLangues: langue.NOMS,
        autreLangue: "en",
        lienLangue: (vers) => `/langue/${vers}`,
        loggedIn: false,
        nom: "",
        typeCompte: "client",
        tarifs: paliers.PALIERS,
        // Les locales ajoutées quand la barre latérale est devenue le centre
        // de navigation. Par défaut : un visiteur anonyme, sans QG ni projet.
        qgs: [], projets: [], workspaceId: "",
        cloudinary: require(path.join(RACINE, "config", "cloudinary.js")),
        // `v()` vient d'app.locals quand Express rend la page
        // (services/actifs.js : la version d'une feuille est l'empreinte de son
        // contenu). Un test qui rend la vue à la main doit poser les MÊMES
        // locales que l'application, sinon il échoue sur une absence qui
        // n'existe pas en production.
        v: require(path.join(RACINE, "services", "actifs.js")).v,
    }, extra);
}

function rendre(vue, lang, extra) {
    const fichier = path.join(RACINE, "views", vue);
    return ejs.render(fs.readFileSync(fichier, "utf8"), locales(lang, extra), { filename: fichier });
}

// ── 1. LA NOUVELLE ACCUEIL SE REND, DANS LES TROIS LANGUES ───────────────
const rendus = {};
for (const lang of langue.LANGUES) {
    try {
        rendus[lang] = rendre("samii-accueil.ejs", lang);
        verifier(rendus[lang].length > 2000,
            `l'accueil en « ${lang} » ne fait que ${rendus[lang].length} caractères — la page est vide`);
    } catch (err) {
        rendus[lang] = "";
        verifier(false, `l'accueil ne se rend pas en « ${lang} » : ${err.message}`);
    }
}

// ── 2. LA QUESTION D'OUVERTURE ───────────────────────────────────────────
// Elle est le cœur de la stratégie : on ne demande pas « comment puis-je
// vous aider », on demande à la personne de parler d'elle.
verifier(rendus.fr.includes("Tu fais quoi, toi ?"),
    "la question d'ouverture « Tu fais quoi, toi ? » n'est pas dans la page servie");
verifier(!/Comment (puis-je|je peux) vous aider/i.test(rendus.fr),
    "la page contient encore « Comment puis-je vous aider » — c'est exactement la phrase qu'on refuse");
verifier(rendus.en.includes("So what do you do?"),
    "la question d'ouverture n'est pas traduite en anglais");

// ── 3. AUCUN FRANÇAIS EN DUR QUAND LA PAGE EST SERVIE EN ANGLAIS ─────────
// Le piège classique : on traduit le titre, on oublie la barre latérale.
// On vérifie chaque libellé, un par un, pour que l'échec nomme le coupable.
const A_TRADUIRE = [
    "Ouvrir un QG", "Connecter mes outils", "Voir les métiers",
    "Communauté", "Aller plus loin", "Envoyer", "Écris à SAMII…",
    "Raconte-moi ton business en une phrase.",
];
for (const phrase of A_TRADUIRE) {
    verifier(!rendus.en.includes(phrase),
        `« ${phrase} » reste en français dans la page anglaise — la chaîne ne passe pas par L()`);
}

// Et le miroir : la page anglaise doit bien porter les traductions, sinon le
// test ci-dessus passerait aussi sur une page vide.
for (const attendu of ["Open an HQ", "Connect my tools", "Browse trades", "Community"]) {
    verifier(rendus.en.includes(attendu),
        `« ${attendu} » manque dans la page anglaise — la barre latérale n'est pas traduite`);
}

// ── 4. L'ARABE BASCULE LA PAGE ───────────────────────────────────────────
verifier(/<html[^>]+dir="rtl"/.test(rendus.ar),
    "la page arabe n'est pas en droite-à-gauche — dir=\"rtl\" manque sur <html>");
verifier(/<html[^>]+dir="ltr"/.test(rendus.fr),
    "la page française devrait être en gauche-à-droite");

// ── 4 bis. LE NAVIGATEUR D'UN ARABOPHONE EST ENTENDU ─────────────────────
//
// La détection ne savait répondre que « fr » ou « en » : elle cherchait ces
// deux chaînes dans l'en-tête et ignorait le reste. Un visiteur annonçant
// « ar-DZ » — une bonne part du marché visé — recevait du français, alors que
// le dictionnaire arabe existait déjà. La traduction était écrite et
// inatteignable. C'est exactement le genre de panne qui ne se voit jamais
// depuis un poste de développement configuré en français.
const DETECTION = [
    ["ar-DZ,ar;q=0.9,fr;q=0.8", "ar", "un Algérien arabophone reçoit l'arabe"],
    ["fr-FR,en;q=0.9",          "fr", "le français annoncé en premier gagne"],
    ["en-US,fr;q=0.8",          "en", "l'anglais annoncé en premier gagne"],
    ["de-DE,en;q=0.9",          "en", "un Allemand bascule sur l'anglais"],
    ["de-DE",                   "fr", "une langue inconnue retombe sur le français"],
    // « arn » (mapudungun) commence par « ar » : une recherche de sous-chaîne
    // le prendrait pour de l'arabe et servirait une page en arabe à un Chilien.
    ["arn-CL",                  "fr", "« arn » n'est pas de l'arabe"],
    ["",                        "fr", "sans en-tête, le français"],
];
for (const [entete, attendu, quoi] of DETECTION) {
    const eu = langue.detecter({ headers: { "accept-language": entete } });
    verifier(eu === attendu,
        `« ${entete || "(vide)"} » donne « ${eu} » au lieu de « ${attendu} » — ${quoi}`);
}

// ── 5. LA BARRE LATÉRALE RESTE COURTE ────────────────────────────────────
// Sept entrées ou plus et on a reconstruit le menu fourre-tout qu'on fuyait.
// ON COMPTE LES DESTINATIONS, PAS LES ACTIONS.
//
// La règle qu'on protège est « la barre latérale n'est pas un menu de toutes
// les fonctionnalités » — elle porte sur les ENDROITS où l'on peut aller :
// ouvrir un QG, connecter ses outils, les métiers, l'Académie, la
// marketplace, la communauté. Six, et c'est la limite.
//
// « Recharger SAMII », « Nouveau projet » et les projets eux-mêmes ne sont
// pas des destinations : ce sont des gestes qu'on fait sans quitter la
// conversation. Les compter dans le même total ferait tomber ce test à chaque
// outil ajouté au chat, et on finirait par relever le plafond — c'est-à-dire
// par perdre la règle qu'il protège.
//
// `sortie__pic` (l'icône interne) est exclue d'office, sinon chaque entrée
// serait comptée deux fois.
const sorties = rendus.fr.match(/class="sortie(?: sortie--phare)?"/g) || [];
verifier(sorties.length >= 5 && sorties.length <= 6,
    `la barre latérale a ${sorties.length} entrées — elle doit en garder 6 au maximum, sinon c'est redevenu un menu`);

// Chaque destination doit exister côté serveur : un lien mort en page
// d'accueil est pire que pas de lien du tout.
const index = fs.readFileSync(path.join(RACINE, "index.js"), "utf8");
for (const route of ["/academy", "/marketplace", "/community", "/connect"]) {
    verifier(index.includes(`app.use("${route}"`),
        `la barre latérale pointe vers ${route}, qui n'est monté nulle part dans index.js`);
}
// Monté par app.use (un routeur entier : le hub + une page par métier) ou
// par app.get (une seule page). Les deux sont acceptables ; l'absence des
// deux est un lien mort en page d'accueil.
verifier(/app\.(use|get)\("\/metiers"/.test(index),
    "la barre latérale pointe vers /metiers, qui n'est monté nulle part");

// ── 6. L'ANCIENNE ACCUEIL EST TOUJOURS LÀ ────────────────────────────────
// C'est LA vérification qui compte le plus. Elle doit hurler si quelqu'un
// « nettoie » views/index.ejs en croyant qu'il ne sert plus à rien.
const ancienne = path.join(RACINE, "views", "index.ejs");
verifier(fs.existsSync(ancienne), "views/index.ejs a disparu — l'ancienne vitrine est perdue");

const lignesAnciennes = fs.readFileSync(ancienne, "utf8").split("\n").length;
verifier(lignesAnciennes > 4000,
    `views/index.ejs ne fait plus que ${lignesAnciennes} lignes (il en faisait 4 257) — du contenu a été supprimé`);

verifier(/app\.get\("\/accueil-classique"/.test(index),
    "la route /accueil-classique n'existe pas — l'ancienne accueil n'est plus accessible nulle part");

try {
    const vieux = rendre("index.ejs", "fr");
    verifier(vieux.length > 50000,
        `l'ancienne accueil ne rend que ${vieux.length} caractères — elle est cassée`);
} catch (err) {
    verifier(false, `l'ancienne accueil ne se rend plus : ${err.message}`);
}

// ── 7. LE QUOTA ANONYME : 10 MESSAGES / 5 HEURES ─────────────────────────
// On lit la valeur réellement passée à express-rate-limit, pas un commentaire.
const vitrineSrc = fs.readFileSync(path.join(RACINE, "routes", "vitrine.js"), "utf8");
verifier(/const QUOTA_ANONYME = 10;/.test(vitrineSrc),
    "le quota anonyme n'est pas 10 messages");
verifier(/const FENETRE_MS = 5 \* 60 \* 60 \* 1000;/.test(vitrineSrc),
    "la fenêtre n'est pas de 5 heures");
verifier(/windowMs: FENETRE_MS/.test(vitrineSrc) && /max: QUOTA_ANONYME/.test(vitrineSrc),
    "le limiteur n'utilise pas ces constantes — les deux valeurs affichées et appliquées peuvent diverger");

// Le message de dépassement ne doit pas être une punition.
const bloc = vitrineSrc.slice(vitrineSrc.indexOf("const vitrineLimiter"), vitrineSrc.indexOf("const LANGUES"));
verifier(/reviennent dans 5 heures/.test(bloc),
    "le message de dépassement ne dit pas que les messages reviennent — le visiteur croit à un mur définitif");
verifier(!/(interdit|bloqué|refusé)/i.test(bloc),
    "le message de dépassement est punitif");

// ── 8. LES CONVERSATIONS SONT JOURNALISÉES POUR L'ANALYSE ────────────────
// On ne programme AUCUNE règle de routage : on enregistre, on lira plus tard.
// Ce qui compte ici, c'est qu'un visiteur anonyme ne puisse jamais écrire
// sous l'identifiant d'un vrai compte.
verifier(/INSERT INTO samii_conversations/.test(vitrineSrc),
    "les conversations de la vitrine ne sont pas enregistrées — on n'aura rien à analyser");
verifier(/"anon:" \+/.test(vitrineSrc),
    "les visiteurs anonymes n'ont pas de préfixe « anon: » — ils peuvent percuter un identifiant de compte");
verifier(/'vitrine'/.test(vitrineSrc),
    "la source « vitrine » n'est pas enregistrée — impossible de séparer les deux mondes à l'analyse");

// Et qu'un échec d'écriture ne coûte pas sa réponse au visiteur.
const journal = vitrineSrc.slice(vitrineSrc.indexOf("async function journaliserTour"));
verifier(/try \{[\s\S]*?\} catch/.test(journal.slice(0, 900)),
    "journaliserTour n'attrape pas ses erreurs — une panne d'écriture ferait perdre la réponse au visiteur");

// ── 9. LE HUB DES MÉTIERS ────────────────────────────────────────────────
// Il ne recopie pas la liste : il lit services/metiers.js.
try {
    const hub = rendre("metiers.ejs", "fr", { groupes: metiers.parGroupe() });
    const premier = metiers.METIERS[0];
    verifier(hub.includes(premier.label),
        `le hub n'affiche pas « ${premier.label} » — il ne lit pas services/metiers.js`);
    verifier(hub.includes("/?metier="),
        "les métiers ne ramènent pas au chat");
} catch (err) {
    verifier(false, `le hub des métiers ne se rend pas : ${err.message}`);
}

// ── RÉSULTAT ─────────────────────────────────────────────────────────────
if (echecs.length) {
    console.log(`\n❌ accueil-chat : ${echecs.length} échec(s) sur ${verifs} vérifications\n`);
    echecs.forEach((e) => console.log(`   • ${e}`));
    process.exitCode = 1;
} else {
    console.log(`✅ accueil-chat : ${verifs} vérifications passées`);
}
