// ==========================================================================
// SAMII OS — LE HUB : UNE SEULE SOURCE DE MÉTIERS
// ==========================================================================
//
// ── LA DUPLICATION QU'ON VIENT DE SUPPRIMER ──────────────────────────────
//
// Il y avait TROIS listes de métiers :
//
//   views/hub.ejs        12 métiers × 4 langues, écrits à la main
//   public/js/hub.js     12 identifiants + 12 libellés de secours
//   services/metiers.js  34 métiers — la source déclarée, consommée par
//                        l'onboarding, l'agence et l'API
//
// Et ce n'était pas trois copies de la même chose : elles ne partageaient
// que CINQ métiers. Le Hub affichait finance, technologie, agriculture et
// industrie — quatre secteurs que services/metiers.js documente avoir
// retirés comme ne correspondant pas au marché visé. Ils ont survécu des
// mois parce que personne ne relit un dictionnaire de gabarit.
//
// Cette suite garde le principe, pas les valeurs : UNE source, et rien qui
// la recopie. Ajouter un métier demain doit rester une ligne dans
// services/metiers.js.
//
// Lancer :  node tests/hub-metiers.test.js
// ==========================================================================

const fs = require("fs");
const path = require("path");
const METIERS = require("../services/metiers");

const RACINE = path.join(__dirname, "..");
let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const vue = fs.readFileSync(path.join(RACINE, "views/hub.ejs"), "utf8");
const route = fs.readFileSync(path.join(RACINE, "routes/hub.js"), "utf8");
const brut = fs.readFileSync(path.join(RACINE, "public/js/hub.js"), "utf8");
// ⚠️ INSTRUMENT. Les gardes ci-dessous cherchent des motifs qui figurent
// forcément dans les commentaires qui les EXPLIQUENT — « HUB_METIERS » est
// cité pour raconter ce qui a été retiré. Sans décapage, un garde se
// déclencherait sur sa propre documentation. C'est arrivé quatre fois dans
// ce projet.
const script = brut
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// ══════════════════════════════════════════════════════════════════════════
// 1. UNE SEULE SOURCE
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(/require\(["']\.\.\/services\/metiers["']\)/.test(route),
        "routes/hub.js ne lit plus services/metiers.js : le Hub s'est refait une liste");
    verifier(/metiersParGroupe/.test(route) && /metiersParGroupe/.test(vue),
        "les métiers ne traversent plus du serveur vers la vue");
    verifier(/window\.OG_METIERS/.test(vue) && /window\.OG_METIERS/.test(script),
        "le script ne lit plus les métiers envoyés par le serveur");

    // ── ET PERSONNE NE LES RECOPIE ───────────────────────────────────────
    //
    // Les trois endroits où une liste était écrite à la main. Le garde ne
    // cherche pas des noms précis : il cherche qu'une liste d'IDENTIFIANTS
    // de métiers réapparaisse quelque part.
    verifier(!/const HUB_METIERS\s*=/.test(vue),
        "le dictionnaire HUB_METIERS est revenu dans views/hub.ejs");
    verifier(!/const METIERS\s*=\s*\[/.test(script),
        "public/js/hub.js s'est refait une liste de métiers");
    verifier(!/FALLBACK_METIER_TEXT/.test(script),
        "le dictionnaire de secours des libellés est revenu : il divergera du registre");

    // Aucun des quatre secteurs abandonnés ne doit reparaître dans la vue
    // ni dans le script. Ils ne sont PAS dans le registre : s'ils
    // s'affichent, c'est qu'une liste a été réécrite à la main.
    const abandonnes = ["finance", "technologie", "agriculture", "industrie"];
    const ids = METIERS.METIERS.map((m) => m.id);
    for (const a of abandonnes) {
        verifier(!ids.includes(a),
            `« ${a} » est entré dans services/metiers.js — le registre disait l'avoir retiré`);
        verifier(!new RegExp(`["']${a}["']\\s*:`).test(script),
            `« ${a} » est réapparu dans public/js/hub.js : une liste a été réécrite à la main`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 2. LE REGISTRE RESTE COMPLET
// ══════════════════════════════════════════════════════════════════════════
//
// « Ne supprime aucun métier du registre simplement parce que l'ancien Hub
// ne l'affichait pas. » Le Hub n'en montrait que 12 ; les 22 autres ne
// doivent pas disparaître au passage.
{
    verifier(METIERS.METIERS.length >= 34,
        `le registre est tombé à ${METIERS.METIERS.length} métiers — il en déclarait 34`);
    for (const m of METIERS.METIERS) {
        verifier(!!m.id && !!m.label && !!m.groupe && !!m.icone,
            `le métier « ${m.id || "?"} » a perdu un de ses quatre champs d'affichage`);
    }
    // Les cinq que l'ancienne grille partageait avec le registre doivent y
    // être encore : les perdre serait une régression visible.
    for (const id of ["ecommerce", "restaurant", "immobilier", "livreur", "education"]) {
        verifier(METIERS.METIERS.some((m) => m.id === id),
            `« ${id} » a disparu du registre — il était affiché par l'ancien Hub`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 3. CONSULTER ≠ AGIR
// ══════════════════════════════════════════════════════════════════════════
//
// Le Hub renvoyait 302 vers /login pour un visiteur. La grille ne lit
// pourtant AUCUNE donnée de compte. On ouvre la consultation, on ne touche
// pas aux actions.
{
    const getHub = route.slice(route.indexOf('router.get("/"'), route.indexOf('router.post('));
    verifier(!/router\.get\("\/",\s*requireAuth/.test(route),
        "la consultation du Hub est de nouveau fermée : un visiteur ne verra plus les métiers");

    // Les DEUX actions gardent leur garde. C'est la moitié de la règle, et
    // c'est celle qu'on casserait sans s'en rendre compte.
    verifier(/router\.post\("\/select-workspace",\s*requireAuth/.test(route),
        "la sélection d'un QG n'est plus protégée");
    verifier(/belongsToOwner/.test(route),
        "le contrôle de propriété a disparu de la sélection de QG");

    // Un compte « client » reste renvoyé ailleurs — mais seulement s'il est
    // CONNECTÉ : un visiteur n'a pas de type de compte, et le renvoyer
    // rouvrirait le mur qu'on vient de retirer.
    verifier(/loggedIn[\s\S]{0,60}typeCompte === "client"/.test(route),
        "la redirection des comptes client ne vérifie plus qu'ils sont connectés : "
        + "un visiteur serait renvoyé ailleurs et le Hub redeviendrait fermé");

    // Et la liste des QG reste vide sans session.
    verifier(/req\.session\?\.loggedIn \? \(req\.session\.email \|\| ""\) : ""/.test(route),
        "l'e-mail est lu sans vérifier la session : un visiteur pourrait recevoir des QG");
}

// ══════════════════════════════════════════════════════════════════════════
// 4. LA RECHERCHE CHERCHE, ET RIEN NE PROMET DU VIDE
// ══════════════════════════════════════════════════════════════════════════
//
// MESURÉ avant ce chantier : taper « dentiste » laissait les treize cartes
// en place. Le champ disait « cherche » et ouvrait un menu.
{
    verifier(/function correspond\(/.test(script) && /renderMetierGrid\(\)/.test(script),
        "la saisie ne redessine plus la grille : la recherche ne filtrera rien");
    verifier(/normalize\(["']NFD["']\)/.test(script),
        "les accents ne sont plus ignorés : « patisserie » ne trouvera pas « Pâtisserie »");
    verifier(/filtre = input\.value/.test(script),
        "le champ de recherche n'alimente plus le filtre");

    // Plus aucune promesse non tenue.
    verifier(!/bient[oô]t disponible/i.test(script),
        "un « bientôt disponible » est revenu : une promesse qu'on ne tient pas fait revenir vérifier");
    verifier(!/bient[oô]t disponible/i.test(vue.replace(/<%#[\s\S]*?%>/g, "")),
        "un « bientôt disponible » est revenu dans le gabarit du Hub");
}

// ══════════════════════════════════════════════════════════════════════════
// 5. VOIR PLUS, ET CRÉER SON MÉTIER
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(/VISIBLES_AU_DEPART/.test(script),
        "la grille n'a plus de sélection de départ : 34 cartes d'un coup, c'est un catalogue");
    // ⚠️ `/data-voir-plus/` NE SUFFIT PAS : l'attribut apparaît DEUX fois —
    // dans le bouton qu'on dessine, et dans le sélecteur qui l'écoute.
    // Vérifié par mutation : retirer le bouton laissait le garde vert,
    // parce que le sélecteur, lui, était toujours là. On exige les deux.
    verifier(/data-voir-plus>/.test(script),
        "le bouton « Voir plus de métiers » n'est plus dessiné");
    verifier(/closest\(["']\[data-voir-plus\]["']\)/.test(script),
        "plus rien n'écoute « Voir plus de métiers » : le bouton serait décoratif");
    // Il doit ouvrir la liste SUR PLACE. Renvoyer ailleurs pour voir les
    // métiers du Hub serait exactement la duplication qu'on retire.
    verifier(/toutAffiche = true/.test(script),
        "« Voir plus » ne déplie plus la liste sur place");
    verifier(/data-creer-metier/.test(script) && /data-creer-metier/.test(vue),
        "« Créer mon métier » n'est plus atteignable");
    verifier(/id="creer-metier"/.test(vue), "la coquille du questionnaire a disparu du gabarit");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LE QUESTIONNAIRE REMPLIT LE CONTRAT EXISTANT
// ══════════════════════════════════════════════════════════════════════════
//
// « NE MODIFIE PAS inutilement le contrat existant. » Le questionnaire ne
// crée pas de route : il remplit `POST /workspace/create` tel qu'il est.
{
    const ws = fs.readFileSync(path.join(RACINE, "routes/workspace.js"), "utf8");
    verifier(/const \{ nom, metier, metierCustom, description, pays, devise \} = req\.body;/.test(ws),
        "le contrat de POST /workspace/create a changé : le questionnaire ne le remplit plus");
    verifier(/router\.post\("\/create",\s*requireAuth/.test(ws),
        "la création de QG n'est plus protégée");

    for (const champ of ["nom:", "metier:", "metierCustom:", "description:", "pays:", "devise:"]) {
        verifier(script.includes(champ),
            `le questionnaire n'envoie plus « ${champ.replace(":", "")} »`);
    }
    // `metier: "autre"` + `metierCustom` est le chemin du métier libre que la
    // route prévoyait déjà. Inventer une autre valeur la ferait échouer.
    verifier(/metier:\s*["']autre["']/.test(script),
        "le questionnaire n'utilise plus le chemin du métier libre prévu par la route");

    // Les sept questions demandées.
    for (const cle of ["metierCustom", "nom", "prenom", "nomFamille", "pays", "langue", "description"]) {
        verifier(new RegExp(`cle:\\s*["']${cle}["']`).test(script),
            `la question « ${cle} » manque au questionnaire`);
    }

    // ── AUCUN QG FANTÔME ─────────────────────────────────────────────────
    //
    // Créer le QG à la troisième question laisserait un espace derrière
    // chaque personne qui abandonne. Un seul appel, au dernier écran.
    const appels = (script.match(/fetch\(["']\/workspace\/create["']/g) || []).length;
    verifier(appels === 1,
        `${appels} appels à /workspace/create dans le questionnaire — il doit y en avoir exactement un, `
        + "au dernier écran, sinon un abandon laisse un QG fantôme");
    // ⚠️ COMPTER LES `fetch` NE SUFFIT PAS. Vérifié par mutation : appeler
    // `creerLeQG()` depuis `etapeSuivante()` crée le QG à la PREMIÈRE
    // question sans ajouter un seul `fetch` de plus — le garde restait vert
    // pendant que chaque abandon laissait un QG fantôme.
    //
    // On compte donc les SITES D'APPEL : la définition, et le clic sur
    // « Créer mon QG » du dernier écran. Deux, pas trois.
    const sitesCreation = (script.match(/creerLeQG\s*\(/g) || []).length;
    verifier(sitesCreation === 2,
        `« creerLeQG » apparaît ${sitesCreation} fois au lieu de 2 (sa définition + le clic final) — `
        + "s'il est appelé ailleurs, le QG est créé avant que la personne ait fini, et un abandon "
        + "laisse un espace derrière lui");

    verifier(/if \(!window\.OG_CONNECTE\)/.test(script),
        "le questionnaire ne distingue plus le visiteur du membre : il tenterait une création "
        + "protégée, qui échouerait, et perdrait les réponses");
    verifier(/sessionStorage\.setItem\(["']samii\.creation["']/.test(script),
        "les réponses d'un visiteur ne sont plus gardées avant l'inscription");

    verifier(/Bienvenue dans ton QG/.test(script),
        "le message d'arrivée « Bienvenue dans ton QG » a disparu");
    verifier(/location\.href = ["']\/qg["']/.test(script),
        "on n'arrive plus dans le QG après la création");
}

// ══════════════════════════════════════════════════════════════════════════
// 7. LES PAYS NE SONT PAS RECOPIÉS NON PLUS
// ══════════════════════════════════════════════════════════════════════════
{
    const ws = require("../routes/workspace");
    verifier(ws.PAYS_DEVISE && Object.keys(ws.PAYS_DEVISE).length >= 10,
        "routes/workspace.js n'exporte plus ses pays : le questionnaire en recopierait une liste");
    verifier(/require\(["']\.\/workspace["']\)\.PAYS_DEVISE/.test(route),
        "le Hub ne lit plus les pays là où la création les valide : il pourrait en proposer un refusé");
    verifier(!/CM:\s*\{|DZ:\s*\{/.test(script),
        "une liste de pays est réapparue dans public/js/hub.js");
}

if (echecs.length) {
    console.log(`\n❌ Hub / métiers : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.log(`   • ${e}`);
    console.log("");
    process.exit(1);
}
console.log(`✅ Hub / métiers : ${verifs} vérifications passées`);
