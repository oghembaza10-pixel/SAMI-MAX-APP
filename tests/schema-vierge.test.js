// ==========================================================================
// SAMII OS — UNE BASE VIDE, UN DÉMARRAGE, ZÉRO ÉCHEC
// ==========================================================================
//
// LE TROU QUE CETTE SUITE BOUCHE, ET COMMENT IL A ÉTÉ TROUVÉ.
//
// Trois suites parlaient déjà du schéma, et aucune ne posait cette question :
//
//   `schema-neuf.test.js`       ne se connecte à AUCUNE base. Elle lit le
//                               schéma déclaré et le compare à ce que le code
//                               demande. Utile, et volontairement sans base
//                               pour tourner en intégration continue.
//   `schema-couverture.test.js` lit le SQL du dépôt. Elle voit les tables qui
//                               manquent, pas les instructions qui échouent.
//   `rls.test.js`               lance bien `preparer()`, mais sur une base
//                               PERSISTANTE. Or `CREATE TABLE IF NOT EXISTS`
//                               ne fait RIEN sur une table déjà là : dès le
//                               deuxième lancement, une erreur de structure ou
//                               d'ordre devient invisible.
//
// Résultat : personne ne lançait le démarrage sur une base vide en exigeant
// zéro échec. Et il y en avait un, depuis un moment.
//
// ── CE QU'ON A TROUVÉ EN POSANT LA QUESTION ───────────────────────────────
//
// `ALTER TABLE missions_longues ADD COLUMN IF NOT EXISTS conversation_id` se
// trouvait dans le bloc des fondations, alors que la table naît dans le bloc
// SUIVANT. Sur la base qui tourne : aucun effet, la colonne y était déjà. Sur
// une base neuve : l'ALTER échouait, la colonne n'arrivait jamais — et
// `services/missionsLongues.js` l'ÉCRIT et la RELIT. Chaque mission lancée
// échouait, sur tout déploiement neuf, et nulle part ailleurs.
//
// C'est le motif exact que `schema-neuf.test.js` raconte en tête : « schema.js
// ALTÉRAIT DES TABLES QU'IL NE CRÉAIT JAMAIS ». Le même piège, revenu par une
// porte que personne ne surveillait.
//
// ── POURQUOI CETTE SUITE EST DESTRUCTRICE, ET COMMENT ELLE S'EN GARDE ─────
//
// Pour mesurer un démarrage à froid, il faut le froid : elle SUPPRIME toutes
// les tables du schéma `public`, puis lance `preparer()`. Le garde-fou est
// celui des autres suites réelles — une base LOCALE dont le nom contient
// « test », et rien d'autre. Sans `PGTEST_URL`, elle se saute.
//
// Elle laisse la base COMPLÈTE derrière elle : le dernier geste est un
// démarrage réussi, donc les suites qui la suivent retrouvent leur schéma.
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

