// ==========================================================================
// SAMII OS — LE CENTRE D'ACTIVITÉ MONTRE-T-IL CE QUI EST, ET RIEN DE PLUS ?
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE. Cette page réunit trois sources dans un seul
// écran. Trois façons de se tromper, et elles ne se ressemblent pas :
//
//   1. MONTRER CE QUI N'EST PAS À SOI. Une table sans filtre est globale par
//      défaut ; cette fuite est revenue CINQ fois dans ce projet (le fil, les
//      discussions, le classement, la marketplace, les vitrines). Ici elle
//      montrerait les commandes et les paiements d'un autre marchand.
//
//   2. RANGER AU HASARD. Un état inconnu qui tomberait dans « Terminé » ferait
//      croire à un travail fait. Une action inconnue qui tomberait dans
//      « Travail de SAMII » ferait porter à SAMII le crédit d'un geste que le
//      marchand a fait lui-même.
//
//   3. ÉCRIRE. C'est une page de LECTURE. Un `INSERT` glissé ici créerait un
//      second journal à côté du seul qui existe — exactement ce que la
//      consigne du chantier interdit.
//
// CE QU'ON VÉRIFIE ICI : le registre, les états, le cloisonnement au niveau
// de la requête, la dé-duplication des libellés, la vue, et la porte.
//
// Ce qu'on NE peut PAS vérifier ici : qu'un marchand ne voit pas les lignes
// d'un autre EN BASE. Une doublure n'exécute pas de SQL (règle 3 d'AGENTS.md).
// C'est `tests/activite-reel.test.js`, contre un vrai Postgres.
//
// Lancer :  npm test
// ==========================================================================
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (condition, message) => {
    verifs++;
    if (!condition) echecs.push(message);
};

function remplacer(chemin, exports) {
    const r = require.resolve(path.join(RACINE, chemin));
    require.cache[r] = { id: r, filename: r, loaded: true, exports };
}

// La doublure enregistre CE QU'ON DEMANDE à la base. Elle ne répond rien :
// ce test-ci porte sur la question posée, pas sur la réponse.
const requetes = [];
remplacer("services/db", {
    query: async (sql, params) => { requetes.push({ sql, params }); return []; },
});

const activite = require(path.join(RACINE, "services", "activite"));
const NIVEAUX_MISSIONS = require(path.join(RACINE, "services", "missionsLongues"));

