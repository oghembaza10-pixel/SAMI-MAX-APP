// ==========================================================================
// SAMII OS — LA COQUILLE DU DOCUMENT (views/app.ejs)
// ==========================================================================
//
// Neuf vues portaient chacune leur copie du document : même doctype, même
// en-tête, même <div class="og-capital">, mêmes trois scripts de fin.
// Quatorze lignes recopiées neuf fois — et jamais relues, ce qui se voit :
// aucune des neuf n'avait de <meta name="viewport">, quand les quatre vues
// de la même famille qui n'ont pas été recopiées l'avaient toutes.
//
// Elles partagent désormais views/app.ejs, en deux moitiés : la vue ouvre le
// document, écrit son contenu, referme le document.
//
// ── CE QUE CETTE SUITE GARDE ─────────────────────────────────────────────
//
// Pas la mise en page : la CONTINUITÉ DU DOCUMENT. Une coquille coupée en
// deux a un risque propre et nouveau — qu'une moitié soit là sans l'autre.
// Ça ne casse pas au rendu : EJS produit sagement un document sans </body>,
// avec un <main> jamais refermé. Le navigateur recolle, la page a l'air
// normale, et le défaut ne se voit qu'au moment où on s'appuie dessus.
//
// Et un piège déjà tombé pendant l'écriture de cette phase : trois de ces
// neuf titres contenaient du EJS (« Connecter <%= tool.label %> »). Passés
// à la coquille comme une CHAÎNE, ils affichaient le code au lieu de la
// valeur — dans l'onglet du navigateur, là où personne ne regarde deux
// fois. D'où le garde sur les titres.
//
// Lancer :  node tests/coquille.test.js
// ==========================================================================

const fs = require("fs");
const path = require("path");
const ejs = require("ejs");

