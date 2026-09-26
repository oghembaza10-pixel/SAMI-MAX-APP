// ==========================================================================
// SAMII OS — LES AMORCES PROMETTENT-ELLES CE QUI PART VRAIMENT ?
//
// POURQUOI CE TEST EXISTE. La page d'accueil propose des puces de démarrage.
// Depuis ce chantier, celles d'un marchand connecté nomment des gestes qui
// déclenchent de VRAIS outils. Une puce qui promet un geste que le tour ne
// pourra pas exécuter est la pire des quatre pannes possibles ici :
//
//   1. l'outil n'est pas accordé à l'audience → SAMII répond de mémoire ;
//   2. le niveau en place ne le porte pas → pareil, et invisible ;
//   3. l'outil a besoin d'un QG que la personne n'a pas → réponse vide ;
//   4. la phrase vient d'un métier qui ne l'a jamais déclarée → invention.
//
// Les quatre se ressemblent à l'écran : SAMII répond, avec aplomb, et rien
// n'échoue. C'est exactement la panne que le chantier A a mesurée sur les
// prompts (63 gestes annoncés sur 136 qui ne partaient jamais).
//
// CE QU'ON VÉRIFIE, ET AVEC QUEL INSTRUMENT.
//
//   A. Le joint réel — `geminiService.buildToolsPayload`, pas une table
//      recopiée. Pour les 36 métiers, l'outil de chaque puce est-il DANS le
//      payload au niveau que la puce demande ?
//   B. `suffit` est exact dans les deux sens : un cran y est si et seulement
//      s'il porte l'outil. « Auto » est mesuré en faisant tourner le vrai
//      classement sur la phrase de la puce.
//   C. Aucune donnée inventée : chaque phrase de douleur existe VERBATIM
//      dans `services/metiers.js`.
//   D. La famille `commerce` n'apparaît jamais (garde-fou du chantier A).
//   E. Les phrases écrites ici sont traduites — `tests/langues.test.js` ne
//      peut structurellement pas les voir (le gabarit les traduit par une
//      variable, et ce test-là ne lit que les `L("littéral")`).
//   F. Le gabarit et le navigateur : la puce porte bien `data-suffit` quand
//      elle porte `data-niveau`, la page de l'anonyme garde ses quatre puces
//      d'origine, et le clic ne DESCEND jamais un niveau.
//
// COMMENT. On lit les registres et on exécute le vrai calcul. Pas de base,
// pas de port, pas de navigateur — le navigateur a servi à côté, et c'est
// lui qui a trouvé le seuil de longueur écrit sur la mauvaise langue.
//
// Lancer :  npm test
// ==========================================================================
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const amorces = require(path.join(RACINE, "services", "amorces"));
const metiers = require(path.join(RACINE, "services", "metiers"));
const NIVEAUX = require(path.join(RACINE, "config", "niveaux"));
const AUDIENCES = require(path.join(RACINE, "config", "audiences"));
const niveauAuto = require(path.join(RACINE, "services", "niveauAuto"));
const langue = require(path.join(RACINE, "services", "langue"));
const { __test_buildToolsPayload } = require(path.join(RACINE, "services", "geminiService"));

let verifs = 0;
const echecs = [];
const verifier = (condition, message) => {
    verifs++;
    if (!condition) echecs.push(message);
};

const IDS = [...metiers.IDS];
assert.ok(IDS.length >= 30, "le registre des métiers est vide — le test ne mesure rien");