(async () => {

// ══════════════════════════════════════════════════════════════════════════
// A. SANS QG, ON NE DEMANDE RIEN — ET SURTOUT PAS « TOUT »
// ══════════════════════════════════════════════════════════════════════════
//
// Le piège n'est pas de rendre une liste vide : c'est de lancer la requête
// SANS la clause `WHERE workspace_id`, qui rendrait alors le journal de tout
// le monde. On vérifie donc qu'AUCUNE requête ne part.
{
    requetes.length = 0;
    const r = await activite.lireJournal(null, 40);
    verifier(r.length === 0, "lireJournal sans QG rend des lignes");
    verifier(
        requetes.length === 0,
        `lireJournal a interrogé la base SANS QG (${requetes.length} requête(s)) — une table sans filtre est globale par défaut`
    );

    requetes.length = 0;
    const vide = await activite.pour({});
    verifier(vide.vide === true, "activite.pour sans rien ne se déclare pas vide");
    for (const section of ["enCours", "termine", "echec", "recent", "samii"]) {
        verifier(Array.isArray(vide[section]) && vide[section].length === 0,
            `activite.pour sans QG rend des éléments dans « ${section} »`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// B. LA REQUÊTE DU JOURNAL PORTE LE QG, ET LE QG VIENT DE L'APPELANT
// ══════════════════════════════════════════════════════════════════════════
{
    requetes.length = 0;
    await activite.lireJournal("qg-abc", 40);
    verifier(requetes.length === 1, `lireJournal a lancé ${requetes.length} requête(s) au lieu d'une`);
    const q = requetes[0] || {};
    verifier(/FROM\s+journal/i.test(q.sql || ""), "lireJournal ne lit pas la table journal");
    verifier(
        /WHERE\s+workspace_id\s*=\s*\$1/i.test(q.sql || ""),
        `la requête du journal n'est pas filtrée par workspace_id : ${(q.sql || "").replace(/\s+/g, " ").slice(0, 120)}`
    );
    verifier(q.params?.[0] === "qg-abc", `le QG passé au SQL est ${JSON.stringify(q.params?.[0])}`);
    verifier(
        /ORDER BY\s+created_at\s+DESC/i.test(q.sql || ""),
        "la requête ne trie pas du plus récent au plus ancien"
    );
    // La limite est un paramètre, pas une chaîne interpolée.
    verifier(/LIMIT\s+\$2/i.test(q.sql || ""), "la limite du journal n'est pas un paramètre SQL");
}

// ══════════════════════════════════════════════════════════════════════════
// C. LA PAGE NE PEUT PAS ÉCRIRE
// ══════════════════════════════════════════════════════════════════════════
//
// « Ne crée pas un deuxième système de journal. » La façon la plus sûre de
// tenir cette consigne est de rendre l'écriture impossible : ce service ne
// contient aucun verbe d'écriture. On lit la source — c'est le seul endroit
// où une doublure ne suffirait pas, puisqu'un INSERT jamais appelé pendant
// le test passerait inaperçu.
{
    const src = fs.readFileSync(path.join(RACINE, "services", "activite.js"), "utf8");
    // Les commentaires du fichier PARLENT d'écriture ; on ne mesure que le
    // code. Sans ça, la garde crierait sur sa propre documentation — le piège
    // qui a déjà coûté un faux positif au chantier des blocs.
    const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    for (const verbe of ["INSERT INTO", "UPDATE ", "DELETE FROM"]) {
        verifier(
            !new RegExp(verbe, "i").test(code),
            `services/activite.js contient « ${verbe} » — cette page doit LIRE, pas écrire`
        );
    }
}

// ══════════════════════════════════════════════════════════════════════════
// D. LE REGISTRE DES ACTIONS EST FERMÉ PAR DÉFAUT
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(
        activite.estTravailDeSamii("action.qui.nexiste.pas") === false,
        "une action inconnue est comptée comme travail de SAMII — elle lui ferait porter le crédit d'un geste du marchand"
    );
    verifier(
        activite.estTravailDeSamii("") === false && activite.estTravailDeSamii(null) === false,
        "une action vide est comptée comme travail de SAMII"
    );
    // Un libellé inconnu rend l'identifiant brut : honnête, et lisible.
    verifier(
        activite.libelleAction("action.qui.nexiste.pas") === "action.qui.nexiste.pas",
        "une action inconnue reçoit un libellé inventé au lieu de son identifiant"
    );

    // ── AUCUNE ACTION DU REGISTRE N'EST INVENTÉE ─────────────────────────
    //
    // Un registre peut mentir dans les deux sens. Celui-ci ne doit pas
    // accorder « travail de SAMII » à une action que PERSONNE n'écrit : ce
    // serait une promesse sans source.
    //
    // ⚠️ `activite.js` EST EXCLU DE LA LECTURE, ET C'EST TOUT LE SUJET.
    //
    // Première version : on lisait tout `services/`, y compris le fichier qui
    // PORTE le registre. La mutation qui y ajoute une action inventée avec
    // `samii: true` est passée SANS FAIRE CRIER : la chaîne se trouvait bien
    // dans les sources… dans sa propre déclaration. La garde se regardait
    // elle-même. C'est le même piège que le contrôle d'échappement qui
    // s'attrapait sur son propre commentaire, au chantier des blocs.
    const sources = ["services", "engines", "routes"]
        .flatMap((d) => fs.readdirSync(path.join(RACINE, d))
            .filter((f) => f.endsWith(".js"))
            .filter((f) => !(d === "services" && f === "activite.js"))
            .map((f) => fs.readFileSync(path.join(RACINE, d, f), "utf8")))
        .join("\n");
    for (const [id, def] of Object.entries(activite.ACTIONS)) {
        if (!def.samii) continue;
        verifier(
            sources.includes(`"${id}"`),
            `activite.ACTIONS accorde « travail de SAMII » à « ${id} », qu'aucun fichier n'écrit — promesse sans source`
        );
    }
}

// ══════════════════════════════════════════════════════════════════════════
// E. LES ÉTATS SONT TRADUITS DEPUIS LEUR PROPRE REGISTRE
// ══════════════════════════════════════════════════════════════════════════
//
// `missions_longues` déclare ses états chez elle. Si l'un d'eux n'est pas
// traduit ici, la mission disparaît de la page sans que rien ne le dise.
{
    const etats = NIVEAUX_MISSIONS.ETATS || [];
    verifier(etats.length > 0, "missionsLongues n'exporte plus ses ÉTATS — cette garde ne mesure plus rien");
    for (const e of etats) {
        verifier(
            Object.prototype.hasOwnProperty.call(activite.ETAT_MISSION, e),
            `l'état de mission « ${e} » n'est traduit nulle part : la mission n'apparaîtrait dans aucune section`
        );
    }
    // Les trois colonnes existent toutes, et aucune valeur ne sort du lot.
    for (const [etat, colonne] of Object.entries(activite.ETAT_MISSION)) {
        verifier(
            ["en_cours", "termine", "echec"].includes(colonne),
            `l'état « ${etat} » est rangé dans « ${colonne} », qui n'est pas une section de la page`
        );
    }
    for (const [statut, colonne] of Object.entries(activite.ETAT_PUBLICATION)) {
        verifier(
            ["en_cours", "termine", "echec"].includes(colonne),
            `le statut de publication « ${statut} » est rangé dans « ${colonne} »`
        );
    }
    // Un état inconnu ne doit se ranger nulle part — surtout pas dans
    // « Terminé », qui ferait croire à un travail fait.
    verifier(
        activite.ETAT_MISSION["etat.inconnu"] === undefined,
        "un état inconnu reçoit une section"
    );
}

// ══════════════════════════════════════════════════════════════════════════
// F. LE LIBELLÉ NE RÉPÈTE PAS LE DÉTAIL — ET NE LE TRONQUE JAMAIS
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(
        activite.sansRedite("Commande confirmée sur Telegram", "Commande confirmée sur Telegram : CMD-119") === "CMD-119",
        "la répétition du libellé n'est pas retirée du détail"
    );
    verifier(
        activite.sansRedite("Commande reçue", "Commande reçue — CMD-7") === "CMD-7",
        "le tiret cadratin n'est pas reconnu comme séparateur"
    );
    // ⚠️ LE CAS QUI COMPTE LE PLUS : quand la phrase ne commence PAS par le
    // libellé, elle doit passer INTACTE. Une troncature approximative ferait
    // disparaître l'information qu'on est venu lire.
    const intact = "Commande payée : CMD-118";
    verifier(
        activite.sansRedite("Paiement reçu", intact) === intact,
        `une phrase qui ne commence pas par le libellé a été modifiée : ${JSON.stringify(activite.sansRedite("Paiement reçu", intact))}`
    );
    verifier(
        activite.sansRedite("Stock bas repéré", "Stock bas : Chemise bleue") === "Stock bas : Chemise bleue",
        "un libellé qui ressemble au détail sans l'égaler a quand même coupé"
    );
    // Rien après le libellé : pas de détail, plutôt que le libellé deux fois.
    verifier(
        activite.sansRedite("Publication automatique", "Publication automatique") === "",
        "un détail identique au libellé est affiché deux fois"
    );
    verifier(activite.sansRedite("", "n'importe quoi") === "n'importe quoi", "sansRedite mange le détail sans libellé");
    verifier(activite.sansRedite("Titre", "") === "", "sansRedite invente un détail");
}

// ══════════════════════════════════════════════════════════════════════════
// G. LA VUE
// ══════════════════════════════════════════════════════════════════════════
{
    const vue = fs.readFileSync(path.join(RACINE, "views", "activite.ejs"), "utf8");

    for (const titre of ["En cours", "Terminé", "Échec", "Activité récente", "Travail de SAMII"]) {
        verifier(vue.includes(`L("${titre}")`), `views/activite.ejs n'affiche plus la section « ${titre} »`);
    }

    // ── TOUT EST ÉCHAPPÉ ─────────────────────────────────────────────────
    //
    // Les détails viennent du journal, écrit par des moteurs — mais AUSSI
    // par des routes qui journalisent des messages reçus (`whatsapp.message`,
    // `facebook.comment`). Ce sont des textes d'inconnus affichés à un
    // marchand : un seul `<%-` ici et la page exécute ce qu'on lui envoie.
    const sansCommentaires = vue.replace(/<%#[\s\S]*?%>/g, "");
    const brutes = (sansCommentaires.match(/<%-[^%]*%>/g) || [])
        .filter((b) => !/include\(/.test(b));
    verifier(
        brutes.length === 0,
        `views/activite.ejs rend ${brutes.length} expression(s) NON échappée(s) hors include : ${brutes.join(" ")}`
    );

    verifier(
        /<meta name="viewport"/.test(vue),
        "views/activite.ejs n'a pas de meta viewport — la page se croirait large de 980 px sur un téléphone"
    );
    verifier(
        /include\("partials\/nav",\s*\{\s*variante:\s*"qg",\s*actif:\s*"activite"\s*\}\)/.test(vue),
        "views/activite.ejs ne marque pas « activite » comme entrée active dans la colonne"
    );
    // L'heure est corrigée par le navigateur : le serveur tourne en UTC.
    verifier(
        /toLocaleTimeString/.test(vue),
        "views/activite.ejs n'ajuste pas l'heure au fuseau du lecteur — un marchand d'Alger lirait 09:00 pour 10:00"
    );
}

// ══════════════════════════════════════════════════════════════════════════
// G bis. L'INDEX EST DÉCLARÉ DANS LE SCHÉMA
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ POURQUOI ICI ET PAS SEULEMENT CONTRE LA BASE.
//
// `tests/activite-reel.test.js` vérifie que le plan de la requête utilise
// bien `idx_journal_ws`. C'est la bonne question… et elle ne voit pas la
// mauvaise réponse : mesuré en mutation, retirer la ligne de
// `services/schema.js` n'a RIEN fait crier — l'index existait déjà dans la
// base d'essai, créé par une exécution précédente. La garde prouvait qu'un
// index présent sert la requête, pas qu'il serait créé un jour.
//
// Les deux moitiés sont donc nécessaires : ici, qu'il sera créé sur une base
// neuve ; là-bas, qu'il sert réellement la requête de la page.
{
    const schema = fs.readFileSync(path.join(RACINE, "services", "schema.js"), "utf8");
    verifier(
        /CREATE INDEX IF NOT EXISTS\s+idx_journal_ws\s+ON\s+journal\s*\(\s*workspace_id\s*,\s*created_at DESC\s*\)/i.test(schema),
        "services/schema.js ne crée plus idx_journal_ws — sur une base neuve, la page balaierait tout le journal à chaque ouverture"
    );
}

// ══════════════════════════════════════════════════════════════════════════
// H. LA PORTE — LA PAGE EST CHEZ NOUS, ET FERMÉE CHEZ UNE PARTENAIRE
// ══════════════════════════════════════════════════════════════════════════
//
// Règle 2 du projet : une route neuve est fermée par défaut chez les
// partenaires, et il faut la déclarer pour l'ouvrir. On mesure les deux
// sens — parce qu'une garde qui ne vérifie que « fermé chez elle » resterait
// verte si la page disparaissait aussi de chez nous.
{
    const modules = require(path.join(RACINE, "config", "modules-qg"));
    const communautes = require(path.join(RACINE, "config", "communautes"));

    const maison = communautes.get("samii");
    const partenaire = communautes.get("coindudigital");
    verifier(!!maison && !!partenaire, "les deux communautés de référence n'existent plus");

    const idsMaison = modules.autorises(maison).map((m) => m.id);
    const idsPartenaire = modules.autorises(partenaire).map((m) => m.id);

    verifier(idsMaison.includes("activite"), "le Centre d'activité a disparu de la navigation de la maison");
    verifier(
        !idsPartenaire.includes("activite"),
        "le Centre d'activité apparaît dans la navigation d'une partenaire — ce sont nos données et nos modules"
    );
    verifier(
        modules.chemineAutorise("/activite", modules.cheminsAutorises(maison)),
        "/activite est fermé chez nous"
    );
    verifier(
        !modules.chemineAutorise("/activite", modules.cheminsAutorises(partenaire)),
        "/activite est OUVERT chez une partenaire — ses membres verraient nos pages en tapant l'adresse"
    );

    // Le rang décide de la place dans la colonne : « core » et juste après le
    // chat. C'est un choix de produit, et il se perd silencieusement si
    // quelqu'un réordonne la liste.
    const entree = modules.MODULES.find((m) => m.id === "activite");
    verifier(entree?.rang === "core", `le Centre d'activité est au rang « ${entree?.rang} » au lieu de « core »`);
    const core = modules.MODULES.filter((m) => m.rang === "core").map((m) => m.id);
    verifier(
        core.indexOf("activite") === 1,
        `le Centre d'activité est en position ${core.indexOf("activite") + 1} des entrées « core » — il doit venir juste après le chat`
    );
}

// ── Verdict ──────────────────────────────────────────────────────────────
if (echecs.length) {
    console.error(`❌ activité : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.error("   • " + e);
    process.exit(1);
}
console.log(`✅ activité : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ activité : la suite a levé —", err.message);
    process.exit(1);
});
