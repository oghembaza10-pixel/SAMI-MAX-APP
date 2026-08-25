// Enchaîne les suites dans des processus séparés : chacune remplace des
// modules dans son propre cache, les mélanger fausserait les résultats.
const { spawnSync } = require("child_process");
const path = require("path");

// portefeuille.test.js exige une VRAIE base (PGTEST_URL) et se saute d'elle-même
// sinon : un grand livre ne se prouve pas contre une base simulée, qui dirait
// oui à tout — y compris à un solde négatif.
const SUITES = ["permissions.test.js", "bus.test.js", "paliers.test.js", "whatsapp.test.js", "cartes.test.js", "portefeuille.test.js"];
let echecs = 0;

for (const suite of SUITES) {
    console.log(`\n━━ ${suite} ${"━".repeat(Math.max(0, 46 - suite.length))}`);
    const r = spawnSync(process.execPath, [path.join(__dirname, suite)], { stdio: "inherit" });
    if (r.status !== 0) echecs++;
}

console.log(echecs === 0
    ? `\n✅ ${SUITES.length} suites passées.`
    : `\n❌ ${echecs} suite(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