const RACINE = path.join(__dirname, "..");
const VUES_DIR = path.join(RACINE, "views");
let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// Les vues qui se servent de la coquille : LUES SUR LE DISQUE, jamais
// recopiées ici. Une dixième vue migrée demain entre d'elle-même dans cette
// suite ; une liste écrite à la main l'aurait laissée dehors, sans bruit.
const MIGREES = fs.readdirSync(VUES_DIR)
    .filter((f) => f.endsWith(".ejs"))
    .filter((f) => /include\(\s*"app"/.test(fs.readFileSync(path.join(VUES_DIR, f), "utf8")))
    .map((f) => f.replace(/\.ejs$/, ""))
    .sort();

verifier(MIGREES.length >= 9,
    `seules ${MIGREES.length} vues utilisent views/app.ejs — la coquille a été débranchée`);

// ── L'INSTRUMENT : rendre une vue sans connaître ses données ──────────────
//
// On ne cherche pas à reproduire ce qu'une route passe : on cherche à
// OBTENIR UN DOCUMENT. Chaque local manquant est découvert par l'erreur
// d'EJS puis remplacé par un objet qui répond à tout — un champ, une
// méthode de chaîne, une boucle vide. Une vue qui lit un champ imprévu ne
// doit pas faire échouer la mesure : ce serait le garde qui casse, pas le
// code.
function cameleon(nom) {
    const cible = function () { return ""; };
    return new Proxy(cible, {
        get(_, cle) {
            if (cle === Symbol.toPrimitive || cle === "toString") return () => nom;
            if (cle === Symbol.iterator) return [][Symbol.iterator].bind([]);
            if (cle === "length") return 0;
            if (cle === "then") return undefined;
            if (["forEach", "map", "filter", "join", "find", "some", "every"].includes(cle)) {
                return [][cle].bind([]);
            }
            if (["toUpperCase", "toLowerCase", "trim", "replace", "split", "slice",
                 "charAt", "padStart", "padEnd", "substring"].includes(cle)) {
                return (...a) => String(nom)[cle](...a);
            }
            return cameleon(nom + "." + String(cle));
        },
        apply() { return ""; },
        has() { return true; },
    });
}

function rendre(vue) {
    const fichier = path.join(VUES_DIR, vue + ".ejs");
    const locals = {
        lang: "fr", dir: "ltr", L: (s) => s, t: (s) => s, v: (p) => p,
        modulesQg: require("../config/modules-qg"),
        COM: require("../config/communautes").get(require("../config/communautes").DEFAUT),
        userId: "u1", typeCompte: "marchand",
    };
    for (let essai = 0; essai < 60; essai++) {
        try {
            return ejs.render(fs.readFileSync(fichier, "utf8"), locals,
                { filename: fichier, views: [VUES_DIR] });
        } catch (e) {
            const m = /(\w+) is not defined/.exec(e.message);
            if (m && !(m[1] in locals)) { locals[m[1]] = cameleon(m[1]); continue; }
            return { erreur: e.message.split("\n").slice(-2).join(" | ") };
        }
    }
    return { erreur: "plus de 60 locals manquants" };
}

const compte = (texte, motif) => (texte.match(motif) || []).length;

for (const vue of MIGREES) {
    const source = fs.readFileSync(path.join(VUES_DIR, vue + ".ejs"), "utf8");

    // ── 1. LES DEUX MOITIÉS VONT PAR PAIRE, ET DANS L'ORDRE ──────────────
    const haut = source.indexOf('moitie: "haut"');
    const bas = source.indexOf('moitie: "bas"');
    verifier(haut !== -1, `${vue}.ejs ouvre le document sans la coquille`);
    verifier(bas !== -1,
        `${vue}.ejs ouvre la coquille et ne la referme pas — le document sort sans </body>, `
        + "avec un <main> ouvert : le navigateur recolle et la page a l'air normale");
    verifier(haut === -1 || bas === -1 || haut < bas,
        `${vue}.ejs referme la coquille avant de l'ouvrir`);
    verifier(compte(source, /moitie: "haut"/g) === 1 && compte(source, /moitie: "bas"/g) === 1,
        `${vue}.ejs appelle une moitié de coquille plusieurs fois`);

    // ── 2. LA VUE N'A PLUS DE DOCUMENT À ELLE ────────────────────────────
    // Une migration à moitié faite laisse l'ancien doctype en place : deux
    // en-têtes, deux <body>, et un navigateur qui choisit tout seul.
    verifier(!/<!DOCTYPE/i.test(source),
        `${vue}.ejs garde son propre <!DOCTYPE> alors qu'il utilise la coquille`);
    verifier(!/<html|<\/html>|<head>|<\/body>/i.test(source),
        `${vue}.ejs garde des balises de document à lui en plus de la coquille`);

    // ── 3. LE DOCUMENT RENDU EST COMPLET ET ÉQUILIBRÉ ────────────────────
    const html = rendre(vue);
    if (typeof html !== "string") {
        verifier(false, `${vue}.ejs ne rend plus : ${html.erreur}`);
        continue;
    }
    for (const [motif, libelle] of [
        [/<!DOCTYPE html>/g, "<!DOCTYPE html>"],
        [/<html\b/g, "<html>"], [/<\/html>/g, "</html>"],
        [/<head>/g, "<head>"], [/<\/head>/g, "</head>"],
        [/<body\b/g, "<body>"], [/<\/body>/g, "</body>"],
        [/<main\b/g, "<main>"], [/<\/main>/g, "</main>"],
        [/<div class="og-capital">/g, 'la coquille <div class="og-capital">'],
    ]) {
        verifier(compte(html, motif) === 1,
            `${vue} : ${libelle} apparaît ${compte(html, motif)} fois au lieu d'une`);
    }
    verifier(compte(html, /<div\b/g) === compte(html, /<\/div>/g),
        `${vue} : ${compte(html, /<div\b/g)} <div> pour ${compte(html, /<\/div>/g)} </div> — `
        + "la page se referme mal, et c'est la coquille qui porte les dernières fermetures");

    // ── 4. C'EST BIEN LA BARRE ÉTROITE ───────────────────────────────────
    // La leçon de la phase précédente : un garde qui reste vert quand on lui
    // change la navigation sous les yeux ne garde rien. `og-sidebar` est à
    // la barre étroite, `qg-sidebar` à la colonne du QG.
    verifier(/class="og-sidebar"/.test(html) && !/qg-sidebar/.test(html),
        `${vue} : la coquille ne rend pas la barre étroite`);

    // ── 5. LE TITRE EST UNE VALEUR, PAS DU CODE ──────────────────────────
    const titre = /<title>([\s\S]*?)<\/title>/.exec(html);
    verifier(titre && titre[1].trim().length > 0, `${vue} : titre d'onglet vide`);
    // ⚠️ INSTRUMENT — première version de ce garde : /<%|%>/. Mesuré : il
    // restait VERT sur le vrai symptôme. La coquille écrit le titre avec
    // <%= %>, qui ÉCHAPPE le HTML : un « <%= tool.label %> » resté dans la
    // chaîne arrive dans la page en « &lt;%= tool.label %&gt; ». Le garde
    // cherchait donc une forme que le rendu rend impossible — il ne gardait
    // rien. Les deux écritures sont cherchées maintenant.
    verifier(!titre || !/<%|%>|&lt;%|%&gt;/.test(titre[1]),
        `${vue} : le titre affiche du EJS au lieu de sa valeur (« ${titre && titre[1]} ») — `
        + "un titre passé à la coquille est une EXPRESSION JavaScript, pas un gabarit");

    // ── 6. LE CONTENU DE LA PAGE EST DANS LE <main> ──────────────────────
    // Une coquille qui rend un document parfait et vide serait verte à tous
    // les gardes ci-dessus. Celui-ci regarde ce qu'il y a DEDANS.
    const dedans = /<main\b[^>]*>([\s\S]*?)<\/main>/.exec(html);
    verifier(dedans && dedans[1].replace(/\s/g, "").length > 200,
        `${vue} : le <main> est vide ou presque — la coquille a avalé le contenu de la page`);
}

// ── 7. LA COQUILLE EST LA SEULE À DÉCRIRE LE DOCUMENT ────────────────────
//
// Le but de tout ceci : un seul endroit à corriger. Si une vue migrée se
// remet à déclarer son propre en-tête, on est revenu au point de départ
// sans que rien ne le signale.
const coquille = fs.readFileSync(path.join(VUES_DIR, "app.ejs"), "utf8");
verifier(/<!DOCTYPE html>/.test(coquille) && /<\/html>/.test(coquille),
    "views/app.ejs ne contient plus le document entier");
verifier(/include\(\s*"partials\/nav"/.test(coquille),
    "views/app.ejs ne rend plus la navigation — chaque vue devrait la rappeler elle-même");

if (echecs.length) {
    console.log(`\n❌ Coquille : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.log(`   • ${e}`);
    console.log("");
    process.exit(1);
}
console.log(`✅ Coquille : ${verifs} vérifications passées (${MIGREES.length} vues : ${MIGREES.join(", ")})`);
