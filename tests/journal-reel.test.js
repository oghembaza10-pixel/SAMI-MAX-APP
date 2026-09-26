// ==========================================================================
// SAMII OS — LE JOURNAL, CONTRE UNE VRAIE BASE
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE EN PLUS DE journal.test.js.
//
// `tests/journal.test.js` monte une doublure de base. Il prouve que la bonne
// requête part avec les bons paramètres — et c'est déjà beaucoup, puisque le
// défaut du chantier F était précisément un paramètre `null`.
//
// Mais une doublure n'exécute pas de SQL (règle 3 d'AGENTS.md). Elle ne sait
// pas si la colonne existe, si le type passe, ni surtout si la ligne se
// RETROUVE quand on la cherche par QG — qui est toute la question ici : le
// défaut d'origine écrivait des lignes réelles que personne ne pouvait lire.
//
// CE QU'ON VÉRIFIE, ET QUI N'EST VÉRIFIABLE QUE CONTRE UN VRAI POSTGRES.
//
//   A. Les NEUF déclencheurs vivants écrivent une ligne rattachée au BON QG,
//      en passant par le vrai `automationEngine.run()`.
//   B. Un appel positionnel n'ajoute AUCUNE ligne — compté en base, pas dans
//      une doublure.
//   C. Une boutique inconnue donne `workspace_id = NULL`, jamais le domaine.
//   D. Aucune fuite : les événements d'un marchand ne se lisent pas chez
//      l'autre, en relisant exactement comme le fera le Centre d'activité.
//
// ── CE QU'ON REMPLACE, ET POURQUOI SEULEMENT ÇA ──────────────────────────
//
// Les notifications (Telegram, WhatsApp) sont coupées : cette suite ne doit
// écrire nulle part ailleurs que dans la base d'essai. Tout le reste est
// réel — le runner, la résolution du QG, journalService, et le SQL.
//
// Lancer :
//   PGTEST_URL=postgres://samii@127.0.0.1:5432/samii_pgtest npm test
// ==========================================================================
const assert = require("assert");
const path = require("path");

const URL = process.env.PGTEST_URL || "";
if (!URL) {
    console.log("⏭️  Aucune PGTEST_URL — suite journal réel ignorée (normal hors développement).");
    process.exit(0);
}
// Même garde-fou que les autres suites qui ÉCRIVENT : une base locale dont le
// nom contient « test », même si quelqu'un colle la mauvaise adresse.
if (!/localhost|127\.0\.0\.1|host=\//.test(URL) || !/test/i.test(URL)) {
    console.error("❌ PGTEST_URL doit être une base LOCALE dont le nom contient « test ». Suite refusée.");
    process.exit(1);
}
process.env.DATABASE_URL = URL;
process.env.PGSSL = process.env.PGSSL || "off";

const RACINE = path.join(__dirname, "..");

function remplacer(chemin, exports) {
    const r = require.resolve(path.join(RACINE, chemin));
    require.cache[r] = { id: r, filename: r, loaded: true, exports };
}
// Rien ne part vers l'extérieur.
const envoyes = [];
remplacer("engines/notificationEngine", { send: async (p) => { envoyes.push(p); } });
remplacer("services/settingsService", { createDefault: async () => {}, deactivate: async () => {}, downgrade: async () => {} });
remplacer("engines/sovereignEngine", { initialize: async () => {}, activate: async () => {} });

const db = require(path.join(RACINE, "services", "db"));
const journal = require(path.join(RACINE, "services", "journalService"));
const engine = require(path.join(RACINE, "engines", "automationEngine"));

let verifs = 0;
const echecs = [];
const verifier = (condition, message) => {
    verifs++;
    if (!condition) echecs.push(message);
};

const QG_A = "qg-journal-essai-a";
const QG_B = "qg-journal-essai-b";
const BOUTIQUE_A = "essai-journal-a.myshopify.com";
const BOUTIQUE_B = "essai-journal-b.myshopify.com";

// Les neuf déclencheurs dont un appelant existe réellement (mesuré au
// chantier F). Les cinq autres — shop.connected, shop.uninstalled,
// order.delivered, order.confirmed, stock.empty — sont écrits correctement
// dans la table mais AUCUN code ne les déclenche aujourd'hui. Les faire
// tourner ici prétendrait couvrir un chemin qui n'existe pas.
const VIVANTS = [
    ["order.created",        { id: "CMD-1", total_price: "1500" }],
    ["order.updated",        { id: "CMD-1" }],
    ["order.paid",           { id: "CMD-1", total_price: "1500" }],
    ["order.fulfilled",      { id: "CMD-1" }],
    ["order.cancelled",      { orderId: "CMD-1" }],
    ["stock.low",            { product: "Chemise bleue" }],
    ["carte.activated",      { table: "Commandes" }],
    ["abonnement.upgraded",  { plan: "pro" }],
    ["abonnement.cancelled", {}],
];

