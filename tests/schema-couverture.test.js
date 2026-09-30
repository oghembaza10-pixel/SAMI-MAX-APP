// ==========================================================================
// SAMII OS — TOUTE TABLE QUE LE CODE UTILISE REVIENT-ELLE SUR UNE BASE NEUVE ?
// ==========================================================================
//
// La question que ce fichier garde : si on recréait la base demain, avec
// `services/schema.js` et rien d'autre, quelles requêtes du code tomberaient
// sur une table absente ?
//
// Ce n'est pas théorique. Relevé le 2026-09-30 : le code interroge 70 tables,
// le démarrage en créait 45. Vingt-cinq manquaient à l'appel :
//
//     18  créées par un `scripts/init-*.js`, lancé à la main, une fois. Elles
//         existent en production par l'histoire, pas par le code.
//      6  créées NULLE PART dans le dépôt — exactement les six de
//         `A_VERROUILLER_SI_PRESENTE`. ✅ MIGRÉES le même jour : leur DDL est
//         entré dans `BLOCS`, et ce garde a lui-même réclamé le retrait de
//         leurs six lignes du registre ci-dessous.
//      1  `shipments` : interrogée par services/tracking/yalidine.js et
//         inexistante même en production.
//
// Il reste donc dix-neuf manques déclarés, et le démarrage crée 51 tables.
//
// C'est la même leçon que les trois « ex-script » du verrou RLS, et que le
// REVOKE TRUNCATE : une protection — ou une table — qui dépend d'un geste
// manuel ne revient pas sur une base recréée.
//
// ── CE QUE CE FICHIER FAIT, ET CE QU'IL NE PEUT PAS FAIRE ─────────────────
//
// Il LIT LE SQL DU DÉPÔT. `AGENTS.md` prévient à raison : « un test qui lit la
// source crie à tort, puis se tait quand ça compte ». Deux garde-fous contre
// ça :
//
//   1. LES MOTS-CLÉS SQL SONT CHERCHÉS EN MAJUSCULES. Le dépôt écrit son SQL
//      ainsi (`SELECT id FROM shipments WHERE …`), et la prose anglaise des
//      gabarits écrit « from your Meta account », « from now on », « from one
//      screen » en minuscules. Mesuré : sans cette règle, dix mots de prose
//      passaient pour des tables ; avec elle, ZÉRO. C'est une heuristique, et
//      elle est dite comme telle — si un jour quelqu'un écrit du SQL en
//      minuscules, ce fichier ne le verra pas. Il ne criera pas à tort pour
//      autant : il en dira moins, pas plus.
//
//   2. CHAQUE MANQUE DOIT ÊTRE DÉCLARÉ, AVEC SA RAISON, dans le registre
//      ci-dessous. Une table neuve utilisée sans être créée au démarrage fait
//      ROUGIR ce test. C'est « fermé par défaut », comme la porte des
//      communautés : l'oubli tombe du côté sûr.
//
// ── ET LE REGISTRE NE DOIT PAS POURRIR ────────────────────────────────────
//
// Une liste d'exceptions qu'on n'entretient pas devient un mensonge. Ce
// fichier vérifie donc AUSSI, dans l'autre sens, que chaque exception est
// encore vraie : si une table déclarée ici finit par être créée au démarrage,
// ou si le code cesse de l'utiliser, le test le dit et demande qu'on retire
// la ligne. C'est ce qui fait que ce registre se vide au lieu de grossir.
// ==========================================================================
const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ══════════════════════════════════════════════════════════════════════════
// LE REGISTRE DES MANQUES CONNUS
// ══════════════════════════════════════════════════════════════════════════
//
// Chaque entrée dit OÙ la table naît aujourd'hui et POURQUOI elle n'est pas
// encore au démarrage. Ce ne sont pas des absolutions : c'est la liste du
// travail qui reste, écrite pour qu'on la voie.
const MANQUES_CONNUS = [
    // ── ✅ SIX LIGNES ONT DISPARU D'ICI LE 2026-09-30 ──────────────────────
    //
    // `cartes_achats`, `push_subscriptions`, `livraisons`, `livreurs`,
    // `stories` et `stories_vues` étaient déclarées ici : créées nulle part
    // dans le dépôt, présentes en production par l'histoire. Leur DDL est
    // maintenant dans `BLOCS`, relevé colonne par colonne sur la production.
    //
    // C'est ce garde qui a signalé qu'il fallait retirer les six lignes : la
    // migration faite, il a crié « est maintenant créée au démarrage, retire-la
    // de MANQUES_CONNUS ». La liste se vide donc comme prévu, et pas parce que
    // quelqu'un a pensé à le faire.

    // ── Les dix-huit nées d'un script lancé à la main ──────────────────────
    // Elles existent en production. Sur une base recréée, elles n'existent
    // que si quelqu'un relance le script — donc elles n'existent pas.
    { table: "abonnements", ne: "scripts/init-all.js", pourquoi: "script manuel" },
    { table: "academie_cours", ne: "scripts/init-academie.js", pourquoi: "script manuel" },
    { table: "academie_favoris", ne: "scripts/init-academie.js", pourquoi: "script manuel" },
    { table: "academie_likes", ne: "scripts/init-academie.js", pourquoi: "script manuel" },
    { table: "avis", ne: "scripts/init-all.js", pourquoi: "script manuel" },
    { table: "candidatures_partenariat", ne: "scripts/init-partenariat.js", pourquoi: "script manuel" },
    { table: "commissions_parrainage", ne: "scripts/init-parrainage.js", pourquoi: "script manuel" },
    { table: "configuration", ne: "scripts/init-configuration.js", pourquoi: "script manuel" },
    { table: "connecteurs", ne: "scripts/init-all.js", pourquoi: "script manuel" },
    { table: "conversations", ne: "scripts/init-communication.js", pourquoi: "script manuel" },
    { table: "diffusion", ne: "scripts/init-diffusion.js", pourquoi: "script manuel" },
    { table: "emplois", ne: "scripts/init-all.js", pourquoi: "script manuel" },
    { table: "factures", ne: "scripts/init-commerce.js", pourquoi: "script manuel" },
    { table: "favoris", ne: "scripts/init-all.js", pourquoi: "script manuel" },
    { table: "produits_variantes", ne: "scripts/init-all.js", pourquoi: "script manuel" },
    { table: "publications_commentaires", ne: "scripts/init-community.js", pourquoi: "script manuel" },
    { table: "publications_likes", ne: "scripts/init-community.js", pourquoi: "script manuel" },
    { table: "services", ne: "scripts/init-all.js", pourquoi: "script manuel" },

    // ── Et celle qui n'existe même pas en production ───────────────────────
    // `services/tracking/yalidine.js` écrit dans `shipments` : SELECT, UPDATE
    // et INSERT. La table n'existe NI au démarrage, NI dans un script, NI en
    // production (vérifié le 2026-09-30 sur la vraie base). Chaque appel
    // échouerait sur « relation does not exist » — et le `catch` du fichier
    // l'avalerait en un ❌ dans les logs.
    //
    // Ce n'est pas une panne aujourd'hui : `saveOrUpdateTracking` est exportée
    // et JAMAIS appelée (vérifié : aucun appelant dans tout le dépôt). C'est
    // un piège posé pour le jour où quelqu'un la branche. Signalé au
    // propriétaire ; créer une table est sa décision, pas celle d'un test.
    { table: "shipments", ne: "nulle part — ni en production", pourquoi: "code mort : aucun appelant" },
];

