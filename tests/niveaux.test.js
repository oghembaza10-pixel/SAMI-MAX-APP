// ==========================================================================
// SAMII OS — Les niveaux de réflexion tiennent-ils debout ?
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE.
//
// Le registre des niveaux décide de quatre choses à la fois : quel moteur,
// combien de réflexion, quels outils, combien d'étapes. Chacune coûte de
// l'argent réel à chaque message. Trois pannes sont possibles, et aucune ne
// ressemble à une panne :
//
//   1. UN OUTIL INVENTÉ. Un nom dans une famille qui ne correspond à aucun
//      outil réel ne provoque aucune erreur : il est simplement filtré, et
//      le niveau porte silencieusement un outil de moins que prévu.
//
//   2. UN OUTIL OUBLIÉ. L'outil ajouté dans six mois qui n'est mis dans
//      aucune famille ne sera porté par AUCUN niveau. Il existera, il sera
//      testé, et personne ne pourra jamais l'appeler.
//
//   3. UNE ÉCHELLE QUI N'EN EST PAS UNE. Si un niveau supérieur porte moins
//      d'outils, ou coûte moins cher, que celui d'en dessous, alors payer
//      plus donne moins. Ça ne casse rien — ça se découvre sur une facture.
//
// Lancer :  npm test
// ==========================================================================
const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const N = require(path.join(RACINE, "config", "niveaux.js"));

// Les outils RÉELS, lus dans le fichier qui les déclare. On ne recopie pas la
// liste ici : ce serait créer une troisième vérité qui divergerait des deux
// autres. On lit la source.
const geminiSrc = fs.readFileSync(path.join(RACINE, "services", "geminiService.js"), "utf8");
// Les déclarations portent souvent un commentaire entre le nom et la
// description — c'est même là que vivent les explications les plus utiles.
// La lecture doit les traverser, sinon elle déclare « inexistant » un outil
// bien réel, et la garde crie pour rien.
const OUTILS_REELS = [...new Set(
    [...geminiSrc.matchAll(/name: "([a-z_]+)",\s*(?:\/\/[^\n]*\n\s*)*description:/g)].map((m) => m[1]),
)];
// `creer_workspace` est tenu à l'écart exprès : il n'appartient qu'à
// l'inscription conversationnelle, jamais à une conversation ordinaire.
const HORS_NIVEAUX = ["creer_workspace"];

// ── 1. LA LISTE DES OUTILS EST-ELLE LISIBLE ? ────────────────────────────
//
// Si cette lecture rend une liste vide ou minuscule, tout ce qui suit
// deviendrait vrai sans rien prouver. On mesure d'abord l'instrument.
{
    verifier(OUTILS_REELS.length >= 14,
        `on ne lit que ${OUTILS_REELS.length} outils dans geminiService.js — la forme des ` +
        "déclarations a changé, et cette suite ne mesure plus rien");
}

// ── 2. AUCUN OUTIL INVENTÉ ───────────────────────────────────────────────
{
    for (const [famille, outils] of Object.entries(N.FAMILLES)) {
        for (const outil of outils) {
            verifier(OUTILS_REELS.includes(outil),
                `la famille « ${famille} » cite l'outil « ${outil} », qui n'existe nulle part dans ` +
                "geminiService.js — il sera silencieusement filtré, et le niveau portera un outil de moins");
        }
    }
}

// ── 3. AUCUN OUTIL OUBLIÉ ────────────────────────────────────────────────
//
// LA GARDE QUI SERVIRA LE PLUS. Le vrai risque n'est pas la liste
// d'aujourd'hui : c'est l'outil ajouté dans six mois, qui ne tombera dans
// aucune famille et qu'aucun niveau ne pourra jamais appeler.
{
    const classes = new Set(Object.values(N.FAMILLES).flat());
    for (const outil of OUTILS_REELS) {
        if (HORS_NIVEAUX.includes(outil)) continue;
        verifier(classes.has(outil),
            `l'outil « ${outil} » n'appartient à aucune famille de config/niveaux.js : ` +
            "aucun niveau ne pourra l'appeler, et rien ne le signalera");
    }
}

