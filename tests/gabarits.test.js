// ==========================================================================
// SAMII OS — Chaque fichier et chaque vue compilent
//
// POURQUOI CE TEST EXISTE. Cinq fois dans la même session, j'ai écrit un
// backtick à l'intérieur d'un commentaire — CSS le plus souvent — lui-même
// à l'intérieur d'un littéral de gabarit. Le backtick TERMINE la chaîne. Le
// fichier ne compile plus, et Node signale l'erreur des centaines de lignes
// plus loin, sur une ligne parfaitement innocente :
//
//     <link rel="apple-touch-icon" href="...">
//     SyntaxError: missing ) after argument list
//
// Le message ment sur l'endroit, donc on cherche le bug là où il n'est pas.
// À chaque fois, ça a coûté une fausse piste.
//
// CE QUE FAIT CE TEST. Il compile chaque fichier de routes/, services/,
// config/ et chaque vue EJS. C'est tout, et c'est suffisant : les cinq fois,
// le fichier ne compilait plus. Une suite lancée avant chaque livraison
// attrape donc la faute ici, au lieu d'un serveur qui refuse de démarrer.
//
// CE QUE J'AI ESSAYÉ ET RETIRÉ, ET POURQUOI. J'ai d'abord voulu interdire
// le backtick dans tout commentaire. Cette règle signalait dix-huit lignes
// parfaitement saines (« prix » entre backticks dans config/paliers.js, qui
// ne contient aucun gabarit). Resserrée aux commentaires de feuille de
// style, elle a laissé passer la faute que je venais d'écrire : mes
// commentaires multi-lignes ne commencent pas par une étoile. En suivant
// l'ouverture et la fermeture des blocs, elle s'est fait piéger par les
// « /* » qui vivent dans des expressions régulières.
//
// Reconnaître un commentaire sans analyser le langage revient à écrire un
// analyseur syntaxique — et il en existe déjà un, c'est Node. Un test qui
// crie sur du code sain apprend à être ignoré, et le jour où il a raison
// personne ne le lit. On garde donc la vérification qui ne se trompe jamais.
//
// Lancer :  npm test
// ==========================================================================
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const DOSSIERS = ["routes", "services", "config", "views/partials"];
const fichiers = ["index.js"];
for (const d of DOSSIERS) {
    let noms;
    try { noms = fs.readdirSync(path.join(RACINE, d)); } catch { continue; }
    for (const n of noms) if (n.endsWith(".js")) fichiers.push(path.join(d, n));
}

verifier(fichiers.length > 30,
    `on ne relit que ${fichiers.length} fichiers — le balayage ne trouve presque rien`);

for (const rel of fichiers) {
    const r = spawnSync(process.execPath, ["--check", path.join(RACINE, rel)], { encoding: "utf8" });
    const raison = String(r.stderr).split("\n").find((l) => /Error/.test(l)) || "erreur inconnue";
    verifier(r.status === 0,
        `${rel} ne compile pas : ${raison}\n     ⚠️  Si c'est « missing ) after argument list » sur une ligne qui a l'air correcte, cherche un backtick écrit dans un commentaire plus haut : il ferme la chaîne du gabarit. Écris « » à la place.`);
}

// Les vues EJS aussi : une faute de syntaxe dans un gabarit ne se voit
// qu'au moment où quelqu'un ouvre la page — c'est-à-dire en production.
const ejs = require(path.join(RACINE, "node_modules", "ejs"));
const VUES = path.join(RACINE, "views");
function listerVues(dossier, prefixe = "") {
    const sortie = [];
    for (const n of fs.readdirSync(dossier)) {
        const complet = path.join(dossier, n);
        if (fs.statSync(complet).isDirectory()) sortie.push(...listerVues(complet, prefixe + n + "/"));
        else if (n.endsWith(".ejs")) sortie.push(prefixe + n);
    }
    return sortie;
}
const gabarits = listerVues(VUES);
verifier(gabarits.length > 10, `seulement ${gabarits.length} vues trouvées`);
for (const g of gabarits) {
    let ok = true, message = "";
    try {
        ejs.compile(fs.readFileSync(path.join(VUES, g), "utf8"), { filename: path.join(VUES, g) });
    } catch (err) {
        ok = false;
        message = String(err.message).split("\n")[0];
    }
    verifier(ok, `views/${g} ne compile pas : ${message}`);
}

// ══════════════════════════════════════════════════════════════════════════
// AUCUNE VERSION D'ACTIF ÉCRITE À LA MAIN
// ══════════════════════════════════════════════════════════════════════════
//
// LE DÉFAUT, VU EN PRODUCTION. Les feuilles portaient un numéro recopié dans
// SEPT gabarits : `/css/qg-style.css?v=8`. Une règle ajoutée à la feuille sans
// toucher aux sept numéros, et les navigateurs servent l'ancienne depuis leur
// cache.
//
// Ce que ça donne : le repli « Plus » du QG était écrit, déployé, et sans
// effet. Le gabarit — jamais mis en cache — affichait bien le nouveau bouton,
// pendant que la feuille en cache n'avait pas la règle qui replie. Un
// demi-déploiement, le pire cas : la page a l'air neuve et se comporte comme
// l'ancienne, et on cherche le bug dans le code au lieu du cache.
//
// La version vient maintenant du contenu du fichier (services/actifs.js). Ce
// contrôle existe pour qu'un numéro écrit à la main ne puisse pas revenir par
// habitude dans un gabarit neuf.
{
    const aLaMain = [];
    for (const rel of listerVues(VUES)) {
        const src = fs.readFileSync(path.join(VUES, rel), "utf8");
        for (const m of src.matchAll(/(?:src|href)="(\/(?:css|js)\/[^"]*\?v=\d+)"/g)) {
            aLaMain.push(`${rel} → ${m[1]}`);
        }
    }
    verifier(aLaMain.length === 0,
        `version d'actif écrite à la main (elle sera oubliée le jour où le fichier change) :\n     ${aLaMain.join("\n     ")}\n     ⚠️  Utilise <%= v("/css/…") %> — services/actifs.js calcule l'empreinte du fichier.`);

    // Et le helper doit exister et fonctionner, sinon la consigne ci-dessus
    // renvoie vers un outil cassé.
    const actifs = require(path.join(RACINE, "services", "actifs.js"));
    verifier(/\?v=[0-9a-f]{8}$/.test(actifs.v("/css/qg-style.css")),
        "services/actifs.js ne calcule pas d'empreinte pour une feuille qui existe");
    verifier(actifs.v("/css/qg-style.css") !== actifs.v("/js/qg.js"),
        "deux fichiers différents reçoivent la même version — l'empreinte ne dépend pas du contenu");
}

if (echecs.length) {
    console.error(`❌ gabarits : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.error("   • " + e);
    process.exit(1);
}
console.log(`✅ gabarits : ${verifs} vérifications passées (${fichiers.length} fichiers, ${gabarits.length} vues)`);