// ══════════════════════════════════════════════════════════════════════════
// CE QUE LE CODE UTILISE
// ══════════════════════════════════════════════════════════════════════════
//
// On ne regarde ni `tests/` (qui fabrique ses propres tables témoins), ni
// `scripts/` (qui les crée justement à la main — c'est l'objet du constat, pas
// une utilisation), ni `vues/` et `public/` (pas de SQL).
const HORS_CHAMP = new Set(["node_modules", ".git", "tests", "scripts", "public", "vues"]);

// Ce qui ressemble à un nom de table après un mot-clé, sans en être un.
const PAS_UNE_TABLE = new Set(["information_schema", "dual", "unnest", "generate_series"]);

function fichiersJs(dir, acc = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (HORS_CHAMP.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) fichiersJs(p, acc);
        else if (e.name.endsWith(".js")) acc.push(p);
    }
    return acc;
}

// Les mots-clés sont en MAJUSCULES, volontairement : voir l'en-tête.
const MOTIFS = [
    /\bFROM\s+(?:public\.)?"?([a-z][a-z0-9_]{2,})"?/g,
    /\bJOIN\s+(?:public\.)?"?([a-z][a-z0-9_]{2,})"?/g,
    /\bINSERT\s+INTO\s+(?:public\.)?"?([a-z][a-z0-9_]{2,})"?/g,
    /\bUPDATE\s+(?:public\.)?"?([a-z][a-z0-9_]{2,})"?\s+SET\b/g,
    /\bDELETE\s+FROM\s+(?:public\.)?"?([a-z][a-z0-9_]{2,})"?/g,
];