(async () => {
    const URL = process.env.PGTEST_URL;
    if (!URL) {
        console.log("⏭️  Aucune PGTEST_URL — démarrage à froid non vérifié (normal hors développement).");
        return;
    }
    // Le même garde-fou que rls, credits-reel, missions-longues et
    // portefeuille. Ici il compte DOUBLE : cette suite supprime des tables.
    if (!/localhost|127\.0\.0\.1|host=\//.test(URL) || !/test/i.test(URL)) {
        console.error("❌ PGTEST_URL doit être une base LOCALE dont le nom contient « test ». Suite refusée.");
        process.exit(1);
    }
    process.env.DATABASE_URL = URL;
    const db = require(path.join(RACINE, "services/db.js"));
    const schema = require(path.join(RACINE, "services/schema.js"));

    // ── ON FAIT LE VIDE ──────────────────────────────────────────────────
    //
    // Table par table avec CASCADE, et non `DROP SCHEMA public` : celui-ci
    // emporterait aussi les droits posés sur le schéma, que le démarrage ne
    // repose pas. On veut une base sans TABLES, pas une base sans schéma.
    const avant = await db.query(
        `SELECT relname FROM pg_class
          WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`);
    for (const t of avant) {
        await db.query(`DROP TABLE IF EXISTS public."${t.relname}" CASCADE`);
    }

    // LE MONTAGE D'ABORD. Si des tables survivent, « base vierge » est faux
    // et un zéro échec ne prouverait plus rien.
    const restantes = await db.query(
        `SELECT count(*)::int AS n FROM pg_class
          WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`);
    verifier(restantes[0]?.n === 0,
        `montage : ${restantes[0]?.n} table(s) ont survécu au nettoyage — la base n'est pas vierge, ` +
        "et un démarrage sans échec ne prouverait rien (CREATE TABLE IF NOT EXISTS ne fait rien " +
        "sur une table déjà là)");

    // ── LE DÉMARRAGE, À FROID ────────────────────────────────────────────
    const froid = await schema.preparer();
    verifier(froid.echecs === 0,
        `le démarrage sur une base VIERGE rend ${froid.echecs} échec(s). Chacun est une ` +
        "instruction qui ne s'exécutera JAMAIS sur un déploiement neuf : une colonne qui " +
        "manquera pour toujours, ou une table qui n'existera pas. Et rien ne le dira sur la " +
        "base qui tourne, où l'instruction est sans effet parce que son résultat est déjà là");
    verifier(froid.creees > 100,
        `seulement ${froid.creees} instructions exécutées sur une base vierge : le démarrage ` +
        "n'a pas fait son travail, et les vérifications suivantes seraient vides de sens");

    // ── ET IL EST REJOUABLE ──────────────────────────────────────────────
    //
    // Un démarrage tourne à CHAQUE lancement du serveur, pas une fois. Une
    // instruction qui ne passe qu'une seule fois ferait échouer tous les
    // redémarrages suivants — et personne ne regarde les logs d'un
    // redémarrage qui a l'air normal.
    const chaud = await schema.preparer();
    verifier(chaud.echecs === 0,
        `relancé sur la base qu'il vient de créer, le démarrage rend ${chaud.echecs} échec(s) : ` +
        "il n'est pas rejouable, donc chaque redémarrage du serveur crie pour une raison qui " +
        "n'en est pas une");

    // ── ET CE QUI EST DÉCLARÉ EXISTE VRAIMENT ────────────────────────────
    //
    // La liste est lue depuis `A_VERROUILLER`, donc depuis la déclaration.
    // Une table qui y est inscrite sans être créée n'est pas protégée : elle
    // n'existe pas. C'est la même exigence que `schema-neuf`, mais mesurée
    // sur une base qui vient de naître au lieu d'être lue dans le texte.
    const presentes = new Set(
        (await db.query(
            `SELECT relname FROM pg_class
              WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`)).map((r) => r.relname),
    );
    for (const t of schema.A_VERROUILLER) {
        verifier(presentes.has(t),
            `« ${t} » est déclarée dans A_VERROUILLER et n'existe PAS après un démarrage à ` +
            "froid : sa protection ne s'appliquerait jamais, et la liste aurait l'air complète " +
            "en ne protégeant rien");
    }

    // La colonne qui a motivé cette suite. Elle est nommée explicitement :
    // un jour quelqu'un redéplacera cet ALTER, et le message doit dire quoi.
    const colonne = await db.query(
        `SELECT count(*)::int AS n FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'missions_longues'
            AND column_name = 'conversation_id'`);
    verifier(colonne[0]?.n === 1,
        "« missions_longues.conversation_id » manque après un démarrage à froid : son ALTER " +
        "s'exécute sans doute AVANT le CREATE de la table (c'était le cas jusqu'au 2026-09-30). " +
        "services/missionsLongues.js écrit et relit cette colonne — toute mission lancée " +
        "échouerait sur un déploiement neuf, et seulement là");
})().then(() => {
    if (echecs.length) {
        console.log(`\n❌ démarrage à froid : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.log(`   • ${e}`);
        console.log("");
        process.exit(1);
    }
    console.log(`✅ démarrage à froid : ${verifs} vérifications passées`);
}).catch((err) => {
    console.log(`\n❌ démarrage à froid : la suite n'a pas pu s'exécuter — ${err.message}\n`);
    process.exit(1);
});
