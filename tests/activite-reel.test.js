// ==========================================================================
// SAMII OS — LE CENTRE D'ACTIVITÉ, CONTRE UNE VRAIE BASE
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE EN PLUS DE activite.test.js.
//
// La suite unitaire prouve que la BONNE QUESTION est posée : la requête porte
// `WHERE workspace_id = $1`, et rien ne part sans QG. C'est déjà l'essentiel
// du risque… mais une doublure n'exécute aucun SQL (règle 3 d'AGENTS.md).
// Elle ne peut pas dire si la base RÉPOND ce qu'on croit.
//
// Or la propriété qui compte ici est une propriété de sécurité, et elle ne
// s'observe qu'en lisant vraiment : **aucun événement d'un marchand ne doit
// apparaître chez un autre**. Cette fuite est revenue cinq fois dans ce
// projet ; c'est la dernière chose qu'on accepte de tenir pour acquise.
//
// CE QU'ON VÉRIFIE ICI, ET NULLE PART AILLEURS.
//   A. Deux marchands, deux QG : chacun ne voit que le sien.
//   B. Les trois sections d'état rangent les vraies lignes au bon endroit.
//   C. Un QG sans rien rend une page honnêtement vide.
//   D. L'index posé au chantier F sert RÉELLEMENT la requête de la page.
//
// Lancer :
//   PGTEST_URL=postgres://samii@127.0.0.1:5432/samii_pgtest npm test
// ==========================================================================
const path = require("path");

const URL = process.env.PGTEST_URL || "";
if (!URL) {
    console.log("⏭️  Aucune PGTEST_URL — suite activité réelle ignorée (normal hors développement).");
    process.exit(0);
}
if (!/localhost|127\.0\.0\.1|host=\//.test(URL) || !/test/i.test(URL)) {
    console.error("❌ PGTEST_URL doit être une base LOCALE dont le nom contient « test ». Suite refusée.");
    process.exit(1);
}
process.env.DATABASE_URL = URL;
process.env.PGSSL = process.env.PGSSL || "off";

const RACINE = path.join(__dirname, "..");
const db = require(path.join(RACINE, "services", "db"));
const journal = require(path.join(RACINE, "services", "journalService"));
const activite = require(path.join(RACINE, "services", "activite"));

let verifs = 0;
const echecs = [];
const verifier = (condition, message) => {
    verifs++;
    if (!condition) echecs.push(message);
};

const QG_A = "qg-activite-a";
const QG_B = "qg-activite-b";
const USER_A = "user-activite-a";
const USER_B = "user-activite-b";
const MARQUE_A = "ACTIVITE-ESSAI-A";
const MARQUE_B = "ACTIVITE-ESSAI-B";

// Même leçon que la suite du journal, apprise trois fois : on n'énumère pas
// ce qu'on croit avoir écrit. On note le dernier identifiant avant d'écrire,
// et on efface tout ce qui vient après.
let depart = 0;

async function balayer() {
    await db.query(`DELETE FROM journal WHERE workspace_id IN ($1,$2)`, [QG_A, QG_B]);
    await db.query(`DELETE FROM missions_longues WHERE workspace_id IN ($1,$2)`, [QG_A, QG_B]);
}

