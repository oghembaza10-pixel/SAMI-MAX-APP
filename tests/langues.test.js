// ==========================================================================
// SAMII OS — Une page traduite l'est-elle vraiment ?
//
// POURQUOI CE TEST EXISTE. « Dans certains endroits, il n'y a ni le bouton
// pour changer de langue ni le bouton pour revenir en arrière. La tour de
// contrôle, elle est qu'en français. » En cherchant, on a trouvé deux pannes
// silencieuses, toutes deux invisibles depuis le code :
//
//   1. UNE CLÉ ANNOTÉE MAIS ABSENTE DU DICTIONNAIRE. /js/i18n.js, en face
//      d'une clé inconnue, ne touche pas l'élément — volontairement, pour ne
//      jamais afficher « api.th.nom » à un marchand. Conséquence : le texte
//      reste en français, dans toutes les langues, sans la moindre erreur.
//      Un `data-i18n` mal orthographié ressemble exactement à un `data-i18n`
//      correct. Personne ne le voit avant un client arabophone.
//
//   2. UNE PAGE SANS SÉLECTEUR. Seize gabarits portaient des textes déjà
//      traduits et aucun bouton pour choisir la langue : la traduction
//      existait, payée, et restait inatteignable.
//
// CE QU'ON VÉRIFIE.
//   A. Toute clé annotée dans une vue existe dans les QUATRE langues.
//   B. Toute vue de taille réelle offre un moyen de changer de langue.
//   C. Les quatre dictionnaires portent les mêmes clés — une traduction
//      oubliée dans une seule langue est le cas le plus fréquent.
//
// DEUX FAMILLES DE VUES. Les pages les plus anciennes (accueil, QG, hub,
// espace client) embarquent leur dictionnaire en ligne dans leur propre
// balise script ; les autres lisent public/i18n/*.json. Le test connaît la
// différence et vérifie chacune là où ses traductions vivent réellement.
//
// COMMENT. On lit les fichiers. Pas de base, pas de port, pas de navigateur.
//
// Lancer :  npm test
// ==========================================================================
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const VUES = path.join(RACINE, "views");
const LANGUES = ["fr", "en", "ar", "zh"];

let verifs = 0;
const echecs = [];
const verifier = (condition, message) => {
    verifs++;
    if (!condition) echecs.push(message);
};

// ── Les dictionnaires partagés ──────────────────────────────────────────
const dicos = {};
for (const l of LANGUES) {
    const p = path.join(RACINE, "public", "i18n", `${l}.json`);
    assert.ok(fs.existsSync(p), `public/i18n/${l}.json est introuvable`);
    dicos[l] = JSON.parse(fs.readFileSync(p, "utf8"));
}

const lireCle = (obj, chemin) =>
    chemin.split(".").reduce((a, k) => (a && a[k] !== undefined ? a[k] : null), obj);

// ── Les vues qui embarquent leur propre dictionnaire ─────────────────────
// Elles ne lisent pas les JSON partagés : leurs clés sont écrites en clair
// dans un objet `const I18N = { fr: {...}, en: {...} }` du gabarit lui-même.
const DICO_EN_LIGNE = new Set([
    "index.ejs", "client-qg.ejs", "qg-template.ejs", "hub.ejs",
]);

const gabarits = fs.readdirSync(VUES).filter((f) => f.endsWith(".ejs"));
const partiels = fs.existsSync(path.join(VUES, "partials"))
    ? fs.readdirSync(path.join(VUES, "partials")).filter((f) => f.endsWith(".ejs")).map((f) => "partials/" + f)
    : [];

// ══════════════════════════════════════════════════════════════════════════
// A. Toute clé annotée existe dans les quatre langues
// ══════════════════════════════════════════════════════════════════════════
// On accepte les quatre formes d'annotation utilisées dans le projet : le
// texte (data-i18n), l'infobulle (data-i18n-title) et les deux écritures
// historiques du texte d'invite (data-i18n-placeholder et data-i18n-ph).
const ANNOTATION = /data-i18n(?:-title|-placeholder|-ph)?="([a-zA-Z0-9_.]+)"/g;