// ══════════════════════════════════════════════════════════════════════════
// LE NETTOYAGE — ÉCRIT TROIS FOIS, ET LES DEUX PREMIÈRES ÉTAIENT FAUSSES
// ══════════════════════════════════════════════════════════════════════════
//
// 1. `DELETE ... WHERE workspace_id IN (A, B)` laissait la ligne du test C —
//    celle de la boutique inconnue, dont tout l'intérêt est d'avoir
//    `workspace_id = NULL`. À la deuxième exécution le test en trouvait deux.
//
// 2. On a ajouté des `details LIKE '%CMD-1%'`… et le mutation testing a
//    trouvé le trou : en mutant le code pour qu'il écrive le domaine
//    Shopify, trois lignes (« Carte activée », « Abonnement passé à »,
//    « Abonnement annulé ») ne portaient aucun de ces motifs. Elles
//    survivaient, et la campagne suivante criait sur du code juste.
//
// Deux fois, la même erreur : deviner la forme de ce qu'on a écrit. On ne
// devine plus. On note le dernier identifiant AVANT d'écrire, et on efface
// tout ce qui est venu après. C'est exact par construction, quoi qu'écrive
// le code — y compris du code muté.
let depart = 0;

async function nettoyer() {
    if (depart) await db.query(`DELETE FROM journal WHERE id > $1`, [depart]);
    await db.query(`DELETE FROM workspaces WHERE id IN ($1,$2)`, [QG_A, QG_B]);
}

// Le balayage d'entrée, lui, ne peut pas s'appuyer sur `depart` : il sert
// justement à ramasser ce qu'une exécution interrompue — ou une campagne de
// mutation — aurait laissé.
//
// ⚠️ TROISIÈME ÉCRITURE. Les deux premières ÉNUMÉRAIENT les identifiants
// attendus : d'abord les deux QG, puis les deux domaines. Le mutation testing
// a trouvé les deux trous, l'un après l'autre — et le second était le
// cinquième identifiant, « boutique-qui-nexiste-pas », que le test utilise
// exprès pour vérifier qu'on n'invente pas de QG.
//
// Énumérer ce qu'on croit avoir écrit, c'est la même erreur que le défaut
// qu'on répare ici. On balaie donc sur ce qu'on sait vraiment : les ACTIONS
// que ce test écrit. Elles sont déclarées une fois, dans `VIVANTS`, et il n'y
// a plus rien à oublier.
async function balayerLesRestes() {
    await db.query(`DELETE FROM journal WHERE action = ANY($1)`, [VIVANTS.map(([t]) => t)]);
    await db.query(`DELETE FROM workspaces WHERE id IN ($1,$2)`, [QG_A, QG_B]);
}

