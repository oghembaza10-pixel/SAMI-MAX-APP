// ==========================================================================
// SAMII OS — LE MÉTIER DEVIENT UN CONTEXTE OPÉRATIONNEL
// ==========================================================================
//
// ── CE QUE LE MÉTIER FAISAIT AVANT CE CHANTIER ────────────────────────────
//
// Mesuré, consommateur par consommateur :
//
//   • trois phrases par métier  → perte / défaut / réponse, poussées dans le
//                                 prompt par competences.pourLePrompt() ;
//   • un aiguillage à DEUX      → typeParcours() : rdv ou produit, et rien
//                                 d'autre dans tout le projet ;
//   • une liste de mots         → pour reconnaître le métier dans une phrase.
//
// C'est réel, mais ça ne fait pas un contexte opérationnel. Un e-commerçant
// et un restaurateur recevaient le MÊME SAMII à deux phrases près, alors que
// « stock » ne désigne pas la même chose chez eux : des références en rayon
// d'un côté, des matières premières périssables de l'autre.
//
// ── CE QUE CETTE SUITE DÉFEND ─────────────────────────────────────────────
//
// Pas « le fichier existe ». Quatre choses, chacune avec sa contre-preuve :
//
//   1. UN SEUL REGISTRE. La spécialisation vit dans services/metiers.js, la
//      source déjà unique. Un second dictionnaire de métiers aurait divergé
//      au premier métier ajouté — c'est arrivé trois fois dans ce projet.
//   2. UN SEUL CERVEAU. Le contexte enrichit le prompt existant ; il ne
//      fabrique pas un deuxième assistant par secteur.
//   3. RIEN D'INVENTÉ. Une intégration déclarée doit exister vraiment dans
//      routes/connector.js, et une action « exécutable » doit nommer un outil
//      qui existe vraiment dans config/niveaux.js. Promettre une capacité
//      qu'on n'a pas est pire que de ne rien promettre.
//   4. LE COÛT. Le contexte est sérialisé dans le prompt à CHAQUE message,
//      dans les deux chats. Une fiche entière recopiée, c'est la facture qui
//      monte sans que rien ne le dise.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const fs = require("fs");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const metiers = require(path.join(RACINE, "services", "metiers.js"));
const competences = require(path.join(RACINE, "services", "competences.js"));
const niveaux = require(path.join(RACINE, "config", "niveaux.js"));

// Les six secteurs approfondis. Les autres métiers gardent exactement ce
// qu'ils avaient : une fiche, un parcours, des mots. Un métier sans
// spécialisation est un cas NORMAL, pas une panne — c'est ce qui permet
// d'industrialiser les 28 autres un par un, sans big bang.
const PILOTES = ["ecommerce", "restaurant", "grossiste", "location_voitures", "avocat", "comptable"];

// ══════════════════════════════════════════════════════════════════════════
// 1. UN SEUL REGISTRE — pas de taxonomie parallèle
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(typeof metiers.SECTEURS === "object" && metiers.SECTEURS !== null,
        "services/metiers.js n'exporte pas SECTEURS : la spécialisation vivrait ailleurs que dans " +
        "la source unique, et divergerait de la liste au premier métier ajouté");

    const S = metiers.SECTEURS || {};

    for (const id of PILOTES) {
        verifier(metiers.estValide(id),
            `« ${id} » est déclaré secteur pilote mais n'existe pas dans METIERS — ` +
            "une spécialisation sans métier est un registre parallèle");
        verifier(!!S[id], `« ${id} » n'a aucune spécialisation`);
    }

    // Et l'inverse : aucun secteur ne doit nommer un métier inconnu.
    const orphelins = Object.keys(S).filter((id) => !metiers.estValide(id));
    verifier(orphelins.length === 0,
        `SECTEURS nomme des métiers qui n'existent pas : ${orphelins.join(", ")}`);

    // ── PAS DE DEUXIÈME NOM, PAS DE DEUXIÈME VOCABULAIRE ─────────────────
    //
    // La tentation est de redonner au secteur son label et ses mots « pour
    // qu'il soit complet ». Deux endroits qui portent le nom d'un métier,
    // c'est deux endroits à corriger le jour où il change — et le second
    // n'est jamais corrigé.
    const redondants = [];
    for (const [id, s] of Object.entries(S)) {
        for (const cle of ["label", "nom", "parcours", "mots", "vocabulaire", "icone", "groupe"]) {
            if (s && Object.prototype.hasOwnProperty.call(s, cle)) redondants.push(`${id}.${cle}`);
        }
    }
    verifier(redondants.length === 0,
        `SECTEURS redéclare ce que METIERS et VOCABULAIRE portent déjà : ${redondants.join(", ")} — ` +
        "deux sources pour une même information finissent toujours par se contredire");
}