(async () => {
    await require(path.join(RACINE, "services", "schema")).preparer();
    await balayer();
    depart = (await db.query(`SELECT COALESCE(MAX(id), 0)::int AS n FROM journal`))[0].n;

    // ── Le marchand A : trois lignes de journal, trois missions ─────────
    await journal.log({ action: "order.paid",           details: `Commande payée : ${MARQUE_A}`, workspaceId: QG_A });
    await journal.log({ action: "autopost.publication", details: `Publication : ${MARQUE_A}`,    workspaceId: QG_A });
    await journal.log({ action: "tracking.activated",   details: `Suivi activé : ${MARQUE_A}`,   workspaceId: QG_A });

    const mission = async (userId, qg, etat, etape, erreur) => db.query(
        `INSERT INTO missions_longues
            (user_id, workspace_id, mission, entree, etat, etape, etapes_total, erreur, expire_le)
         VALUES ($1,$2,'strategie_complete','{}',$3,$4,3,$5, NOW() + (86400000 || ' milliseconds')::interval)`,
        [userId, qg, etat, etape, erreur || null]
    );
    await mission(USER_A, QG_A, "en_cours", 2, null);
    await mission(USER_A, QG_A, "terminee", 3, null);
    await mission(USER_A, QG_A, "echouee",  1, "le relais n'a pas répondu");

    // ── Le marchand B : le sien, et rien qui ressemble ──────────────────
    await journal.log({ action: "order.paid", details: `Commande payée : ${MARQUE_B}`, workspaceId: QG_B });
    await mission(USER_B, QG_B, "en_cours", 1, null);

    // ══════════════════════════════════════════════════════════════════════
    // A. CHACUN CHEZ SOI
    // ══════════════════════════════════════════════════════════════════════
    const chezA = await activite.pour({ workspaceId: QG_A, userId: USER_A });
    const chezB = await activite.pour({ workspaceId: QG_B, userId: USER_B });

    const texte = (r) => JSON.stringify(r);
    verifier(!texte(chezA).includes(MARQUE_B), "le Centre d'activité du marchand A contient une ligne du marchand B");
    verifier(!texte(chezB).includes(MARQUE_A), "le Centre d'activité du marchand B contient une ligne du marchand A");
    verifier(texte(chezA).includes(MARQUE_A), "le marchand A ne voit pas ses propres lignes");
    verifier(texte(chezB).includes(MARQUE_B), "le marchand B ne voit pas ses propres lignes");

    verifier(chezA.recent.length === 3, `le marchand A devrait avoir 3 lignes de journal, il en a ${chezA.recent.length}`);
    verifier(chezB.recent.length === 1, `le marchand B devrait avoir 1 ligne de journal, il en a ${chezB.recent.length}`);

    // ── LE CAS QUI FAIT VRAIMENT PEUR ────────────────────────────────────
    //
    // Un compte dont la session porte le QG d'un autre — ou dont le QG a
    // changé. Les missions sont filtrées sur `user_id` ET `workspace_id` :
    // croiser les deux ne doit rien rendre, jamais l'union.
    const croise = await activite.pour({ workspaceId: QG_B, userId: USER_A });
    verifier(
        !JSON.stringify(croise.enCours).includes("strategie") || croise.enCours.length === 0,
        "un utilisateur voit les missions d'un QG qui n'est pas le sien"
    );
    verifier(
        !JSON.stringify(croise).includes(MARQUE_A),
        "croiser l'utilisateur de A avec le QG de B fait apparaître les lignes de A"
    );

    // ══════════════════════════════════════════════════════════════════════
    // B. LES TROIS ÉTATS TOMBENT AU BON ENDROIT
    // ══════════════════════════════════════════════════════════════════════
    verifier(chezA.enCours.length === 1, `« En cours » : ${chezA.enCours.length} au lieu de 1`);
    verifier(chezA.termine.length === 1, `« Terminé » : ${chezA.termine.length} au lieu de 1`);
    verifier(chezA.echec.length === 1,   `« Échec » : ${chezA.echec.length} au lieu de 1`);
    verifier(
        chezA.echec[0]?.erreur === "le relais n'a pas répondu",
        `l'échec ne porte pas son motif : ${JSON.stringify(chezA.echec[0]?.erreur)}`
    );
    verifier(
        chezA.enCours[0]?.progression?.etape === 2 && chezA.enCours[0]?.progression?.total === 3,
        `la progression de la mission en cours est ${JSON.stringify(chezA.enCours[0]?.progression)}`
    );

    // « Travail de SAMII » : les 3 missions + les 2 lignes de journal que le
    // registre reconnaît (order.paid, autopost.publication). PAS
    // `tracking.activated`, qui est un geste du marchand.
    verifier(
        chezA.samii.length === 5,
        `« Travail de SAMII » compte ${chezA.samii.length} éléments au lieu de 5 (3 missions + 2 lignes reconnues)`
    );
    verifier(
        !chezA.samii.some((e) => e.detail.includes("Suivi activé")),
        "« Travail de SAMII » s'attribue un geste que le marchand a fait lui-même"
    );

    // ══════════════════════════════════════════════════════════════════════
    // C. UN QG SANS RIEN LE DIT
    // ══════════════════════════════════════════════════════════════════════
    {
        const rien = await activite.pour({ workspaceId: "qg-qui-na-rien", userId: "u-qui-na-rien" });
        verifier(rien.vide === true, "un QG sans activité ne se déclare pas vide");
        verifier(rien.recent.length === 0, "un QG sans activité reçoit des lignes");
    }

    // ══════════════════════════════════════════════════════════════════════
    // D. L'INDEX SERT RÉELLEMENT LA REQUÊTE DE LA PAGE
    // ══════════════════════════════════════════════════════════════════════
    //
    // ⚠️ CE QUE CETTE GARDE MESURE, ET CE QU'ELLE NE MESURE PAS.
    //
    // Sur la table d'essai, qui tient en quelques lignes, PostgreSQL choisit
    // un balayage séquentiel quoi qu'il arrive — c'est le bon choix pour lui,
    // et ça ne dirait rien de la production. On coupe donc le balayage
    // séquentiel pour poser la seule question qui se vérifie ici : la FORME
    // de la requête correspond-elle à l'index posé au chantier F ?
    //
    // Si la page trie un jour sur autre chose, ou filtre sur une autre
    // colonne, le plan cessera de nommer `idx_journal_ws` et cette garde
    // criera — avant que le ralentissement n'arrive en service, où il est
    // invisible parce que rien ne casse.
    {
        const index = await db.query(
            `SELECT indexname FROM pg_indexes WHERE tablename = 'journal' AND indexname = 'idx_journal_ws'`
        );
        verifier(index.length === 1, "l'index idx_journal_ws n'existe pas — services/schema.js ne le crée plus");

        await db.query(`SET enable_seqscan = off`);
        const plan = (await db.query(
            `EXPLAIN SELECT action, details, montant, created_at FROM journal
              WHERE workspace_id = $1 ORDER BY created_at DESC, id DESC LIMIT 40`,
            [QG_A]
        )).map((l) => l["QUERY PLAN"]).join(" ");
        await db.query(`SET enable_seqscan = on`);

        verifier(
            plan.includes("idx_journal_ws"),
            `la requête de la page n'utilise pas idx_journal_ws même sans balayage séquentiel — plan : ${plan.slice(0, 160)}`
        );
    }

    await balayer();

    if (echecs.length) {
        console.error(`❌ activité réelle : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ activité réelle : ${verifs} vérifications passées (2 marchands, vraie base)`);
    process.exit(0);
})().catch((err) => {
    console.error("❌ activité réelle : la suite a levé —", err.message);
    process.exit(1);
});