// ══════════════════════════════════════════════════════════════════════════
// A. LE PLAFOND COMMUN EST BIEN LE PLUS BAS DE TOUS LES PALIERS
// ══════════════════════════════════════════════════════════════════════════
//
// Recalculé ici AUTREMENT (un tri, pas une réduction) : si les deux façons
// de le trouver donnaient le même résultat par hasard, elles ne resteraient
// pas d'accord après un changement de la table.
{
    const trie = Object.keys(NIVEAUX.PLAFOND_PAR_PALIER)
        .map((p) => NIVEAUX.plafond(p))
        .sort((a, b) => NIVEAUX.comparer(a, b));
    verifier(
        amorces.PLAFOND_COMMUN === trie[0],
        `amorces.PLAFOND_COMMUN vaut « ${amorces.PLAFOND_COMMUN} », or le plus bas plafond de tous les paliers est « ${trie[0]} »`
    );
    verifier(
        NIVEAUX.plafond(amorces.PALIER_LE_PLUS_CONTRAINT) === trie[0],
        `amorces.PALIER_LE_PLUS_CONTRAINT (« ${amorces.PALIER_LE_PLUS_CONTRAINT} ») ne plafonne pas à « ${trie[0]} »`
    );
}

// ══════════════════════════════════════════════════════════════════════════
// B. `niveauMinimal` REND LE CRAN LE PLUS BAS QUI PORTE L'OUTIL
// ══════════════════════════════════════════════════════════════════════════
for (const g of amorces.GESTES) {
    const min = amorces.niveauMinimal(g.fait);
    verifier(min !== null, `amorces : « ${g.fait} » n'est porté par AUCUN niveau — l'outil n'existe pas dans config/niveaux.js`);
    if (!min) continue;

    verifier(
        NIVEAUX.outilsDe(min).includes(g.fait),
        `amorces.niveauMinimal("${g.fait}") rend « ${min} », qui ne porte pas cet outil`
    );
    const dessous = NIVEAUX.ORDRE.slice(0, NIVEAUX.ORDRE.indexOf(min));
    for (const bas of dessous) {
        verifier(
            !NIVEAUX.outilsDe(bas).includes(g.fait),
            `amorces.niveauMinimal("${g.fait}") rend « ${min} » alors que « ${bas} », plus bas, le porte déjà`
        );
    }
}

// ══════════════════════════════════════════════════════════════════════════
// C. LE JOINT RÉEL — L'OUTIL DE CHAQUE PUCE PART-IL VRAIMENT ?
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ ON N'INTERROGE PAS `config/audiences.js`. Ce serait redemander à la
// table ce que `services/amorces.js` lui a déjà demandé — deux lectures de la
// même ligne, qui seront toujours d'accord. On appelle le constructeur de
// charge utile, celui que `brain/planner.js` appelle pour de vrai.
{
    let gestesVerifies = 0;
    for (const id of IDS) {
        for (const a of amorces.pour({ metier: id, aUnQG: true })) {
            if (!a.fait) continue;
            gestesVerifies++;
            const charge = __test_buildToolsPayload(
                true,
                { audience: amorces.AUDIENCE, niveau: a.niveau, tourDeConversation: true },
                "gemini"
            );
            const noms = ((charge && charge[0] && charge[0].functionDeclarations) || []).map((d) => d.name);
            verifier(
                noms.includes(a.fait),
                `amorces : « ${a.libelle} » (${id}) promet « ${a.fait} » au niveau « ${a.niveau} », absent de la charge utile réelle`
            );
        }
    }
    verifier(gestesVerifies >= IDS.length, `seulement ${gestesVerifies} gestes mesurés sur ${IDS.length} métiers — la mesure ne couvre rien`);
}

