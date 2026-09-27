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
//   E. Les deux gestes Telegram — confirmation et annulation — rattachent leur
//      ligne au QG DE LA COMMANDE, et cette ligne se voit dans le Centre
//      d'activité du bon marchand, jamais dans celui de l'autre.
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
const commerce = require(path.join(RACINE, "engines", "commerceEngine"));
const activite = require(path.join(RACINE, "services", "activite"));

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

// Les deux gestes Telegram ne passent PAS par `automationEngine.run()` : ils
// sont appelés par `brain/orchestrator.js` (depuis `routes/telegram.js`) et par
// `brain/planner.js` (l'outil du Chat). Ils écrivent donc leurs propres
// actions, avec leur propre chemin de résolution du QG.
const TELEGRAM = ["order.confirmed.telegram", "order.cancelled.telegram"];

// Tout ce que cette suite écrit dans `journal`, déclaré UNE fois. Le balayage
// d'entrée s'appuie dessus (voir la note sur la troisième écriture, plus bas) :
// énumérer à la main ce qu'on croit avoir écrit est l'erreur exacte qu'on a
// déjà commise deux fois ici.
const ACTIONS_ECRITES = [...VIVANTS.map(([t]) => t), ...TELEGRAM];

// Les commandes d'essai du test E. Elles portent une clé étrangère vers
// `workspaces` : elles doivent partir AVANT les QG, sinon le DELETE des QG
// échoue et la suite laisse sa vaisselle.
const COMMANDES = ["CMD-TG-A", "CMD-TG-B", "CMD-TG-FANTOME"];

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
    await db.query(`DELETE FROM commandes WHERE id = ANY($1)`, [COMMANDES]);
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
    await db.query(`DELETE FROM journal WHERE action = ANY($1)`, [ACTIONS_ECRITES]);
    await db.query(`DELETE FROM commandes WHERE id = ANY($1)`, [COMMANDES]);
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

    // ══════════════════════════════════════════════════════════════════════
    // E. LES DEUX GESTES TELEGRAM — LE QG VIENT DE LA COMMANDE
    // ══════════════════════════════════════════════════════════════════════
    //
    // Le défaut : `confirmTelegramOrder` et `cancelTelegramOrder` écrivaient
    // leur ligne SANS `workspaceId`. Elle partait avec `workspace_id = NULL`
    // et n'apparaissait dans AUCUN Centre d'activité — le marchand confirmait
    // depuis Telegram, et sa page restait muette.
    //
    // Pourquoi ces deux-là ne pouvaient pas être réparés comme les autres :
    // sur ce chemin, l'événement n'a PAS de boutique. `routes/telegram.js`
    // passe `shop: ""`, et l'outil du Chat (`brain/planner.js`) ne passe qu'un
    // `payload`. Il n'y a donc rien à résoudre par le domaine Shopify — la
    // seule source vraie est la ligne de commande elle-même.
    {
        for (const [id, qg, produit] of [[COMMANDES[0], QG_A, "Chemise bleue"],
                                         [COMMANDES[1], QG_B, "Sac en cuir"]]) {
            await db.query(
                `INSERT INTO commandes (id, workspace_id, nom_client, produit, montant, statut, source)
                 VALUES ($1,$2,'Client essai',$3,1500,'en attente','telegram')`,
                [id, qg, produit]
            );
        }

        const rConfirm = await commerce.confirmTelegramOrder({ payload: { orderId: COMMANDES[0] } });
        const rAnnule  = await commerce.cancelTelegramOrder({ payload: { orderId: COMMANDES[1] } });

        // ── E.1 AUCUNE RÉGRESSION DU GESTE LUI-MÊME ────────────────────────
        // La correction ne devait toucher que le rattachement. Si la valeur
        // de retour ou le statut en base changent, c'est le métier qui a
        // bougé — et le Chat comme Telegram s'appuient dessus.
        verifier(rConfirm?.success === true && rConfirm.orderId === COMMANDES[0],
            `confirmTelegramOrder ne rend plus { success: true, orderId } mais ${JSON.stringify(rConfirm)}`);
        verifier(rAnnule?.success === true && rAnnule.orderId === COMMANDES[1],
            `cancelTelegramOrder ne rend plus { success: true, orderId } mais ${JSON.stringify(rAnnule)}`);

        const cmdA = (await db.query(`SELECT statut, confirme_le FROM commandes WHERE id = $1`, [COMMANDES[0]]))[0];
        const cmdB = (await db.query(`SELECT statut FROM commandes WHERE id = $1`, [COMMANDES[1]]))[0];
        verifier(cmdA?.statut === "confirmée", `la commande confirmée est en statut ${JSON.stringify(cmdA?.statut)}`);
        verifier(!!cmdA?.confirme_le, "la confirmation n'a plus posé `confirme_le` — le quota de confirmations le compte");
        verifier(cmdB?.statut === "annulée", `la commande annulée est en statut ${JSON.stringify(cmdB?.statut)}`);

        // ── E.2 LA LIGNE EST RATTACHÉE AU QG DE LA COMMANDE ────────────────
        const traces = await db.query(
            `SELECT action, details, workspace_id, ref_id FROM journal WHERE action = ANY($1) AND id > $2`,
            [TELEGRAM, depart]
        );
        for (const [action, attendu, ref] of [["order.confirmed.telegram", QG_A, COMMANDES[0]],
                                              ["order.cancelled.telegram", QG_B, COMMANDES[1]]]) {
            const ligne = traces.find((l) => l.action === action);
            verifier(!!ligne, `« ${action} » n'a écrit AUCUNE ligne de journal`);
            if (!ligne) continue;
            verifier(ligne.workspace_id === attendu,
                `« ${action} » est rattaché à ${JSON.stringify(ligne.workspace_id)} au lieu de ${attendu} — ` +
                `c'est le défaut : la ligne existe mais aucune page filtrant par QG ne la trouve`);
            verifier(String(ligne.ref_id || "") === ref,
                `« ${action} » a perdu sa référence de commande (${JSON.stringify(ligne.ref_id)})`);
            verifier(!!String(ligne.details || "").trim(), `« ${action} » a écrit une ligne sans détails`);
        }

        // ── E.3 JAMAIS UN DOMAINE SHOPIFY, JAMAIS UN QG INVENTÉ ────────────
        // Le premier réflexe aurait été `getWorkspaceIdForShop(event.shop)`.
        // Ce helper a un repli « shop tel quel » : avec `shop: ""` il aurait
        // rangé la ligne sous la chaîne vide, et avec un domaine il aurait
        // rangé le domaine. Les deux se lisent comme un vrai QG.
        const faux = await db.query(
            `SELECT COUNT(*)::int AS n FROM journal
              WHERE action = ANY($1) AND id > $2
                AND (workspace_id = ANY($3) OR workspace_id = '')`,
            [TELEGRAM, depart, [BOUTIQUE_A, BOUTIQUE_B]]
        );
        verifier(faux[0].n === 0,
            `${faux[0].n} ligne(s) Telegram rattachées à un domaine Shopify ou à une chaîne vide`);

        // Une commande qui n'existe pas : le geste ne doit inventer aucun QG.
        // `NULL` est honnête — une valeur de repli se lirait comme un vrai QG.
        await commerce.confirmTelegramOrder({ payload: { orderId: COMMANDES[2] } });
        const fantome = await db.query(
            `SELECT workspace_id FROM journal
              WHERE action = 'order.confirmed.telegram' AND details LIKE $1 AND id > $2`,
            [`%${COMMANDES[2]}%`, depart]
        );
        verifier(fantome.length === 1, `la ligne d'une commande inconnue n'a pas été écrite (${fantome.length})`);
        verifier(fantome[0]?.workspace_id === null,
            `une commande inconnue a été rattachée à ${JSON.stringify(fantome[0]?.workspace_id)}`);

        // ── E.4 VISIBLE DANS LE CENTRE D'ACTIVITÉ DU BON MARCHAND ──────────
        // Relu par `services/activite.pour()` — exactement ce que la page
        // appelle. C'était toute la question : la ligne existait déjà avant
        // la correction, elle n'était simplement lisible par personne.
        const vueA = await activite.pour({ workspaceId: QG_A, limite: 200 });
        const vueB = await activite.pour({ workspaceId: QG_B, limite: 200 });

        const chercher = (vue, ref) => vue.fil.find((e) => e.refId === ref);
        const chezMoiA = chercher(vueA, COMMANDES[0]);
        const chezMoiB = chercher(vueB, COMMANDES[1]);

        verifier(!!chezMoiA, `la confirmation Telegram n'apparaît pas dans le Centre d'activité de ${QG_A}`);
        verifier(!!chezMoiB, `l'annulation Telegram n'apparaît pas dans le Centre d'activité de ${QG_B}`);

        // Et du bon côté des deux axes : c'est SAMII qui a tenu la
        // conversation Telegram, donc c'est SAMII qui a agi. Sans ça, la
        // ligne s'afficherait comme un geste du marchand.
        verifier(chezMoiA?.acteur === "samii" && chezMoiA?.verbe === "agit",
            `la confirmation Telegram est classée ${chezMoiA?.acteur}/${chezMoiA?.verbe} au lieu de samii/agit`);
        verifier(chezMoiA?.etat === "reussi", `la confirmation Telegram est en état ${chezMoiA?.etat}`);
        verifier(chezMoiB?.acteur === "samii" && chezMoiB?.verbe === "agit",
            `l'annulation Telegram est classée ${chezMoiB?.acteur}/${chezMoiB?.verbe} au lieu de samii/agit`);

        // ── E.5 INVISIBLE POUR L'AUTRE MARCHAND ────────────────────────────
        verifier(!chercher(vueB, COMMANDES[0]),
            `la confirmation du marchand A apparaît dans le Centre d'activité de ${QG_B} — fuite entre marchands`);
        verifier(!chercher(vueA, COMMANDES[1]),
            `l'annulation du marchand B apparaît dans le Centre d'activité de ${QG_A} — fuite entre marchands`);
        verifier(!chercher(vueA, COMMANDES[2]) && !chercher(vueB, COMMANDES[2]),
            "la ligne sans QG apparaît chez un marchand — une ligne orpheline n'appartient à personne");
    }

    await nettoyer();

    if (echecs.length) {
        console.error(`❌ journal réel : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ journal réel : ${verifs} vérifications passées (${VIVANTS.length} déclencheurs vivants + ${TELEGRAM.length} gestes Telegram, vraie base)`);
    process.exit(0);
})().catch((err) => {
    console.error("❌ journal réel : la suite a levé —", err.message);
    process.exit(1);
});
