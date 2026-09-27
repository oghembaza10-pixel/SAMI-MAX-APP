// ==========================================================================
// SAMII OS — LE POSTE DE TRAVAIL, CONTRE UNE VRAIE BASE
// ==========================================================================
//
// POURQUOI EN PLUS DE activite.test.js. La suite unitaire prouve que la BONNE
// QUESTION est posée : la requête porte `WHERE workspace_id = $1`, et rien ne
// part sans QG. Mais une doublure n'exécute aucun SQL (règle 3 d'AGENTS.md) —
// elle ne peut pas dire si la base RÉPOND ce qu'on croit.
//
// Or les propriétés qui comptent ici ne s'observent qu'en lisant vraiment :
//
//   A. AUCUN événement d'un marchand chez un autre.
//   B. AUCUNE duplication — c'est le défaut que ce chantier corrige
//      (20 lignes peintes pour 11 éléments, mesuré avant).
//   C. AUCUNE PERTE — « zéro duplication » serait satisfait en n'affichant
//      rien. Les deux gardes ne valent qu'ensemble.
//   D. Le fil Chat → mission → activité → retour au Chat tient bout à bout.
//   E. Une trace d'outil ne se confond jamais avec une action métier.
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
const TRACES = require(path.join(RACINE, "config", "traces"));

let verifs = 0;
const echecs = [];
const verifier = (condition, message) => {
    verifs++;
    if (!condition) echecs.push(message);
};

const QG_A = "qg-poste-a", QG_B = "qg-poste-b";
const USER_A = "user-poste-a", USER_B = "user-poste-b";
const MARQUE_A = "POSTE-ESSAI-A", MARQUE_B = "POSTE-ESSAI-B";
const TOUR_A = "tour-poste-a";

// Le nettoyage ne DEVINE pas ce qu'on a écrit — leçon apprise trois fois au
// chantier F, où il énumérait les identifiants attendus et en oubliait un de
// plus à chaque campagne de mutation. Il efface tout ce qui est venu après le
// dernier identifiant connu avant l'écriture.
let depart = 0;

async function balayer() {
    await db.query(`DELETE FROM journal WHERE workspace_id IN ($1,$2)`, [QG_A, QG_B]);
    await db.query(`DELETE FROM missions_longues WHERE workspace_id IN ($1,$2)`, [QG_A, QG_B]);
}

const mission = (userId, qg, etat, etape, tour) => db.query(
    `INSERT INTO missions_longues
        (user_id, workspace_id, mission, entree, etat, etape, etapes_total, conversation_id, expire_le)
     VALUES ($1,$2,'strategie_complete','{}',$3,$4,3,$5, NOW() + (86400000 || ' milliseconds')::interval)`,
    [userId, qg, etat, etape, tour || null]
);