// ── 4. AUCUN OUTIL DANS DEUX FAMILLES ────────────────────────────────────
//
// Un outil à la fois « lecture » et « écriture » serait accordé par le
// niveau le plus bas des deux — donc la famille la plus stricte ne
// protégerait plus rien.
{
    const vus = new Map();
    for (const [famille, outils] of Object.entries(N.FAMILLES)) {
        for (const outil of outils) {
            if (vus.has(outil)) {
                verifier(false,
                    `l'outil « ${outil} » est dans « ${vus.get(outil)} » ET « ${famille} » : ` +
                    "la famille la plus stricte ne protège plus rien");
            }
            vus.set(outil, famille);
        }
    }
    verifier(true, "familles disjointes");
}

// ── 5. LE COMMERCE N'EST JAMAIS ACCORDÉ PAR UN NIVEAU ────────────────────
//
// Confirmer une commande, prendre un rendez-vous : ces outils agissent sur
// les données commerciales d'un CLIENT de marchand. Ils dépendent de à qui
// l'on parle, pas de l'effort fourni. Un « Maître » ne doit pas pouvoir
// confirmer la commande d'un marchand depuis le chat du fondateur.
{
    for (const id of N.ORDRE) {
        const n = N.niveau(id);
        verifier(!n.familles.includes("commerce"),
            `le niveau « ${id} » s'accorde la famille commerce : réfléchir plus fort donnerait ` +
            "le droit de toucher au carnet de commandes d'un marchand");
        const outils = N.outilsDe(id);
        for (const interdit of N.FAMILLES.commerce) {
            verifier(!outils.includes(interdit),
                `le niveau « ${id} » porte « ${interdit} », réservé à une conversation client`);
        }
    }
}

// ── 6. C'EST UNE ÉCHELLE, PAS UN TAS ─────────────────────────────────────
//
// Monter d'un niveau ne doit jamais RETIRER quelque chose. Si Pro portait un
// outil que Maître n'a pas, payer plus donnerait moins — et ça ne se verrait
// que le jour où quelqu'un s'en plaint.
{
    for (let i = 1; i < N.ORDRE.length; i++) {
        const bas = N.ORDRE[i - 1];
        const haut = N.ORDRE[i];
        const outilsBas = N.outilsDe(bas);
        const outilsHaut = N.outilsDe(haut);
        for (const outil of outilsBas) {
            verifier(outilsHaut.includes(outil),
                `« ${haut} » ne porte pas « ${outil} », que « ${bas} » porte : monter d'un niveau retire un outil`);
        }
        verifier(N.niveau(haut).etapesMax >= N.niveau(bas).etapesMax,
            `« ${haut} » plafonne à ${N.niveau(haut).etapesMax} étapes, moins que « ${bas} »`);
        verifier(N.niveau(haut).generationConfig.maxOutputTokens >= N.niveau(bas).generationConfig.maxOutputTokens,
            `« ${haut} » répond plus court que « ${bas} »`);
        // Le prix ne doit jamais DESCENDRE quand on monte. Aujourd'hui ils
        // sont tous égaux — la passe tarifaire viendra les écarter, et cette
        // garde restera vraie.
        verifier(N.niveau(haut).prixUSD >= N.niveau(bas).prixUSD,
            `« ${haut} » coûte moins cher que « ${bas} » : payer plus donnerait moins`);
    }
}

// ── 7. « RAPIDE » NE PORTE AUCUN OUTIL ───────────────────────────────────
//
// Un tour censé répondre tout de suite ne doit pas pouvoir partir dans un
// appel réseau. Sinon il n'est plus rapide, et il facture une capacité qu'on
// ne lui a pas demandée.
{
    verifier(N.outilsDe("rapide").length === 0,
        "le niveau Rapide porte des outils : il peut partir dans un appel réseau et cesser d'être rapide");
    verifier(!N.porteDesOutils("rapide"), "porteDesOutils se trompe sur Rapide");
    verifier(N.porteDesOutils("pro"), "porteDesOutils se trompe sur Pro");
}

// ── 8. AUCUN APPELANT NE PEUT RECEVOIR RIEN ──────────────────────────────
//
// `niveau()` doit toujours rendre quelque chose d'utilisable. Un appelant qui
// reçoit undefined finirait par inventer son propre repli, et il divergerait
// de celui-ci.
{
    for (const bidon of [null, undefined, "", "MAITRE", "n'importe quoi", 42, {}, [], "auto"]) {
        const n = N.niveau(bidon);
        verifier(n && typeof n.id === "string" && N.ORDRE.includes(n.id),
            `niveau(${JSON.stringify(bidon)}) rend « ${JSON.stringify(n)} » au lieu d'un niveau utilisable`);
        verifier(Array.isArray(n?.familles), `niveau(${JSON.stringify(bidon)}) rend un niveau sans familles`);
    }
    // La casse ne doit pas décider du niveau.
    verifier(N.niveau("MAITRE").id === "maitre", "niveau() est sensible à la casse");
    verifier(N.niveau("auto").id === N.DEFAUT,
        "« auto » n'est pas un niveau réel : il doit retomber sur le niveau par défaut");
}