// ══════════════════════════════════════════════════════════════════════════
// 2. LES DIX DIMENSIONS, RÉELLEMENT REMPLIES
// ══════════════════════════════════════════════════════════════════════════
{
    const S = metiers.SECTEURS || {};
    const LISTES = ["objets", "donnees", "problemes", "actions", "workflows", "outilsDuSecteur", "integrations", "memoire"];
    const TEXTES = ["description", "contexte", "expertise"];

    for (const id of PILOTES) {
        const s = S[id];
        if (!s) continue;
        for (const cle of TEXTES) {
            verifier(typeof s[cle] === "string" && s[cle].trim().length >= 40,
                `${id}.${cle} est vide ou trop court — une dimension déclarée mais pas remplie ` +
                "donne l'illusion d'une spécialisation qui n'existe pas");
        }
        for (const cle of LISTES) {
            // `integrations` peut être vide : un secteur dont AUCUN outil
            // n'est branché doit pouvoir le dire. C'est une information, pas
            // un trou — et c'est même l'information la plus honnête.
            const mini = cle === "integrations" ? 0 : 3;
            verifier(Array.isArray(s[cle]) && s[cle].length >= mini,
                `${id}.${cle} n'est pas une liste d'au moins ${mini} entrées`);
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 3. RIEN D'INVENTÉ — intégrations et actions doivent exister
// ══════════════════════════════════════════════════════════════════════════
{
    const S = metiers.SECTEURS || {};

    // La liste canonique des intégrations est celle de routes/connector.js :
    // c'est elle que le marchand voit dans son QG. On la lit, on n'en écrit
    // pas une deuxième.
    const TOOLS = require(path.join(RACINE, "routes", "connector.js")).TOOLS || [];
    const branchees = new Set(TOOLS.filter((t) => t.available).map((t) => t.id));
    verifier(branchees.size > 5,
        `seulement ${branchees.size} intégration(s) lues depuis routes/connector.js — la liste n'a pas été trouvée`);

    const inventees = [];
    for (const [id, s] of Object.entries(S)) {
        for (const i of s.integrations || []) {
            if (!branchees.has(i)) inventees.push(`${id} → « ${i} »`);
        }
    }
    verifier(inventees.length === 0,
        `intégration(s) déclarée(s) qui n'existent pas dans routes/connector.js : ${inventees.join(", ")} — ` +
        "annoncer un branchement qu'on n'a pas est la promesse la plus chère du produit");

    // Les outils RÉELLEMENT exécutables, lus dans config/niveaux.js.
    const reels = new Set();
    for (const famille of Object.values(niveaux.FAMILLES || {})) for (const o of famille) reels.add(o);
    verifier(reels.size >= 15, `seulement ${reels.size} outils lus dans config/niveaux.js`);

    const fantomes = [];
    let executables = 0;
    for (const [id, s] of Object.entries(S)) {
        for (const a of s.actions || []) {
            verifier(a && typeof a.dire === "string" && a.dire.trim().length > 5,
                `${id} : une action sans phrase — « dire » est ce que la personne tape`);
            verifier(a && Object.prototype.hasOwnProperty.call(a, "fait"),
                `${id} : l'action « ${a && a.dire} » ne dit pas si SAMII sait la FAIRE ou seulement la comprendre`);
            if (a && a.fait) {
                executables++;
                if (!reels.has(a.fait)) fantomes.push(`${id} → « ${a.fait} »`);
            }
        }
    }
    verifier(fantomes.length === 0,
        `action(s) annoncée(s) comme exécutables par un outil qui n'existe pas : ${fantomes.join(", ")} — ` +
        "SAMII promettrait un geste qu'il ne sait pas faire");
    verifier(executables >= 4,
        `${executables} action(s) réellement exécutables sur les six secteurs — si aucune ne l'est, ` +
        "la distinction entre comprendre et faire n'a pas été tenue");
}

// ══════════════════════════════════════════════════════════════════════════
// 4. LE MÊME MOT, DEUX UNIVERS — c'est tout l'objet du chantier
// ══════════════════════════════════════════════════════════════════════════
{
    const S = metiers.SECTEURS || {};
    const dit = (id, mot) => JSON.stringify(S[id] || {}).toLowerCase().includes(mot);

    // « stock » chez un restaurateur, ce sont des matières premières ; chez un
    // e-commerçant, des références en rayon. Si les deux secteurs disaient la
    // même chose, la spécialisation ne servirait à rien.
    verifier(dit("restaurant", "ingr") || dit("restaurant", "matière") || dit("restaurant", "matiere"),
        "le secteur restaurant ne parle jamais de matières premières ni d'ingrédients — " +
        "son « stock » serait celui d'une boutique");
    verifier(dit("ecommerce", "variante") || dit("ecommerce", "référence") || dit("ecommerce", "reference"),
        "le secteur e-commerce ne parle ni de variantes ni de références");
    verifier(!dit("restaurant", "variante"),
        "le secteur restaurant parle de « variantes » — c'est le vocabulaire d'une boutique en ligne");

    // Avocat et comptable ne sont pas deux catégories du même moule.
    verifier(dit("avocat", "audience"), "le secteur avocat ne parle jamais d'audience");
    verifier(dit("comptable", "déclaration") || dit("comptable", "declaration"),
        "le secteur comptable ne parle jamais de déclaration");
    verifier(!dit("comptable", "audience"),
        "le secteur comptable parle d'audiences — c'est la vie d'un avocat, pas la sienne");

    // Location : un véhicule qui part et qui revient, pas un colis.
    verifier(dit("location_voitures", "caution") && dit("location_voitures", "kilom"),
        "le secteur location ne parle ni de caution ni de kilométrage");

    // Grossiste : le volume et le prix par palier, pas la vente au détail.
    verifier(dit("grossiste", "quantit") || dit("grossiste", "palier") || dit("grossiste", "volume"),
        "le secteur grossiste ne parle ni de quantité, ni de palier, ni de volume");

    // Et aucun secteur ne doit être la copie d'un autre.
    const empreintes = new Map();
    for (const id of PILOTES) {
        const e = JSON.stringify([(S[id] || {}).objets, (S[id] || {}).donnees, (S[id] || {}).problemes]);
        if (empreintes.has(e)) verifier(false, `« ${id} » et « ${empreintes.get(e)} » ont exactement les mêmes objets, données et problèmes`);
        empreintes.set(e, id);
    }
    verifier(empreintes.size === PILOTES.length, "deux secteurs pilotes sont identiques");
}

// ══════════════════════════════════════════════════════════════════════════
// 5. LE CHEMIN JUSQU'À SAMII — un seul cerveau, un contexte compact
// ══════════════════════════════════════════════════════════════════════════
{
    // La fiche porte la spécialisation ; c'est elle que tout le monde lit.
    const f = metiers.fiche("restaurant");
    verifier(f && f.secteur && Array.isArray(f.secteur.objets),
        "fiche(\"restaurant\").secteur ne rend pas la spécialisation — un appelant devrait " +
        "aller la chercher lui-même dans une deuxième table");
    verifier(metiers.fiche("coiffeur") && metiers.fiche("coiffeur").secteur === null,
        "un métier sans spécialisation ne rend pas `secteur: null` — un appelant qui reçoit " +
        "undefined finit toujours par écrire sa propre valeur de repli, et elle diverge");

    // ── CE QUI PART DANS LE PROMPT ───────────────────────────────────────
    //
    // brain/prompts/index.js sérialise le contexte à CHAQUE message, dans les
    // deux chats. Ce qu'on pose ici est payé en jetons à chaque fois.
    const bloc = competences.pourLePrompt({ metier: "restaurant", message: "il me manque quoi pour demain ?" });
    verifier(bloc && bloc.secteur, "pourLePrompt ne transmet pas le secteur : la spécialisation " +
        "resterait dans le code et n'atteindrait jamais SAMII");
    verifier(bloc && bloc.metier && bloc.cequiCoute,
        "pourLePrompt a perdu ce qu'il transmettait déjà — les trois phrases du métier");

    const sansSecteur = competences.pourLePrompt({ metier: "coiffeur", message: "bonjour" });
    verifier(sansSecteur && !sansSecteur.secteur,
        "un métier non spécialisé reçoit quand même un bloc secteur — il serait vide et coûterait " +
        "des jetons à chaque message");

    // ── LE PLAFOND, POSÉ SUR UNE MESURE ET NON SUR UNE INTUITION ─────────
    //
    // Première version de ce garde : 900, choisi avant de mesurer. Il était
    // rouge sur les six secteurs. Ce n'était pas le code qui débordait, c'est
    // le chiffre qui était inventé — alors on a mesuré :
    //
    //     bloc de base (avant 9c)   352 à  484 caractères
    //     projection du secteur     613 à  671
    //     total envoyé              992 à 1146
    //     spécialisation entière   2149 à 2398   ← ce qu'on n'envoie PAS
    //
    // Le plafond est donc posé au-dessus du maximum réel, avec de la marge
    // pour une reformulation. Ce qu'il empêche, c'est la CROISSANCE : ajouter
    // `problemes` (+300) ou `workflows` (+400) à la projection le ferait
    // tomber, et c'est exactement le geste contre lequel il existe.
    const PLAFOND = 1300;
    const taille = JSON.stringify(bloc).length;
    verifier(taille <= PLAFOND,
        `le bloc envoyé à SAMII pèse ${taille} caractères (plafond ${PLAFOND}) — il est sérialisé ` +
        "dans le prompt à chaque message, dans les deux chats");

    // Et aucun secteur ne doit déborder seul.
    const gros = [];
    for (const id of PILOTES) {
        const b = competences.pourLePrompt({ metier: id, message: "bonjour" });
        const t = JSON.stringify(b || {}).length;
        if (t > PLAFOND) gros.push(`${id} (${t})`);
    }
    verifier(gros.length === 0, `secteur(s) au-dessus du plafond : ${gros.join(", ")}`);

    // La preuve que c'est bien une projection : la table entière est
    // nettement plus lourde que ce qui en part.
    const entier = JSON.stringify((metiers.SECTEURS || {}).restaurant || {}).length;
    const partant = JSON.stringify(bloc.secteur || {}).length;
    verifier(entier > partant * 2,
        `la spécialisation entière (${entier}) n'est pas nettement plus grosse que ce qui part ` +
        `(${partant}) — ce n'est donc pas une projection, c'est une recopie`);

    // Ce qui NE doit PAS partir : les dimensions utiles au produit mais
    // inutiles au tour de conversation en cours.
    for (const cle of ["problemes", "workflows", "memoire", "outilsDuSecteur", "integrations", "description", "contexte"]) {
        verifier(!(cle in (bloc.secteur || {})),
            `« ${cle} » part dans le prompt à chaque message — cette dimension se lit via ` +
            "metiers.fiche(id).secteur quand un tour en a besoin, elle n'a rien à faire dans la consigne");
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 6. AUCUN DEUXIÈME CERVEAU
// ══════════════════════════════════════════════════════════════════════════
{
    // Le constructeur de consigne reste unique. Le chantier 5 a déjà réuni
    // le chat public et le QG derrière brain/prompts/index.js ; un fichier de
    // prompt par secteur ferait exactement le contraire.
    const fichiersPrompt = fs.readdirSync(path.join(RACINE, "brain", "prompts"))
        .filter((n) => n.endsWith(".js"));
    const parSecteur = fichiersPrompt.filter((n) => PILOTES.some((p) => n.includes(p.split("_")[0])));
    verifier(parSecteur.length === 0,
        `brain/prompts/ contient un fichier par secteur : ${parSecteur.join(", ")} — ` +
        "c'est un deuxième cerveau, exactement ce que le chantier 5 a démonté");

    const index = fs.readFileSync(path.join(RACINE, "brain", "prompts", "index.js"), "utf8");
    verifier(/context\.competence/.test(index),
        "brain/prompts/index.js ne lit plus `context.competence` : le métier n'atteindrait plus SAMII");
    verifier(!/require\(.*secteurs/i.test(index),
        "brain/prompts/index.js importe une table de secteurs : le contexte doit lui ARRIVER " +
        "par le contexte, pas être rechargé dans le cerveau");
    verifier(!/metiers\.SECTEURS|services\/metiers/.test(index),
        "brain/prompts/index.js va chercher le registre des métiers lui-même — le cerveau se " +
        "mettrait à connaître la taxonomie, et il y aurait deux chemins pour la même information");

    // Les deux chats passent toujours par le même point d'entrée.
    for (const r of ["routes/api.js", "routes/vitrine.js"]) {
        const src = fs.readFileSync(path.join(RACINE, r), "utf8");
        verifier(/competences\.pourLePrompt\(/.test(src),
            `${r} n'appelle plus competences.pourLePrompt — ce chat aurait son propre chemin`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 7. LES AUTRES MÉTIERS N'ONT RIEN PERDU
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(metiers.METIERS.length >= 34,
        `le registre est tombé à ${metiers.METIERS.length} métiers`);
    verifier(metiers.avecFiche().length === metiers.METIERS.length,
        `${metiers.avecFiche().length} fiches pour ${metiers.METIERS.length} métiers — ` +
        "un métier listé sans fiche répond 404 sur sa page publique");

    const nonPilotes = metiers.METIERS.filter((m) => !PILOTES.includes(m.id));
    verifier(nonPilotes.length >= 28,
        `seulement ${nonPilotes.length} métiers hors pilotes — les autres ont été supprimés`);

    // Chacun doit continuer à fonctionner exactement comme avant.
    const casses = [];
    for (const m of nonPilotes) {
        const f = metiers.fiche(m.id);
        if (!f || !f.perte || !f.defaut || !f.reponse || !Array.isArray(f.mots)) casses.push(m.id);
        if (f && f.secteur !== null) casses.push(`${m.id} (secteur inattendu)`);
    }
    verifier(casses.length === 0,
        `métier(s) hors pilotes abîmés : ${casses.slice(0, 5).join(", ")}`);

    // Et le seul aiguillage comportemental du projet tient toujours.
    verifier(metiers.estRdv("avocat") && !metiers.estRdv("ecommerce"),
        "typeParcours ne distingue plus rdv et produit");
    verifier(metiers.estRdv("location_voitures"),
        "la location de voitures n'est pas traitée comme une réservation — son QG afficherait " +
        "des commandes à livrer au lieu d'un calendrier");
    verifier(!metiers.estRdv("grossiste"),
        "le grossiste est traité comme un métier à rendez-vous — son QG n'afficherait pas ses commandes");
}

// ══════════════════════════════════════════════════════════════════════════
// 8. LE CONTEXTE ARRIVE VRAIMENT DANS LA CONSIGNE
// ══════════════════════════════════════════════════════════════════════════
//
// Tout ce qui précède peut être juste et ne servir à rien : il suffit que
// brain/prompts/index.js ne lise pas le champ. On construit donc la consigne
// POUR DE VRAI et on regarde ce qu'elle contient.
(async () => {
    const SAMII_PROMPT = require(path.join(RACINE, "brain", "prompts", "index.js"));
    const consigne = async (id, message) => SAMII_PROMPT("test", {
        audience: "client", metier: id,
        competence: competences.pourLePrompt({ metier: id, message }),
    });

    // ⚠️ ON ISOLE LE BLOC MÉTIER, ON NE CHERCHE PAS DANS TOUTE LA CONSIGNE.
    //
    // Première version de ce garde : il cherchait « ingrédient » n'importe où
    // dans la consigne. Mesuré en débranchant pour de vrai la ligne d'univers
    // du cerveau : le garde restait VERT — le mot figurait ailleurs, dans une
    // autre ligne du bloc et dans les dix mille caractères du reste. Un garde
    // qui passe quand la chose qu'il surveille a disparu ne surveille rien.
    const blocMetier = (texte) =>
        ((/CE QUE TU SAIS DE SON MÉTIER\n-+\n([\s\S]*?)\n\nTu ne récites/.exec(texte) || [])[1] || "");

    const restoEntier = await consigne("restaurant", "il me manque quoi pour demain ?");
    const boutiqueEntier = await consigne("ecommerce", "vérifie mon stock");
    const coiffeurEntier = await consigne("coiffeur", "bonjour");
    const resto = blocMetier(restoEntier);
    const boutique = blocMetier(boutiqueEntier);
    const coiffeur = blocMetier(coiffeurEntier);
    verifier(resto.length > 100 && boutique.length > 100,
        "le bloc « ce que tu sais de son métier » n'a pas été retrouvé dans la consigne — " +
        "le garde ci-dessous ne mesurerait plus rien");

    // Chaque ligne projetée a son marqueur. C'est ce qui rend le garde
    // sensible au DÉBRANCHEMENT d'une ligne, et pas seulement à la
    // disparition d'un mot.
    for (const [nom, marque] of [
        ["univers", /les choses s'appellent/],
        ["données à regarder", /Ce qu'il faut regarder avant de conclure/],
        ["façon de raisonner", /Comment raisonner ici/],
        ["ce qu'il sait faire", /tu sais faire toi-même/],
    ]) {
        verifier(marque.test(resto),
            `la ligne « ${nom} » n'apparaît pas dans le bloc métier d'un restaurateur — ` +
            "le cerveau a cessé de lire cette partie du contexte");
    }

    verifier(/ingrédient/.test(resto) && /matière première/.test(resto),
        "la consigne d'un restaurateur ne nomme ni ingrédient ni matière première — " +
        "la spécialisation n'atteint pas SAMII");
    verifier(/variante/.test(boutique) && /référence/.test(boutique),
        "la consigne d'un e-commerçant ne nomme ni variante ni référence");
    verifier(!/ingrédient/.test(boutique),
        "la consigne d'un e-commerçant parle d'ingrédients — les deux univers se sont mélangés");
    verifier(!/variante/.test(resto),
        "la consigne d'un restaurateur parle de variantes — les deux univers se sont mélangés");

    // ── LE MÊME MOT, DEUX SENS — l'objet même du chantier ────────────────
    //
    // Première version de ce garde : il exigeait le mot « stock » dans les
    // DEUX consignes. Mesuré, celle de l'e-commerçant ne le contient pas —
    // et c'est normal : elle ne définit pas le mot, elle donne l'univers qui
    // le résout (produit, variante, référence, quantité par variante). Le
    // garde testait donc un mécanisme qui n'est pas celui du code.
    //
    // La propriété vraie est celle-ci : chaque consigne donne à l'inventaire
    // du marchand un sens qui lui est propre, et n'emprunte jamais celui de
    // l'autre.
    verifier(/ingrédients qui se périment/.test(resto),
        "la consigne du restaurateur ne dit pas que son « stock » se périme — c'est pourtant " +
        "la phrase qui empêche SAMII de lui répondre comme à une boutique");
    verifier(!/ingrédients qui se périment/.test(boutique),
        "la consigne de l'e-commerçant explique le stock d'un restaurateur");
    verifier(/quantité disponible par variante/.test(boutique),
        "la consigne de l'e-commerçant ne dit pas où se compte son inventaire");
    verifier(!/quantité disponible par variante/.test(resto),
        "la consigne du restaurateur compte son inventaire en variantes");

    // Ce que SAMII sait FAIRE ici doit être nommé, et rien d'autre.
    verifier(/tu sais faire toi-même/.test(resto),
        "la consigne ne dit jamais ce que SAMII sait exécuter dans ce métier");
    verifier(!/vérifie mon stock/.test(boutique),
        "une action que SAMII ne sait PAS exécuter est annoncée dans la consigne — " +
        "il promettrait un geste qu'il ne peut pas faire");

    // Et un métier non spécialisé reçoit exactement ce qu'il recevait avant.
    verifier(/Ce que ça lui coûte/.test(coiffeur),
        "un métier sans spécialisation a perdu ses trois phrases");
    verifier(!/les choses s'appellent/.test(coiffeur),
        "un métier sans spécialisation reçoit quand même un bloc d'univers — il serait vide");

    // UN SEUL bloc métier dans la consigne, pas un par secteur. On compte
    // sur la consigne ENTIÈRE : l'en-tête n'est évidemment pas à l'intérieur
    // du bloc qu'il ouvre.
    const blocs = (restoEntier.match(/CE QUE TU SAIS DE SON MÉTIER/g) || []).length;
    verifier(blocs === 1, `${blocs} blocs « ce que tu sais de son métier » dans la consigne au lieu d'un`);
})().then(() => {
    if (echecs.length) {
        console.log(`\n❌ secteurs : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.log(`   • ${e}`);
        console.log("");
        process.exit(1);
    }
    console.log(`✅ secteurs : ${verifs} vérifications passées (${PILOTES.length} secteurs pilotes)`);
}).catch((err) => {
    console.log(`\n❌ secteurs : la suite n'a pas pu s'exécuter — ${err.message}\n`);
    process.exit(1);
});