(async () => {
    await require(path.join(RACINE, "services", "schema")).preparer();
    await balayer();
    depart = (await db.query(`SELECT COALESCE(MAX(id), 0)::int AS n FROM journal`))[0].n;

    // ── Le marchand A : du business, du travail de SAMII, un tour de chat ─
    await journal.log({ action: "order.paid",  details: `Commande payée : ${MARQUE_A}`, workspaceId: QG_A });
    await journal.log({ action: "stock.low",   details: `Stock bas : ${MARQUE_A}`,      workspaceId: QG_A });
    await journal.log({ action: "tracking.activated", details: `Suivi : ${MARQUE_A}`,   workspaceId: QG_A });
    await journal.log({
        action: TRACES.nomAction("prix_du_marche", true),
        details: TRACES.OUTILS.prix_du_marche.libelle,
        workspaceId: QG_A, userId: USER_A, conversationId: TOUR_A,
    });
    await journal.log({
        action: TRACES.nomAction("envoyer_email", false),
        details: `${TRACES.OUTILS.envoyer_email.libelle} — ${MARQUE_A} refusé`,
        workspaceId: QG_A, userId: USER_A, conversationId: TOUR_A,
    });
    await mission(USER_A, QG_A, "en_cours", 2, TOUR_A);
    await mission(USER_A, QG_A, "terminee", 3, null);

    // ── Le marchand B : le sien, et rien qui ressemble ──────────────────
    await journal.log({ action: "order.paid", details: `Commande payée : ${MARQUE_B}`, workspaceId: QG_B });
    await mission(USER_B, QG_B, "en_cours", 1, null);

    const chezA = await activite.pour({ workspaceId: QG_A, userId: USER_A });
    const chezB = await activite.pour({ workspaceId: QG_B, userId: USER_B });

    // ══════════════════════════════════════════════════════════════════════
    // A. CHACUN CHEZ SOI
    // ══════════════════════════════════════════════════════════════════════
    verifier(!JSON.stringify(chezA).includes(MARQUE_B), "le poste de travail de A contient une ligne de B");
    verifier(!JSON.stringify(chezB).includes(MARQUE_A), "le poste de travail de B contient une ligne de A");
    verifier(JSON.stringify(chezA).includes(MARQUE_A), "A ne voit pas ses propres lignes");
    verifier(JSON.stringify(chezB).includes(MARQUE_B), "B ne voit pas ses propres lignes");

    // Le croisement : un compte dont la session porterait le QG d'un autre.
    const croise = await activite.pour({ workspaceId: QG_B, userId: USER_A });
    verifier(!JSON.stringify(croise).includes(MARQUE_A), "croiser l'utilisateur de A avec le QG de B fait apparaître les lignes de A");

    // ══════════════════════════════════════════════════════════════════════
    // B. AUCUNE DUPLICATION — ET C. AUCUNE PERTE
    // ══════════════════════════════════════════════════════════════════════
    //
    // Les deux ensemble, jamais l'une sans l'autre : « zéro doublon » est
    // trivialement vrai d'une page qui n'affiche rien.
    {
        const cle = (e) => [e.source, e.acteur, e.verbe, e.etat, e.titre, e.detail, e.quand].join("|");
        const vus = chezA.fil.map(cle);
        verifier(
            vus.length === new Set(vus).size,
            `${vus.length - new Set(vus).size} élément(s) apparaissent deux fois dans le fil de A`
        );

        // 5 lignes de journal + 2 missions = 7 éléments, aucun perdu.
        verifier(
            chezA.fil.length === 7,
            `le fil de A porte ${chezA.fil.length} éléments au lieu de 7 — un événement a été perdu en route`
        );

        // Et « en cours » n'est PAS une seconde liste : c'est une vue du fil.
        verifier(
            chezA.enCours.every((e) => chezA.fil.includes(e)),
            "« en cours » contient des éléments absents du fil — c'est devenu une seconde liste"
        );
        verifier(chezA.enCours.length === 1, `« en cours » compte ${chezA.enCours.length} élément(s) au lieu de 1`);
    }

    // ── Les compteurs des filtres disent la vérité ──────────────────────
    {
        const c = chezA.compteurs;
        verifier(c.tout === chezA.fil.length, `le compteur « tout » annonce ${c.tout} pour ${chezA.fil.length} éléments`);
        verifier(
            c.samii === chezA.fil.filter((e) => e.acteur === "samii").length,
            `le compteur « SAMII » annonce ${c.samii}`
        );
        verifier(
            c.business === chezA.fil.filter((e) => e.acteur === "business").length,
            `le compteur « business » annonce ${c.business}`
        );
        verifier(c.samii + c.business === c.tout, "un élément n'est ni business ni SAMII, ou compté deux fois");
        verifier(c.echecs === 1, `le compteur « échecs » annonce ${c.echecs} au lieu de 1`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // D. LE FIL CHAT → TRAVAIL → RETOUR AU CHAT
    // ══════════════════════════════════════════════════════════════════════
    {
        const avecTour = chezA.fil.filter((e) => e.conversationId === TOUR_A);
        verifier(
            avecTour.length === 3,
            `${avecTour.length} élément(s) portent le tour de chat au lieu de 3 (deux traces + la mission)`
        );
        for (const e of avecTour) {
            const chat = e.gestes.find((g) => g.type === "chat");
            verifier(!!chat, `« ${e.titre} » vient d'une conversation mais ne propose pas d'y retourner`);
            verifier(
                chat && chat.cible === `/?tour=${TOUR_A}`,
                `le retour au Chat de « ${e.titre} » vise ${chat && chat.cible}`
            );
        }
        // Et la mission a bien gardé son tour EN BASE, pas seulement à l'écran.
        const enBase = await db.query(
            `SELECT conversation_id FROM missions_longues WHERE workspace_id = $1 AND etat = 'en_cours'`, [QG_A]
        );
        verifier(enBase[0]?.conversation_id === TOUR_A, `la mission a gardé ${JSON.stringify(enBase[0]?.conversation_id)}`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // E. UNE TRACE D'OUTIL N'EST PAS UNE ACTION MÉTIER
    // ══════════════════════════════════════════════════════════════════════
    {
        const faux = await db.query(
            `SELECT COUNT(*)::int AS n FROM journal
              WHERE workspace_id = $1 AND id > $2
                AND (action LIKE 'order.%' OR action LIKE 'stock.%' OR action LIKE 'abonnement.%')
                AND action LIKE '%prix_du_marche%'`,
            [QG_A, depart]
        );
        verifier(faux[0].n === 0, "une trace d'outil s'est écrite sous un nom d'action métier");

        const recommande = chezA.fil.find((e) => e.verbe === "recommande");
        verifier(!!recommande, "la trace de `prix_du_marche` n'apparaît pas comme une recommandation");
        verifier(recommande?.acteur === "samii", "une trace d'outil est rangée côté business");

        const rate = chezA.fil.find((e) => e.etat === "echec" && e.acteur === "samii");
        verifier(!!rate, "un outil en échec n'apparaît pas comme un échec de SAMII");
        verifier(rate?.verbe === "agit", `l'e-mail refusé porte le verbe « ${rate?.verbe} »`);

        // Le stock : business pour le fait, SAMII pour l'avoir repéré.
        const stock = chezA.fil.find((e) => e.verbe === "detecte");
        verifier(!!stock && stock.acteur === "samii", "« stock bas repéré » n'est pas attribué à SAMII");
    }

    // ── Un QG sans rien le dit ──────────────────────────────────────────
    {
        const rien = await activite.pour({ workspaceId: "qg-poste-vide", userId: "u-vide" });
        verifier(rien.vide === true, "un QG sans activité ne se déclare pas vide");
        verifier(rien.fil.length === 0, "un QG sans activité reçoit des lignes");
    }

    // ── L'index sert réellement la requête de la page ────────────────────
    {
        await db.query(`SET enable_seqscan = off`);
        const plan = (await db.query(
            `EXPLAIN SELECT action, details, montant, created_at, ref_id, conversation_id FROM journal
              WHERE workspace_id = $1 ORDER BY created_at DESC, id DESC LIMIT 60`, [QG_A]
        )).map((l) => l["QUERY PLAN"]).join(" ");
        await db.query(`SET enable_seqscan = on`);
        verifier(plan.includes("idx_journal_ws"), `la requête de la page n'utilise pas idx_journal_ws — plan : ${plan.slice(0, 140)}`);
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