const utilisees = new Map();   // table -> Set(fichiers)
for (const f of fichiersJs(RACINE)) {
    const src = fs.readFileSync(f, "utf8");
    for (const motif of MOTIFS) {
        motif.lastIndex = 0;
        let m;
        while ((m = motif.exec(src))) {
            const t = m[1];
            if (PAS_UNE_TABLE.has(t) || t.startsWith("pg_")) continue;
            if (!utilisees.has(t)) utilisees.set(t, new Set());
            utilisees.get(t).add(path.relative(RACINE, f));
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════
// CE QUE LE DÉMARRAGE CRÉE
// ══════════════════════════════════════════════════════════════════════════
//
// Lu depuis `schema.BLOCS`, donc depuis LA DÉCLARATION et non une copie : une
// table ajoutée demain au démarrage est comptée sans que personne y pense.
const schema = require(path.join(RACINE, "services/schema.js"));
const creees = new Set();
for (const bloc of schema.BLOCS) {
    for (const sql of bloc.sql) {
        const m = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:public\.)?"?([a-z0-9_]+)"?/i.exec(sql);
        if (m) creees.add(m[1]);
    }
}

// Le montage d'abord : si le scan ne trouve rien, tout le reste passerait pour
// un succès parfait.
verifier(utilisees.size >= 40,
    `le scan n'a trouvé que ${utilisees.size} tables utilisées dans le code, là où il y en a ` +
    "des dizaines : les motifs ne reconnaissent plus le SQL du dépôt, et ce fichier ne " +
    "mesure plus rien");
verifier(creees.size >= 40,
    `seulement ${creees.size} tables sont créées par schema.BLOCS : soit le démarrage a perdu ` +
    "des blocs, soit la lecture de la déclaration est cassée");

// ══════════════════════════════════════════════════════════════════════════
// 1. AUCUN MANQUE NON DÉCLARÉ
// ══════════════════════════════════════════════════════════════════════════
const declares = new Map(MANQUES_CONNUS.map((m) => [m.table, m]));
const manquantes = [...utilisees.keys()].filter((t) => !creees.has(t)).sort();

for (const t of manquantes) {
    if (declares.has(t)) continue;
    const ou = [...utilisees.get(t)].sort().slice(0, 3).join(", ");
    verifier(false,
        `« ${t} » est interrogée par le code (${ou}) et n'est créée NI au démarrage NI déclarée ` +
        "comme manque connu : sur une base recréée, cette requête tomberait sur une table " +
        "absente. Ajoute-la aux blocs de services/schema.js, ou inscris-la dans MANQUES_CONNUS " +
        "avec la raison");
}

// ══════════════════════════════════════════════════════════════════════════
// 2. LE REGISTRE EST-IL ENCORE VRAI ? (l'anti-pourrissement)
// ══════════════════════════════════════════════════════════════════════════
//
// Sans ces deux vérifications, le registre grossirait sans jamais se vider, et
// finirait par décrire un dépôt qui n'existe plus.
for (const m of MANQUES_CONNUS) {
    verifier(!creees.has(m.table),
        `« ${m.table} » est maintenant créée au démarrage : retire-la de MANQUES_CONNUS. Une ` +
        "exception qui n'en est plus une apprend à ne plus lire la liste");
    verifier(utilisees.has(m.table),
        `« ${m.table} » est déclarée dans MANQUES_CONNUS mais AUCUNE requête du code ne la ` +
        "touche plus : soit le scan ne la voit plus, soit la ligne est à retirer");
}

// ══════════════════════════════════════════════════════════════════════════
// 3. ET LES SIX CONDITIONNELLES SONT-ELLES BIEN CELLES QU'ON CROIT ?
// ══════════════════════════════════════════════════════════════════════════
//
// `A_VERROUILLER_SI_PRESENTE` existe parce que ces tables ne sont pas créées
// au démarrage. Le jour où l'une y entre, elle doit passer dans
// `A_VERROUILLER` — sinon sa protection reste conditionnelle alors qu'elle
// pourrait être certaine. C'est le lien entre ce fichier et le verrou RLS.
for (const t of schema.A_VERROUILLER_SI_PRESENTE) {
    verifier(!creees.has(t),
        `« ${t} » est créée au démarrage mais reste dans A_VERROUILLER_SI_PRESENTE : elle doit ` +
        "passer dans A_VERROUILLER, dont la promesse est plus forte (« nous la créons donc nous " +
        "la verrouillons »)");
}

if (echecs.length) {
    console.log(`\n❌ couverture du schéma : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.log(`   • ${e}`);
    console.log("");
    process.exit(1);
}
console.log(`✅ couverture du schéma : ${verifs} vérifications passées ` +
    `(${utilisees.size} tables utilisées, ${creees.size} créées au démarrage, ` +
    `${MANQUES_CONNUS.length} manques déclarés)`);