(async () => {
    // Le schéma de la base d'essai, appliqué comme en vrai.
    await require(path.join(RACINE, "services", "schema")).preparer();
    await balayerLesRestes();
    depart = (await db.query(`SELECT COALESCE(MAX(id), 0)::int AS n FROM journal`))[0].n;

    for (const [id, boutique] of [[QG_A, BOUTIQUE_A], [QG_B, BOUTIQUE_B]]) {
        await db.query(
            `INSERT INTO workspaces (id, nom, owner_email, owner, metier, statut, shopify_shop_url)
             VALUES ($1,$2,$3,$3,'ecommerce','actif',$4)`,
            [id, "Essai " + id, id + "@example.test", boutique]
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // A. LES NEUF DÉCLENCHEURS VIVANTS, PAR LE VRAI RUNNER
    // ══════════════════════════════════════════════════════════════════════
    for (const [trigger, payload] of VIVANTS) {
        await engine.run(trigger, { shop: BOUTIQUE_A, payload });
    }

    // ⚠️ TOUTES LES LECTURES SONT BORNÉES À `id > depart`.
    //
    // Sans ça, une assertion compte aussi ce que la table contenait AVANT.
    // Trouvé en mutation testing : la campagne qui renomme une action laisse
    // des lignes « commande.payee » que le balayage — qui vise les actions
    // connues — ne peut pas prévoir. Le test suivant les comptait et criait
    // sur du code juste.
    //
    // `depart` est le dernier identifiant avant la première écriture : tout
    // ce qui est au-dessus vient de CETTE exécution, quoi qu'ait écrit le
    // code, même muté.
    const lignesA = await db.query(
        `SELECT action, details, workspace_id FROM journal WHERE workspace_id = $1 AND id > $2 ORDER BY id`,
        [QG_A, depart]
    );

    for (const [trigger] of VIVANTS) {
        const ligne = lignesA.find((l) => l.action === trigger);
        verifier(
            !!ligne,
            `« ${trigger} » n'a écrit AUCUNE ligne rattachée à ${QG_A} — c'est exactement le défaut du chantier F`
        );
        if (ligne) {
            verifier(
                !!String(ligne.details || "").trim(),
                `« ${trigger} » a écrit une ligne SANS détails — l'appel positionnel écrivait des détails vides`
            );
            verifier(
                ligne.workspace_id === QG_A,
                `« ${trigger} » est rattaché à ${JSON.stringify(ligne.workspace_id)} au lieu de ${QG_A}`
            );
        }
    }

    // Et surtout : PAS le domaine Shopify. C'est le second défaut, celui qui
    // survit à une correction de forme.
    const avecDomaine = await db.query(
        `SELECT COUNT(*)::int AS n FROM journal WHERE workspace_id = $1 AND id > $2`, [BOUTIQUE_A, depart]
    );
    verifier(
        avecDomaine[0].n === 0,
        `${avecDomaine[0].n} ligne(s) écrites avec le domaine Shopify comme workspace_id — aucune page filtrant par QG ne les trouverait`
    );

    // ══════════════════════════════════════════════════════════════════════
    // B. UN APPEL POSITIONNEL N'AJOUTE AUCUNE LIGNE — COMPTÉ EN BASE
    // ══════════════════════════════════════════════════════════════════════
    {
        const avant = (await db.query(`SELECT COUNT(*)::int AS n FROM journal`))[0].n;
        const erreurVraie = console.error;
        console.error = () => {};
        await journal.log(QG_A, "✅ Boutique connectée");     // la forme exacte d'avant
        await journal.log(QG_A);
        console.error = erreurVraie;
        const apres = (await db.query(`SELECT COUNT(*)::int AS n FROM journal`))[0].n;
        verifier(
            apres === avant,
            `un appel positionnel a ajouté ${apres - avant} ligne(s) en base — la garde ne tient pas contre un vrai Postgres`
        );

        // Et aucune ligne vide nulle part, ce qui est la forme que prenait
        // le défaut : elle existait, sans action et sans QG.
        const vides = (await db.query(`SELECT COUNT(*)::int AS n FROM journal WHERE action IS NULL AND id > $1`, [depart]))[0].n;
        verifier(vides === 0, `${vides} ligne(s) de journal sans action en base`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // C. UNE BOUTIQUE INCONNUE N'INVENTE PAS DE QG
    // ══════════════════════════════════════════════════════════════════════
    {
        await engine.run("order.paid", { shop: "boutique-qui-nexiste-pas.myshopify.com", payload: { id: "CMD-X" } });
        const orphelines = await db.query(
            `SELECT workspace_id FROM journal WHERE action = 'order.paid' AND details LIKE '%CMD-X%' AND id > $1`,
            [depart]
        );
        verifier(orphelines.length === 1, `la ligne d'une boutique inconnue n'a pas été écrite (${orphelines.length})`);
        verifier(
            orphelines[0]?.workspace_id === null,
            `une boutique inconnue a été rattachée à ${JSON.stringify(orphelines[0]?.workspace_id)} — un faux QG se lit comme un vrai`
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // D. AUCUNE FUITE ENTRE MARCHANDS
    // ══════════════════════════════════════════════════════════════════════
    //
    // Relu EXACTEMENT comme le fera le Centre d'activité : un filtre sur le
    // QG de la session, et rien d'autre.
    {
        await engine.run("order.paid", { shop: BOUTIQUE_B, payload: { id: "CMD-B-1", total_price: "900" } });

        const chezA = await db.query(`SELECT action, details FROM journal WHERE workspace_id = $1 AND id > $2`, [QG_A, depart]);
        const chezB = await db.query(`SELECT action, details FROM journal WHERE workspace_id = $1 AND id > $2`, [QG_B, depart]);

        verifier(chezB.length === 1, `le marchand B devrait avoir exactement 1 ligne, il en a ${chezB.length}`);
        verifier(
            chezA.every((l) => !String(l.details || "").includes("CMD-B-1")),
            "un événement du marchand B apparaît chez le marchand A"
        );
        verifier(
            chezB.every((l) => !String(l.details || "").includes("CMD-1")),
            "un événement du marchand A apparaît chez le marchand B"
        );
    }

    await nettoyer();

    if (echecs.length) {
        console.error(`❌ journal réel : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ journal réel : ${verifs} vérifications passées (${VIVANTS.length} déclencheurs vivants, vraie base)`);
    process.exit(0);
})().catch((err) => {
    console.error("❌ journal réel : la suite a levé —", err.message);
    process.exit(1);
});
