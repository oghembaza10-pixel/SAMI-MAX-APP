// ==========================================================================
// SAMII OS — Les cartes mènent-elles quelque part ?
//
// Pourquoi ce test existe. Onze cartes sur quinze pointaient vers une adresse
// qui n'était montée nulle part : /griot au lieu de /samii/griot, /miroir au
// lieu de /samii/miroir, et ainsi de suite. Personne ne s'en était aperçu
// depuis des mois, pour une raison simple et vicieuse : un lien mort ne lève
// aucune erreur, n'apparaît dans aucun journal, ne déclenche aucune alerte.
// Il se contente de ne mener nulle part. Seul quelqu'un qui clique le
// découvre — et ce quelqu'un-là, c'est un client.
//
// Ce que ce test vérifie : chaque `route` du catalogue correspond à un
// app.use() réellement présent dans index.js. Il lit le fichier plutôt que de
// démarrer le serveur — pas de base, pas de port, pas de secrets, donc il
// tourne partout et tout le temps.
//
// Lancer :  npm test
// ==========================================================================
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const { CARTES } = require(path.join(RACINE, "config/cartes-catalog"));
const index = fs.readFileSync(path.join(RACINE, "index.js"), "utf8");

// Tous les préfixes montés : app.use("/x", ...) et app.use(["/x", "/y"], ...).
const prefixes = new Set();
for (const m of index.matchAll(/app\.use\(\s*(\[[^\]]*\]|"[^"]+")/g)) {
    for (const p of m[1].matchAll(/"([^"]+)"/g)) prefixes.add(p[1]);
}

// Une route est atteignable si elle est montée telle quelle, ou si l'un de ses
// préfixes l'est — /samii/griot est servi par app.use("/samii/griot", …) comme
// par app.use("/samii", …).
function estAtteignable(route) {
    const morceaux = route.split("/").filter(Boolean);
    for (let i = morceaux.length; i > 0; i--) {
        if (prefixes.has("/" + morceaux.slice(0, i).join("/"))) return true;
    }
    return false;
}

const cas = [];
for (const carte of CARTES) {
    const ok = estAtteignable(carte.route);
    cas.push({ titre: `${carte.nom} → ${carte.route}`, ok });
}

// Deux gardes-fous sur le catalogue lui-même : un identifiant en double casse
// silencieusement le déblocage (deux cartes se disputent la même clé), et une
// route en double signifie presque toujours un copier-coller non relu.
const ids = CARTES.map((c) => c.id);
cas.push({ titre: "aucun identifiant de carte en double", ok: new Set(ids).size === ids.length });
const routes = CARTES.map((c) => c.route);
cas.push({ titre: "aucune adresse en double", ok: new Set(routes).size === routes.length });

for (const c of cas) console.log(`${c.ok ? "✓" : "✗"}  ${c.titre}`);
const echecs = cas.filter((c) => !c.ok);
console.log(`\n${cas.length - echecs.length}/${cas.length} vérifications passées`);

assert.strictEqual(echecs.length, 0,
    `${echecs.length} carte(s) mènent nulle part : ${echecs.map((c) => c.titre).join(" · ")}`);
process.exit(0);