// ── 9. LE PLAFOND TIENT ──────────────────────────────────────────────────
//
// Sans plafond, « fais-moi un plan complet » devient une façon de faire
// tourner le moteur le plus cher autant de fois qu'on veut.
{
    verifier(N.borner("maitre", "free").id === "expert",
        `un compte gratuit obtient « ${N.borner("maitre", "free").id} » en demandant Maître`);
    verifier(N.borner("maitre", "pro").id === "maitre",
        "un abonné Pro ne peut pas atteindre Maître");
    verifier(N.borner("rapide", "societe").id === "rapide",
        "le plafond force un niveau vers le HAUT — il doit seulement empêcher de dépasser");

    // Un palier inconnu ne doit pas ouvrir grand : il retombe sur le plus
    // strict. Se tromper dans ce sens ne coûte qu'une réponse plus courte.
    verifier(N.plafond("palier-qui-nexiste-pas") === "expert",
        "un palier inconnu donne un plafond permissif — une valeur inattendue ouvrirait le moteur le plus cher");
    verifier(N.plafond(null) === "expert", "un palier absent donne un plafond permissif");

    // Tout palier réel de l'application doit avoir un plafond décidé.
    const paliersReels = Object.keys(require(path.join(RACINE, "services", "confirmationsQuota.js")).QUOTA_PAR_PALIER);
    for (const p of [...paliersReels, "societe"]) {
        verifier(Object.prototype.hasOwnProperty.call(N.PLAFOND_PAR_PALIER, p),
            `le palier « ${p} » existe dans l'application mais n'a pas de plafond de niveau décidé`);
    }
}

// ── 10. L'ESCALADE MONTE, ET S'ARRÊTE ────────────────────────────────────
{
    verifier(N.monter("rapide", "societe").id === "expert", "monter() ne monte pas");
    verifier(N.monter("maitre", "societe").id === "maitre", "monter() dépasse le dernier niveau");
    verifier(N.monter("expert", "free").id === "expert",
        "monter() franchit le plafond d'un compte gratuit : l'escalade deviendrait une porte dérobée");
}

// ── 11. LA RÉFLEXION ÉTENDUE RESTE ÉTEINTE ───────────────────────────────
//
// Un champ que le modèle ne connaît pas fait échouer l'appel ENTIER avec un
// 400 — pas un avertissement, pas une dégradation. Tant qu'il n'est pas
// vérifié contre l'API réelle, il reste éteint partout.
{
    for (const id of N.ORDRE) {
        const n = N.niveau(id);
        verifier(n.reflexionEtendue === false,
            `« ${id} » active la réflexion étendue sans qu'elle ait été vérifiée contre l'API : ` +
            "un champ inconnu fait échouer l'appel entier");
        const cles = Object.keys(n.generationConfig);
        for (const cle of cles) {
            verifier(["temperature", "maxOutputTokens", "topP", "topK"].includes(cle),
                `« ${id} » passe « ${cle} » dans generationConfig — si l'API ne le connaît pas, ` +
                "tous les messages de ce niveau échouent");
        }
    }
}

// ── 12. LE SÉLECTEUR EST COMPLET ─────────────────────────────────────────
{
    const liste = N.pourAffichage();
    verifier(liste[0].id === N.AUTO, "« Auto » n'est pas en tête du sélecteur alors que c'est le défaut");
    verifier(liste.length === N.ORDRE.length + 1,
        `le sélecteur montre ${liste.length} entrées pour ${N.ORDRE.length} niveaux + Auto`);
    for (const entree of liste) {
        verifier(Boolean(entree.libelle && entree.pourQuoi && entree.icone),
            `l'entrée « ${entree.id} » du sélecteur est incomplète — une page devra inventer son propre texte`);
    }
}

// ── VERDICT ──────────────────────────────────────────────────────────────
if (echecs.length) {
    console.log(`\n❌ niveaux : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    echecs.forEach((e) => console.log(`   • ${e}`));
    process.exit(1);
}
console.log(`✅ niveaux : ${verifs} vérifications passées (${N.ORDRE.length} niveaux, ${OUTILS_REELS.length} outils réels)`);
