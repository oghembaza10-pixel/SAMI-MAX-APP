// ==========================================================================
// LA PAGE D'ACCUEIL DOIT MENER QUELQUE PART
// ==========================================================================
//
// Constaté le 7 septembre, sur la page en ligne : la barre du haut ne
// contenait que les langues et « Se connecter ».
//
// Un visiteur ne pouvait NI voir les tarifs, NI savoir ce que fait SAMII,
// NI nous joindre. Les sections existaient pourtant déjà dans le gabarit —
// #tarifs, #agences, #developpeurs — mais AUCUN chemin n'y menait. Du
// contenu écrit, mis en ligne, et inatteignable : le même défaut que les
// fonctions de réponse aux commentaires, mais côté visiteur.
//
// Et surtout : aucun bouton WhatsApp. On vend une plateforme qui automatise
// WhatsApp, et on ne pouvait pas nous y écrire.
//
// ── CE QUE CE TEST VÉRIFIE, ET POURQUOI AINSI ─────────────────────────────
//
// Il REND le gabarit, comme le serveur le fait, puis vérifie que chaque
// ancre du rideau pointe vers une section qui existe VRAIMENT dans la page
// produite. Lire le gabarit aurait dit que le lien est écrit — pas qu'il
// mène quelque part. Une ancre morte ne lève aucune erreur : le navigateur
// ne bouge pas, et personne ne comprend pourquoi.

const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
// Les MÊMES tarifs que ceux servis par index.js : la page d'accueil les lit
// de config/paliers.js pour qu'on ne puisse pas annoncer un prix en vitrine
// et en encaisser un autre. Le test doit donc les fournir aussi, sinon il
// rend un gabarit que le serveur ne rend jamais.
const paliers = require("../config/paliers");

let passees = 0;
const echecs = [];
const verifier = (ok, quoi) => { passees++; if (!ok) { echecs.push(quoi); console.error(`  ❌ ${quoi}`); } };

const GABARIT = path.join(__dirname, "..", "views", "index.ejs");
const NUMERO = "213558426208";        // +213 558 42 62 08

let page = "";
try {
    page = ejs.render(fs.readFileSync(GABARIT, "utf8"), {
        loggedIn: false, nom: "", typeCompte: "client",
        tarifs: paliers.PALIERS,
    }, { filename: GABARIT });
} catch (err) {
    console.error(`\n❌ accueil : le gabarit ne compile pas — ${err.message}\n`);
    process.exit(1);
}

console.log("── Le rideau existe et s'ouvre ──");
{
    verifier(/id="rideau-btn"/.test(page), "le bouton Menu est dans la page");
    verifier(/class="rideau" id="rideau"/.test(page), "le panneau du rideau est dans la page");
    verifier(/aria-expanded/.test(page), "le bouton dit s'il est ouvert (lecteurs d'écran)");
    verifier(/aria-controls="rideau"/.test(page), "et ce qu'il commande");

    // Trois façons de fermer. Un menu qui ne se ferme que par son propre
    // bouton piège les gens sur mobile, où la cible est petite.
    verifier(/Escape/.test(page), "la touche Échap ferme le rideau");
    verifier(/rideau\.contains\(e\.target\)/.test(page), "un clic à côté ferme le rideau");
    verifier(/e\.target\.closest\("a"\)/.test(page), "un clic sur un lien ferme le rideau");
}

console.log("── AUCUNE ANCRE MORTE ──");
{
    // Le cœur du test. Un lien vers #tarifs qui ne trouve pas de section
    // #tarifs ne fait RIEN quand on clique — sans erreur, sans message.
    const bloc = /(<div class="rideau" id="rideau">[\s\S]*?)<\/div>\s*<\/div>/.exec(page);
    verifier(bloc !== null, "le bloc du rideau est lisible");

    const ancres = bloc ? [...bloc[1].matchAll(/href="#([a-z-]+)"/g)].map((m) => m[1]) : [];
    verifier(ancres.length >= 4, `le rideau porte au moins 4 ancres (${ancres.length} trouvées)`);

    for (const cible of ancres) {
        verifier(new RegExp(`id="${cible}"`).test(page),
            `l'ancre #${cible} pointe vers une section qui n'existe pas — le clic ne fera rien`);
    }

    // Les trois sections qu'un visiteur cherche en premier.
    for (const attendue of ["tarifs", "modules"]) {
        verifier(new RegExp(`href="#${attendue}"`).test(page), `le rideau mène aux ${attendue}`);
    }
}

console.log("── WhatsApp, sur le bon numéro ──");
{
    // On vend l'automatisation de WhatsApp. Ne pas pouvoir nous y écrire
    // était le manque le plus visible de la page.
    const liens = (page.match(new RegExp(`wa\\.me/${NUMERO}`, "g")) || []).length;
    verifier(liens >= 2, `WhatsApp est joignable à deux endroits — rideau et bouton flottant (${liens})`);
    verifier(/class="wa-flottant"/.test(page), "le bouton flottant est présent");
    verifier(/\+213 558 42 62 08/.test(page), "le numéro est écrit en clair dans le rideau");

    // Un mauvais numéro envoie les clients chez quelqu'un d'autre : on
    // vérifie qu'AUCUN autre numéro wa.me ne traîne dans la page.
    const autres = [...page.matchAll(/wa\.me\/(\d+)/g)].map((m) => m[1]).filter((n) => n !== NUMERO);
    verifier(autres.length === 0, `un autre numéro WhatsApp traîne dans la page : ${autres.join(", ")}`);
}

console.log("── Marketplace et Communauté sont montrées ──");
{
    // Mesuré : les deux sont DÉJÀ publiques dans le code (aucun requireAuth
    // sur leur route d'accueil). Elles étaient simplement invisibles.
    verifier(/href="\/marketplace"/.test(page), "la Marketplace a un chemin depuis l'accueil");
    verifier(/href="\/community"/.test(page), "la Communauté aussi");
    verifier(/mailto:contact@/.test(page), "un email de contact est donné");
}

if (echecs.length) {
    console.error(`\n❌ accueil : ${echecs.length} problème(s) sur ${passees} vérifications\n`);
    for (const e of echecs) console.error(`   • ${e}`);
    process.exit(1);
}
console.log(`\n✅ accueil : ${passees} vérifications passées`);