// ══════════════════════════════════════════════════════════════════════════
// D. `suffit` EST EXACT DANS LES DEUX SENS
// ══════════════════════════════════════════════════════════════════════════
//
// Un cran de trop et le navigateur ne monte pas alors qu'il le faudrait —
// la puce repart sans outil, en silence. Un cran de moins et on monte
// quelqu'un sans raison, donc on dépense sans raison.
for (const a of amorces.pour({ metier: "ecommerce", aUnQG: true })) {
    if (!a.fait) continue;
    for (const cran of NIVEAUX.ORDRE) {
        const porte = NIVEAUX.outilsDe(cran).includes(a.fait);
        verifier(
            a.suffit.includes(cran) === porte,
            `amorces : « ${a.libelle} » ${a.suffit.includes(cran) ? "annonce" : "n'annonce pas"} « ${cran} » comme suffisant, or ce cran ${porte ? "porte" : "ne porte pas"} « ${a.fait} »`
        );
    }
    // « Auto » : on refait tourner le vrai classement sur la phrase de la
    // puce, au palier le plus contraint — jamais une supposition.
    const choix = niveauAuto.choisir({
        message: a.demande,
        demande: NIVEAUX.AUTO,
        palier: amorces.PALIER_LE_PLUS_CONTRAINT,
    });
    const autoSuffit = NIVEAUX.outilsDe(choix.niveau).includes(a.fait);
    verifier(
        a.suffit.includes(NIVEAUX.AUTO) === autoSuffit,
        `amorces : « ${a.libelle} » ${a.suffit.includes(NIVEAUX.AUTO) ? "annonce" : "n'annonce pas"} « auto » comme suffisant, or Auto retient « ${choix.niveau} » sur cette phrase, qui ${autoSuffit ? "porte" : "ne porte pas"} « ${a.fait} »`
    );
}

// ── ET LA MÊME VÉRIFICATION, SUR UN CAS OÙ « AUTO » NE SUFFIT PAS ────────
//
// ⚠️ LA GARDE CI-DESSUS ÉTAIT CREUSE, ET ON NE L'A SU QU'EN LA CASSANT.
//
// On a muté `cransQuiSuffisent` pour qu'elle pousse « auto » SANS jamais le
// mesurer. Le test est passé. Raison : sur les quatre phrases écrites
// aujourd'hui, Auto suffit vraiment — la garde comparait donc « vrai » à
// « vrai », et n'avait rien à attraper. Elle ne devenait fausse que le jour
// où quelqu'un reformule un libellé, c'est-à-dire trop tard.
//
// Il faut donc lui donner un cas où la réponse est NON. « Traduis ça en
// anglais » est reconnu comme geste simple : Auto retient « Rapide », qui ne
// porte aucun outil. Une amorce phrasée ainsi ne doit jamais annoncer « auto »
// comme suffisant, sinon le navigateur ne monterait pas et la puce repartirait
// les mains vides.
{
    const outil = amorces.GESTES[0].fait;
    const simple = "Traduis ça en anglais";
    const choix = niveauAuto.choisir({
        message: simple, demande: NIVEAUX.AUTO, palier: amorces.PALIER_LE_PLUS_CONTRAINT,
    });
    verifier(
        !NIVEAUX.outilsDe(choix.niveau).includes(outil),
        `le cas témoin ne tient plus : Auto retient « ${choix.niveau} » sur « ${simple} », qui porte « ${outil} » — il faut une autre phrase pour éprouver la garde`
    );
    verifier(
        !amorces.cransQuiSuffisent(outil, simple).includes(NIVEAUX.AUTO),
        `amorces.cransQuiSuffisent annonce « auto » suffisant pour « ${outil} » sur une phrase où Auto retient « ${choix.niveau} » — « auto » est poussé sans être mesuré`
    );
    // Et l'inverse, pour que la garde ne passe pas simplement en refusant
    // toujours « auto » : sur une vraie phrase de geste, il doit y être.
    verifier(
        amorces.cransQuiSuffisent(outil, amorces.GESTES[0].demande).includes(NIVEAUX.AUTO),
        `amorces.cransQuiSuffisent refuse « auto » sur la phrase même de « ${amorces.GESTES[0].libelle} » — le navigateur monterait un Auto qui suffisait déjà`
    );
}

