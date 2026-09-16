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

console.log("── La barre du haut tient dans un téléphone ──");
{
    // ── CE QUI S'EST PASSÉ ────────────────────────────────────────────────
    //
    // Mesuré au navigateur sur /accueil-classique, à 320, 375 et 390 px :
    // document.scrollWidth valait 458 — LA MÊME VALEUR aux trois largeurs.
    // La barre ne rétrécissait pas, elle dépassait, et toute la page glissait
    // latéralement avec elle. « Se connecter » sortait de l'écran : il en
    // restait deux lettres, et personne ne pouvait s'inscrire depuis un
    // téléphone sans faire défiler la page de côté pour attraper le bouton.
    //
    // La cause : la marque (128 px) et le bloc de droite (310 px) sont des
    // éléments flex, et un élément flex a min-width:auto — il ne descend
    // jamais sous la largeur de son contenu. 128 + 310 + 40 de marges = 478
    // à réclamer dans une vue de 390.
    //
    // ── CE QUE CE GARDE PEUT, ET NE PEUT PAS ──────────────────────────────
    //
    // Il lit du texte, donc il ne remesure pas une mise en page : seul un
    // navigateur le ferait, et la suite n'en embarque pas. Il tient les deux
    // choses dont dépend la correction — la barre a le droit de se replier,
    // et AUCUNE commande n'a disparu au passage. C'est la deuxième qui
    // compte le plus : la façon la plus tentante de « régler » un
    // débordement est de supprimer ce qui dépasse.
    const barre = /<header class="top-bar">[\s\S]*?<\/header>/.exec(page);
    verifier(barre !== null, "la barre du haut est lisible dans la page");
    const dedans = barre ? barre[0] : "";

    // 1. Les quatre commandes sont toujours là.
    verifier(/class="lang-switch"/.test(dedans), "le choix de langue est encore dans la barre");
    const langues = (dedans.match(/data-lang="[a-z]+"/g) || []).length;
    verifier(langues === 4,
        `${langues} langue(s) dans la barre au lieu de 4 — on n'élargit pas un téléphone en ` +
        "retirant l'arabe ou le chinois");
    verifier(/id="rideau-btn"/.test(dedans), "le bouton Menu est encore dans la barre");
    verifier(/class="btn-login-top"/.test(dedans),
        "« Se connecter » a disparu de la barre — c'est le bouton qui débordait, " +
        "le supprimer réglerait le débordement et rien d'autre");

    // 2. Le mot « Menu » est masqué sur petit écran : l'icône à trois traits
    //    dit la même chose. Le bouton doit donc garder son nom accessible,
    //    sinon un lecteur d'écran n'annonce plus qu'« un bouton ».
    verifier(/aria-label="Menu"/.test(dedans),
        "le bouton Menu n'a plus d'aria-label alors que son libellé visible est masqué " +
        "sous 560 px : il ne s'annoncerait plus à un lecteur d'écran");

    // 3. La règle mobile existe et porte ce qui empêche la poussée.
    const gabarit = fs.readFileSync(GABARIT, "utf8");
    // Il y a PLUSIEURS blocs « max-width: 560px » dans ce gabarit — un autre
    // masque le libellé du bouton WhatsApp flottant. Prendre le premier venu
    // faisait crier ce garde sur une règle qui n'a rien à voir : on cherche
    // celui qui parle de la barre.
    const blocs560 = [...gabarit.matchAll(/@media \(max-width: 560px\) \{([\s\S]*?)\n        \}/g)];
    const mobile = blocs560.find((b) => /\.top-bar/.test(b[1])) || null;
    verifier(mobile !== null,
        "la règle mobile de la barre du haut a disparu : la barre redeviendrait plus large " +
        "que l'écran et repousserait toute la page");
    const regle = mobile ? mobile[1] : "";
    verifier(/\.top-bar \{[^}]*flex-wrap:\s*wrap/.test(regle),
        "la barre ne peut plus se replier sur deux lignes : elle n'a alors aucun moyen de " +
        "tenir dans 320 px, où ses commandes réclament 438 px à elles seules");
    verifier(/\.top-bar__right \{[^}]*flex-wrap:\s*wrap/.test(regle),
        "le bloc de droite ne peut plus se replier — c'est lui qui portait le débordement");

    // 4. Et le desktop n'a pas été emporté au passage.
    verifier(/@media \(min-width: 768px\) \{\s*\.top-bar \{\s*padding: 17px 32px;/.test(gabarit),
        "la règle desktop de la barre a changé — ce chantier ne corrige que le téléphone");
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
