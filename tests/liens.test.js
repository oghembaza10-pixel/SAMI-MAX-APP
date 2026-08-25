// ==========================================================================
// SAMII OS — Les liens de l'Académie mènent-ils quelque part ?
//
// POURQUOI CE TEST EXISTE. « Quand tu arrives, déclare ton app, le lien est
// mort. Et les liens par là, ils sont tous morts. » C'est un client qui l'a
// découvert, en cliquant. Un lien mort ne lève aucune erreur, n'apparaît dans
// aucun journal, ne déclenche aucune alerte : il se contente de ne mener nulle
// part. Le test des cartes (cartes.test.js) couvrait le catalogue ; celui-ci
// couvre l'endroit où le problème a réellement été vu — les pages de
// l'Académie et l'espace développeur, là où quelqu'un décide de rester ou de
// partir.
//
// UN FORMULAIRE QUI POSTE DANS LE VIDE EST PIRE QU'UN LIEN MORT : le visiteur
// a écrit quelque chose avant de le perdre. Les `action=` sont donc vérifiées
// exactement comme les `href=`.
//
// COMMENT. On lit les fichiers, on ne démarre rien : pas de base, pas de port,
// pas de secrets. Le test tourne partout et tout le temps — y compris là où
// personne n'a envie de monter un environnement pour vérifier un lien.
//
// Lancer :  npm test
// ==========================================================================
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const lire = (p) => fs.readFileSync(path.join(RACINE, p), "utf8");

// ── 1. Ce qui est monté dans index.js ────────────────────────────────────
// app.use("/x", …) et app.use(["/x","/y"], …) : tout ce qui commence par un
// préfixe monté est servi par quelqu'un. On ne descend pas plus finement ici,
// c'est le rôle de l'étape 2 pour les routeurs qu'on vérifie vraiment.
const index = lire("index.js");
const prefixes = new Set();
for (const m of index.matchAll(/app\.use\(\s*(\[[^\]]*\]|"[^"]+")/g)) {
    for (const p of m[1].matchAll(/"([^"]+)"/g)) prefixes.add(p[1]);
}
// Les pages servies directement par app.get("/x", …) comptent aussi.
for (const m of index.matchAll(/app\.(?:get|post)\(\s*"([^"]+)"/g)) prefixes.add(m[1]);

// ── 2. Les routes réellement déclarées par les routeurs de l'Académie ────
// Ce sont les seules dont on exige une correspondance exacte : ce sont celles
// que nous écrivons, donc celles que nous pouvons casser.
const ROUTEURS = [
    { fichier: "routes/academie-porte.js", montage: "/academy" },
    { fichier: "routes/besoins.js",        montage: "/academy" },
    { fichier: "routes/dev-espace.js",     montage: "/academy/espace" },
];

const declarees = new Set();
for (const { fichier, montage } of ROUTEURS) {
    const source = lire(fichier);
    for (const m of source.matchAll(/router\.(?:get|post|put|delete|use)\(\s*"([^"]*)"/g)) {
        const chemin = (montage + m[1]).replace(/\/+$/, "") || "/";
        declarees.add(chemin);
    }
}

// ── 3. Les liens écrits dans les vues ────────────────────────────────────
const VUES = [
    "views/academie-vitrine.ejs",
    "views/academie-besoins.ejs",
    "views/academie-besoin.ejs",
    "views/academie-construire.ejs",
    "views/academie-rejoindre.ejs",
    "views/academie-mon-contrat.ejs",
    "views/academie-trouver.ejs",
    "views/dev-espace.ejs",
];

// Une adresse écrite dans une vue contient presque toujours une expression EJS
// (`/academy/besoin/<%= b.reference %>`). On la remplace par un joker : ce
// qu'on vérifie, c'est la FORME du chemin, pas la valeur qu'il prendra.
function normaliser(brut) {
    return brut
        .replace(/<%[-=]?[\s\S]*?%>/g, "*")
        .split("?")[0]
        .split("#")[0]
        .replace(/\/+$/, "") || "/";
}

// `/academy/besoin/*/repondre` doit reconnaître `/academy/besoin/:reference/repondre`.
function correspond(chemin, motif) {
    const a = chemin.split("/");
    const b = motif.split("/");
    if (a.length !== b.length) return false;
    return a.every((seg, i) => b[i] === seg || b[i].startsWith(":") || seg === "*");
}

function estAtteignable(chemin) {
    for (const motif of declarees) if (correspond(chemin, motif)) return true;
    // Sinon : est-ce servi par un préfixe monté ailleurs (/qg, /login, /apps…) ?
    const morceaux = chemin.split("/").filter(Boolean);
    for (let i = morceaux.length; i > 0; i--) {
        if (prefixes.has("/" + morceaux.slice(0, i).join("/"))) return true;
    }
    return false;
}

const cas = [];
for (const vue of VUES) {
    if (!fs.existsSync(path.join(RACINE, vue))) continue;
    const source = lire(vue);
    const liens = new Map(); // chemin → type, pour ne pas répéter le même lien

    for (const m of source.matchAll(/\b(?:href|action)="([^"]*)"/g)) {
        const brut = m[1];
        // Externes, ancres, protocoles : hors de notre responsabilité.
        if (!brut.startsWith("/")) continue;
        const chemin = normaliser(brut);
        if (chemin === "/") continue;
        // Les feuilles de style et les fichiers servis en statique.
        if (/\.(css|js|png|jpe?g|svg|ico|webp)$/i.test(chemin)) continue;
        liens.set(chemin, brut);
    }

    for (const [chemin, brut] of liens) {
        cas.push({ titre: `${path.basename(vue)} → ${brut}`, ok: estAtteignable(chemin) });
    }
}

// ── 4. Chaque vue rendue par ces routeurs existe-t-elle ? ────────────────
// L'autre moitié de la même panne : une route vivante qui rend un gabarit
// absent renvoie une 500. Le visiteur ne voit pas la différence avec un lien
// mort — nous, si.
for (const { fichier } of ROUTEURS) {
    const source = lire(fichier);
    for (const m of source.matchAll(/res\.render\(\s*"([^"]+)"/g)) {
        cas.push({
            titre: `${path.basename(fichier)} rend « ${m[1]} »`,
            ok: fs.existsSync(path.join(RACINE, "views", `${m[1]}.ejs`)),
        });
    }
}

for (const c of cas) console.log(`${c.ok ? "✓" : "✗"}  ${c.titre}`);
const echecs = cas.filter((c) => !c.ok);
console.log(`\n${cas.length - echecs.length}/${cas.length} vérifications passées`);

assert.strictEqual(echecs.length, 0,
    `${echecs.length} lien(s) ne mènent nulle part : ${echecs.map((c) => c.titre).join(" · ")}`);
process.exit(0);