// ══════════════════════════════════════════════════════════════════════════
// E. LA FAMILLE `commerce` N'APPARAÎT JAMAIS — GARDE-FOU DU CHANTIER A
// ══════════════════════════════════════════════════════════════════════════
//
// Le registre des secteurs porte `confirmer_commande`, `annuler_commande`,
// `prendre_rendez_vous`, `proposer_creneaux_rdv` : ils agissent sur le carnet
// d'un CLIENT, et le marchand ne les tient jamais chez lui. 63 gestes sur
// 136 annoncés dans les prompts en faisaient partie avant le chantier A.
{
    const commerce = new Set(NIVEAUX.FAMILLES.commerce || []);
    verifier(commerce.size > 0, "config/niveaux.js ne déclare plus de famille `commerce` — cette garde ne mesure plus rien");
    for (const id of IDS) {
        for (const a of amorces.pour({ metier: id, aUnQG: true })) {
            verifier(
                !a.fait || !commerce.has(a.fait),
                `amorces : « ${a.libelle} » (${id}) propose « ${a.fait} », qui appartient à la famille commerce — jamais tenue par le marchand`
            );
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════
// F. AUCUNE DONNÉE INVENTÉE : CHAQUE DOULEUR VIENT DU REGISTRE, VERBATIM
// ══════════════════════════════════════════════════════════════════════════
{
    let douleursVues = 0;
    for (const id of IDS) {
        const declarees = (metiers.SECTEURS[id]?.problemes || []);
        const enTetes = new Map(declarees.map((p) => [amorces.enTete(p), p]));
        for (const a of amorces.pour({ metier: id, aUnQG: true })) {
            if (a.fait) continue;
            douleursVues++;

            const source = enTetes.get(a.libelle);
            verifier(
                source !== undefined,
                `amorces : « ${a.libelle} » (${id}) n'est AUCUNE des douleurs déclarées par ce secteur — texte inventé ou déformé`
            );
            if (source === undefined) continue;

            // La demande envoyée doit contenir la phrase du registre telle
            // quelle : l'encadrer est permis, la réécrire ne l'est pas.
            verifier(
                a.demande.includes(source),
                `amorces : la demande de « ${a.libelle} » (${id}) ne contient pas la phrase du registre « ${source} »`
            );
            // Et une puce de conversation ne demande aucun niveau : monter
            // pour discuter, c'est dépenser plus sans rien ajouter.
            verifier(
                a.niveau === null && Array.isArray(a.suffit) && a.suffit.length === 0,
                `amorces : « ${a.libelle} » (${id}) n'a pas d'outil mais demande le niveau « ${a.niveau} »`
            );
        }
    }
    verifier(douleursVues >= IDS.length, `seulement ${douleursVues} douleurs mesurées sur ${IDS.length} métiers`);
}

// ══════════════════════════════════════════════════════════════════════════
// G. LA PHRASE DU MARCHAND N'EST PAS MISE DANS SA BOUCHE
// ══════════════════════════════════════════════════════════════════════════
//
// Le registre décrit ce qui coûte cher DANS LE SECTEUR ; il ne sait pas si
// c'est vrai chez cette personne-là. Le cadre doit donc dire « souvent »,
// « dans mon métier » — jamais « mon problème c'est », qui affirmerait à sa
// place quelque chose qu'on n'a pas lu.
{
    const cadre = amorces.CADRE_DOULEUR("XXX");
    verifier(cadre.includes("XXX"), "amorces.CADRE_DOULEUR n'insère pas la phrase qu'on lui donne");
    verifier(
        /souvent/i.test(cadre),
        `amorces.CADRE_DOULEUR affirme la douleur comme un fait du marchand : « ${cadre} »`
    );
}

// ══════════════════════════════════════════════════════════════════════════
// H. CE QUI A BESOIN D'UN QG NE S'AFFICHE PAS SANS QG
// ══════════════════════════════════════════════════════════════════════════
//
// `etat_de_mon_business` et `resume_journee` lisent l'espace de travail. Sans
// QG, l'outil part et revient vide — et la personne conclut que son activité
// est vide, pas qu'elle n'a pas encore d'espace.
{
    const avecQG = amorces.pour({ metier: "ecommerce", aUnQG: true }).map((a) => a.fait).filter(Boolean);
    const sansQG = amorces.pour({ metier: "ecommerce", aUnQG: false }).map((a) => a.fait).filter(Boolean);

    const exigeants = amorces.GESTES.filter((g) => g.besoinDunQG).map((g) => g.fait);
    verifier(exigeants.length > 0, "aucun geste ne déclare `besoinDunQG` — cette garde ne mesure plus rien");

    for (const outil of exigeants) {
        verifier(avecQG.includes(outil), `amorces : « ${outil} » devrait être proposé à un marchand QUI A un QG`);
        verifier(!sansQG.includes(outil), `amorces : « ${outil} » est proposé à un marchand SANS QG — l'outil reviendrait vide`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// I. LE SEUIL : DEUX PUCES VALENT MOINS QUE LES QUATRE GÉNÉRIQUES
// ══════════════════════════════════════════════════════════════════════════
{
    const rien = amorces.pour({ metier: "", aUnQG: false });
    verifier(
        rien.length === 0,
        `amorces : un compte sans métier ni QG reçoit ${rien.length} puce(s) — au-dessous de ${amorces.MINIMUM} on doit rendre [] et laisser les génériques`
    );

    for (const id of IDS) {
        const l = amorces.pour({ metier: id, aUnQG: true });
        verifier(l.length >= amorces.MINIMUM, `amorces : « ${id} » ne rend que ${l.length} puce(s) avec un QG`);
        verifier(l.length <= 6, `amorces : « ${id} » rend ${l.length} puces — plus de six ne tient pas sur un téléphone`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// J. SA RÉALITÉ N'ARRIVE PAS EN DERNIER
// ══════════════════════════════════════════════════════════════════════════
//
// Les gestes sont identiques pour les 36 métiers ; les douleurs sont les
// seules phrases qui parlent de CE métier. Concaténées, les génériques
// passaient devant et la première chose lue restait générique.
for (const id of IDS) {
    const l = amorces.pour({ metier: id, aUnQG: true });
    const premiereDouleur = l.findIndex((a) => !a.fait);
    verifier(
        premiereDouleur >= 0 && premiereDouleur <= 1,
        `amorces : « ${id} » met sa première phrase de métier en position ${premiereDouleur + 1} — elle doit venir dans les deux premières`
    );
}

// ══════════════════════════════════════════════════════════════════════════
// K. LES PHRASES ÉCRITES ICI SONT TRADUITES
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ `tests/langues.test.js` NE PEUT PAS LES VOIR. Il ne lit que les
// `L("littéral")` des gabarits, et `views/samii-accueil.ejs` les traduit par
// `L(a.libelle)` — une variable. Il le dit lui-même : « prétendre le vérifier
// serait se mentir ». C'est donc ici, contre les valeurs réelles du module.
{
    const dicos = { EN: langue.EN, AR: langue.AR };
    for (const g of amorces.GESTES) {
        for (const phrase of [g.libelle, g.demande]) {
            for (const [nom, dico] of Object.entries(dicos)) {
                verifier(
                    phrase in dico,
                    `services/langue.js (${nom}) ne traduit pas « ${phrase.slice(0, 55)}… » — la puce resterait en français`
                );
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════
// L. LE GABARIT ET LE NAVIGATEUR
// ══════════════════════════════════════════════════════════════════════════
{
    const vue = fs.readFileSync(path.join(RACINE, "views", "samii-accueil.ejs"), "utf8");
    const js = fs.readFileSync(path.join(RACINE, "public", "js", "samii-accueil.js"), "utf8");

    // ── Le bloc des amorces existe et sort d'une condition ───────────────
    verifier(
        /amorces\s*&&\s*amorces\.length/.test(vue),
        "views/samii-accueil.ejs ne teste plus `amorces.length` — les génériques ne seraient jamais servies, ou jamais remplacées"
    );

    // ── Les quatre puces de l'anonyme sont intactes ──────────────────────
    //
    // Chantier B : sa page ne change pas. Elle a été comparée octet pour
    // octet dans les trois langues ; ceci garde les libellés eux-mêmes.
    for (const libelle of ["Développer mon activité", "Organiser ma journée", "Trouver les bons mots", "Juste parler"]) {
        verifier(
            vue.includes(`L("${libelle}")`),
            `views/samii-accueil.ejs a perdu la puce générique « ${libelle} » — la page de l'anonyme a changé`
        );
    }

    // ── `data-suffit` accompagne TOUJOURS `data-niveau` ──────────────────
    //
    // Sans lui, le navigateur ne sait pas si ce qu'il a suffit déjà : il
    // monterait à chaque clic, y compris quelqu'un en Maître — donc en le
    // DESCENDANT. C'est la panne que le commentaire du JS décrit.
    {
        const avecNiveau = (vue.match(/data-niveau="<%=\s*a\.niveau\s*%>"/g) || []).length;
        const avecSuffit = (vue.match(/data-suffit="<%=\s*a\.suffit/g) || []).length;
        verifier(
            avecNiveau > 0 && avecNiveau === avecSuffit,
            `views/samii-accueil.ejs écrit ${avecNiveau} fois data-niveau et ${avecSuffit} fois data-suffit — les deux vont ensemble`
        );
    }

    // ── La classe qui laisse respirer un libellé long ────────────────────
    verifier(
        /\.chip--amorce\s*\{[^}]*white-space:\s*normal/.test(vue),
        "views/samii-accueil.ejs : `.chip--amorce` ne met plus `white-space: normal` — une douleur de métier sortirait de l'écran"
    );
    verifier(
        /class="chip chip--amorce"/.test(vue),
        "views/samii-accueil.ejs n'applique plus `chip--amorce` aux puces du marchand"
    );
    // Et elle vit dans la feuille CONDITIONNÉE : servie à l'anonyme, elle
    // changerait sa page, que le chantier B a figée.
    {
        const debut = vue.indexOf("<% if (loggedIn) { %>");
        verifier(debut > 0, "views/samii-accueil.ejs n'a plus de feuille conditionnée par `loggedIn`");
        verifier(
            debut > 0 && vue.indexOf(".chip--amorce {") > debut,
            "views/samii-accueil.ejs : `.chip--amorce` est déclarée AVANT la feuille conditionnée — elle partirait aussi chez l'anonyme"
        );
    }

    // ── Le navigateur monte, et seulement quand il le faut ───────────────
    verifier(
        /indexOf\(niveauChoisi\)\s*===\s*-1/.test(js),
        "public/js/samii-accueil.js ne vérifie plus que le cran en place est absent de `data-suffit` — il monterait toujours, donc descendrait un Maître"
    );
    verifier(
        /monterNiveau\(vise\)/.test(js),
        "public/js/samii-accueil.js ne monte plus le niveau au clic d'une puce — la puce repartirait sans outil"
    );
    // Un seul chemin : celui du menu. Un second qui n'écrirait que la
    // moitié laisserait la barre afficher un niveau et en envoyer un autre.
    verifier(
        /monterNiveau = function \(id\) \{[\s\S]{0,200}poserNiveau\(b\)/.test(js),
        "public/js/samii-accueil.js : `monterNiveau` ne passe plus par `poserNiveau` — la pastille, la coche et localStorage se désaccorderaient"
    );
}

// ── Verdict ──────────────────────────────────────────────────────────────
if (echecs.length) {
    console.error(`❌ amorces : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.error("   • " + e);
    process.exit(1);
}
console.log(`✅ amorces : ${verifs} vérifications passées (${IDS.length} métiers, ${amorces.GESTES.length} gestes)`);