for (const f of [...gabarits, ...partiels]) {
    const source = fs.readFileSync(path.join(VUES, f), "utf8");
    const enLigne = DICO_EN_LIGNE.has(f);

    for (const m of source.matchAll(ANNOTATION)) {
        const cle = m[1];

        if (enLigne) {
            // La clé doit apparaître comme clé de l'objet du gabarit. On la
            // cherche entre apostrophes, la forme qu'utilisent ces fichiers.
            verifier(
                source.includes(`'${cle}'`),
                `${f} : data-i18n="${cle}" n'a aucune entrée dans le dictionnaire en ligne du gabarit`
            );
            continue;
        }

        const absentes = LANGUES.filter((l) => lireCle(dicos[l], cle) === null);
        verifier(
            absentes.length === 0,
            `${f} : data-i18n="${cle}" manque dans ${absentes.join(", ")} — le texte restera en français dans ces langues`
        );
    }
}

// ══════════════════════════════════════════════════════════════════════════
// B. Toute vue de taille réelle offre un moyen de changer de langue
// ══════════════════════════════════════════════════════════════════════════
// Le seuil écarte les fragments et les pages d'erreur : une page de soixante
// lignes est un message, pas un écran où l'on s'installe.
const SEUIL_LIGNES = 60;

// Quatre mécaniques coexistent, toutes légitimes :
//   - le partiel partagé (views/partials/barre-langue.ejs) ;
//   - les boutons [data-lang-btn] liés par /js/i18n.js ;
//   - le sélecteur en ligne de l'accueil (.lang-switch span[data-lang]) ;
//   - les liens rendus par le serveur (lienLangue) sur les pages traduites
//     à l'avance par services/langue.js.
const A_UN_SELECTEUR = (s) =>
    s.includes("partials/barre-langue") ||
    s.includes("data-lang-btn") ||
    s.includes("lienLangue") ||
    /class="lang-switch"/.test(s);

// Ces gabarits n'ont pas à en porter un : ils sont inclus par d'autres pages
// ou n'existent pas comme écran autonome.
const SANS_SELECTEUR_ADMIS = new Set([
    "partials/barre-langue.ejs",
]);

