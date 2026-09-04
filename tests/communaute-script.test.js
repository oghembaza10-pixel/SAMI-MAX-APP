// ==========================================================================
// LA PAGE COMMUNAUTÉ NE DOIT PAS MOURIR AU CHARGEMENT
// ==========================================================================
//
// Signalé le 4 septembre : « dans la communauté de SAMII il n'y a rien,
// quand tu cliques pour publier ça ne réagit pas du tout, ni clic ni rien. »
//
// La page s'affichait normalement. C'est le SCRIPT qui mourait.
//
// Le composer (zone de publication) est derrière un ternaire : il n'existe
// pas pour un visiteur non connecté. Or trois branchements au premier
// niveau du script faisaient
//
//     document.getElementById("fileInput").addEventListener(...)
//
// sans `?.`. Sur `null`, ça lève une TypeError qui arrête TOUT LE SCRIPT —
// pas seulement la ligne fautive. Le bouton Publier, les j'aime, le menu
// mobile, le thème : plus rien ne répondait. Aucune trace serveur, l'erreur
// ne vit que dans la console du navigateur.
//
// ── POURQUOI CE TEST EXÉCUTE VRAIMENT LE SCRIPT ───────────────────────────
//
// Chercher « ?. » dans le texte du fichier aurait dit que le code est écrit,
// pas qu'il survit. On extrait donc le script réellement livré, on lui donne
// un DOM où le composer est ABSENT, et on regarde s'il arrive au bout.
//
// Vérifié en remettant le code d'origine : le test échoue avec
// « Cannot read properties of null (reading addEventListener) ».
const fs = require("fs");

function extraire() {
    const src = fs.readFileSync("/home/user/SAMI-MAX-APP/routes/community.js", "utf8").split("\n");
    const debut = src.findIndex((l) => l.trim() === "<script>");
    const fin   = src.findIndex((l, i) => i > debut && l.trim() === "</script>");
    let bloc = src.slice(debut + 1, fin).join("\n");
    for (let i = 0; i < 12; i++) bloc = bloc.replace(/\$\{[^{}]*\}/g, '"x"');
    return bloc;
}

// Les éléments qui n'existent PAS pour un visiteur non connecté.
const ABSENTS = new Set(["fileInput", "composerSubmit", "composerText", "uploadPreview", "uploadStatus"]);

function faireDom() {
    const faux = () => ({
        addEventListener() {}, appendChild() {}, focus() {}, click() {},
        classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        style: {}, dataset: {}, value: "", textContent: "", innerHTML: "",
        querySelectorAll: () => [], querySelector: () => null, files: [],
    });
    return {
        getElementById: (id) => (ABSENTS.has(id) ? null : faux()),
        querySelector: () => null, querySelectorAll: () => [],
        addEventListener() {}, createElement: () => faux(),
        body: faux(), documentElement: faux(),
    };
}

const bloc = extraire();
const sandbox = {
    document: faireDom(),
    localStorage: { getItem: () => null, setItem() {} },
    navigator: { serviceWorker: { register: () => Promise.resolve() }, standalone: false, userAgent: "test" },
    fetch: async () => ({ json: async () => ({}) }),
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    // `atteint` prouve que l'exécution est allée jusqu'au BOUT du script.
    atteint: false,
};
sandbox.window = {
    addEventListener() {}, location: { href: "" }, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: sandbox.navigator, localStorage: sandbox.localStorage,
};
sandbox.globalThis = sandbox;

const vm = require("vm");
vm.createContext(sandbox);
try {
    vm.runInContext(bloc + "\n;globalThis.atteint = true;", sandbox, { timeout: 5000 });
} catch (err) {
    console.log("❌ LE SCRIPT A LEVÉ :", err.message);
}
if (!sandbox.atteint) {
    console.error("\n❌ communauté : le script s'ARRÊTE en route pour un visiteur non connecté.");
    console.error("   Toute la page cesse de réagir — clics, j'aime, menu, thème.");
    console.error("   Un getElementById(...) au premier niveau n'a pas son « ?. ».\n");
    process.exit(1);
}
console.log("\n✅ communauté : 1 vérification passée — le script survit à un composer absent");