// Cette vérification lisait chaque fichier isolément. Le jour où une page a
// confié sa colonne de gauche à un partiel partagé, le sélecteur a disparu
// de SA source — alors qu'il est toujours rendu, depuis le partiel. Le test
// signalait donc une page cassée qui ne l'est pas, et aurait fini par être
// contourné plutôt que corrigé.
//
// On suit maintenant les include(), comme le fait EJS. Une page qui n'a
// vraiment aucun sélecteur, ni chez elle ni chez ses partiels, échoue
// toujours — c'était bien ça qu'on voulait attraper.
function avecSesInclusions(fichier, vus = new Set()) {
    if (vus.has(fichier)) return "";
    vus.add(fichier);
    let source;
    try {
        source = fs.readFileSync(path.join(VUES, fichier), "utf8");
    } catch { return ""; }
    const inclus = [...source.matchAll(/include\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
    return source + inclus.map((nom) =>
        avecSesInclusions(nom.endsWith(".ejs") ? nom : `${nom}.ejs`, vus)).join("");
}

for (const f of [...gabarits, ...partiels]) {
    if (SANS_SELECTEUR_ADMIS.has(f)) continue;
    const source = fs.readFileSync(path.join(VUES, f), "utf8");
    if (source.split("\n").length < SEUIL_LIGNES) continue;
    // Un fragment inclus ailleurs n'a pas de <body> à lui.
    if (!source.includes("</body>")) continue;

    verifier(
        A_UN_SELECTEUR(avecSesInclusions(f)),
        `${f} : aucun moyen de changer de langue — inclure partials/barre-langue avant </body>`
    );
}

// ══════════════════════════════════════════════════════════════════════════
// C. Les quatre dictionnaires portent les mêmes clés
// ══════════════════════════════════════════════════════════════════════════
// Le français est la référence : c'est la langue dans laquelle les textes
// sont écrits d'abord. Une clé présente en français et absente ailleurs est
// une traduction oubliée ; l'inverse est une clé morte, moins grave mais qui
// laisse croire qu'un texte est couvert alors qu'il n'est plus affiché.
const aplatir = (obj, prefixe = "") =>
    Object.entries(obj).flatMap(([k, v]) =>
        v && typeof v === "object" && !Array.isArray(v)
            ? aplatir(v, prefixe + k + ".")
            : [prefixe + k]
    );

const clesFr = aplatir(dicos.fr);
for (const l of LANGUES.filter((x) => x !== "fr")) {
    const presentes = new Set(aplatir(dicos[l]));
    const oubliees = clesFr.filter((k) => !presentes.has(k));
    verifier(
        oubliees.length === 0,
        `public/i18n/${l}.json : ${oubliees.length} clé(s) du français sans traduction — ${oubliees.slice(0, 6).join(", ")}${oubliees.length > 6 ? ", …" : ""}`
    );
}

// ══════════════════════════════════════════════════════════════════════════
// D. Le bouton de retour connaît sa destination
// ══════════════════════════════════════════════════════════════════════════
// services/navigation.js promet une clé de dictionnaire pour chaque base.
// Si l'une manque des JSON, le bouton reste en français sur une page passée
// en arabe — précisément le défaut qu'on répare.
const navigation = require(path.join(RACINE, "services", "navigation.js"));
const clesRetour = [
    ...Object.values(navigation.BASES).map((b) => b.cle),
    "nav.retour.accueil",
    "nav.retour.simple",
];
for (const cle of clesRetour) {
    const absentes = LANGUES.filter((l) => lireCle(dicos[l], cle) === null);
    verifier(
        absentes.length === 0,
        `services/navigation.js promet la clé "${cle}", absente de ${absentes.join(", ")}`
    );
}

// Une destination fournie par l'URL ne doit jamais sortir du site : sinon un
// lien préparé ailleurs renvoie un marchand connecté sur une copie du QG.
for (const hostile of ["https://exemple.test/qg", "//exemple.test", "\\\\exemple.test", "javascript:alert(1)", "qg"]) {
    verifier(
        navigation.interne(hostile) === false,
        `navigation.interne() accepte "${hostile}" — un retour peut sortir du site`
    );
}
verifier(navigation.interne("/qg") === true, 'navigation.interne("/qg") devrait être accepté');
verifier(navigation.interne("/academy/besoins") === true, 'navigation.interne("/academy/besoins") devrait être accepté');

// ── Les modules du QG ────────────────────────────────────────────────────
// La colonne de gauche du QG est construite à partir de données, et son
// gabarit écrit `data-i18n="${m.cle}"` — une chaîne calculée, donc invisible
// à l'analyse du balisage faite plus haut. Quatorze clés étaient sorties de
// la surveillance sans que rien ne le signale.
//
// On surveille donc la SOURCE au lieu du balisage : chaque module déclare
// une clé, cette clé doit exister dans les quatre langues. C'est plus solide
// que ce qui existait avant — un module ajouté demain sans traduction est
// attrapé le jour même.
const modulesQg = require(path.join(RACINE, "config", "modules-qg"));
for (const m of modulesQg.MODULES) {
    const absentes = LANGUES.filter((l) => lireCle(dicos[l], m.cle) === null);
    verifier(
        absentes.length === 0,
        `config/modules-qg.js : le module « ${m.libelle} » promet la clé "${m.cle}", absente de ${absentes.join(", ")}`
    );
}

// ── Verdict ──────────────────────────────────────────────────────────────
if (echecs.length) {
    console.error(`❌ langues : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.error("   • " + e);
    process.exit(1);
}
console.log(`✅ langues : ${verifs} vérifications passées (${LANGUES.join("/")}, ${gabarits.length + partiels.length} gabarits)`);
