// ==========================================================================
// SAMII OS — LES TABLES QUI PORTENT DES DONNÉES DE GENS
// ==========================================================================
//
// ── CE QUE RLS PROTÈGE ICI, ET CE QU'IL NE PROTÈGE PAS ────────────────────
//
// Le serveur se connecte avec UN rôle, qui POSSÈDE les tables. Un propriétaire
// contourne Row Level Security par défaut (il faudrait FORCE ROW LEVEL
// SECURITY pour la lui appliquer). Activer RLS ne change donc RIEN pour
// l'application — c'est vérifié plus bas, sur une vraie base.
//
// Ce que ça change, c'est pour TOUT AUTRE rôle : une clé publiable Supabase,
// une chaîne de connexion limitée qui fuiterait, l'API REST du projet.
// Démontré, sur une table de démonstration :
//
//     sans RLS  propriétaire 1 ligne | rôle anonyme 1 ligne  ⚠️ il lit tout
//     avec RLS  propriétaire 1 ligne | rôle anonyme 0 ligne  ✅
//
// Le motif du projet est « RLS activée, AUCUNE politique » : personne d'autre
// que le propriétaire ne voit quoi que ce soit. C'est volontaire et c'est le
// plus sûr — une politique mal écrite ouvre plus qu'elle ne ferme.
//
// ── ET CE QUE « FORCE » FERAIT, MESURÉ AUSSI ──────────────────────────────
//
// Sur un rôle propriétaire ORDINAIRE (ni superutilisateur, ni BYPASSRLS —
// c'est ce qu'est un rôle applicatif chez un hébergeur) :
//
//     RLS activée        lit 1 ligne | écrit  ✅   ← ce que fait ce code
//     RLS FORCÉE         lit 0 ligne | refuse ❌   ← ce qu'on refuse
//
// La lecture ne lève AUCUNE erreur : elle rend zéro. Une page vide, un 200,
// pas une seule trace dans les logs. C'est pour ça qu'un garde ci-dessous ne
// cherche qu'une chaîne de caractères.
//
// ⚠️ ATTENTION À CE QUE CE FICHIER NE PROUVE PAS. Sur un poste de
// développement, le rôle est souvent superutilisateur : il contourne RLS de
// toute façon, FORCE comprise. Les vérifications « le serveur lit encore »
// passent alors sans rien démontrer. C'est pourquoi on vérifie séparément la
// PROPRIÉTÉ des tables : c'est elle, et non un privilège de superutilisateur,
// qui garantit que ça tiendra en production.
//
// ── POURQUOI CES SIX-LÀ ───────────────────────────────────────────────────
//
// Treize tables étaient déjà verrouillées. Six autres portaient des données
// de personnes et ne l'étaient pas : clients, commandes, discussion_messages,
// messages_prives, paiements, workspaces. L'incohérence ressemblait à une
// liste qu'on n'a jamais fini d'écrire, pas à un choix.
// ==========================================================================
const path = require("path");
const fs = require("fs");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const SENSIBLES = ["clients", "commandes", "discussion_messages", "messages_prives", "paiements", "workspaces"];

const srcBrut = fs.readFileSync(path.join(RACINE, "services/schema.js"), "utf8");
// On retire les commentaires : le fichier EXPLIQUE pourquoi il ne faut pas
// écrire « FORCE ROW LEVEL SECURITY », et cette explication faisait crier le
// garde qui cherche cette chaîne. Il doit lire le CODE, pas la prose.
const src = srcBrut.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const bloc = (src.match(/const A_VERROUILLER\s*=\s*\[([\s\S]*?)\]/) || [])[1] || "";
const declarees = [...bloc.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

// ── 1. LES SIX SONT DÉCLARÉES ────────────────────────────────────────────
for (const t of SENSIBLES) {
    verifier(declarees.includes(t),
        `« ${t} » n'est pas dans A_VERROUILLER : elle porte des données de personnes et reste ` +
        "lisible par tout rôle qui atteint la base autrement que par le serveur");
}

// ── 2. LES TREIZE D'ORIGINE N'ONT PAS ÉTÉ PERDUES ────────────────────────
//
// Une liste qu'on complète est aussi une liste qu'on peut amputer par
// distraction. On fige celles qui y étaient.
const DEJA = ["apps", "app_installations", "api_cles", "webhooks_sortants", "api_journal",
    "academie_acceptations", "academie_transactions", "portefeuille_mouvements",
    "portefeuille_retraits", "besoins", "besoin_reponses",
    "tendances_video_cache", "tendances_video_sources"];
for (const t of DEJA) {
    verifier(declarees.includes(t),
        `« ${t} » a disparu de A_VERROUILLER : une table déjà protégée redeviendrait lisible`);
}

verifier(new Set(declarees).size === declarees.length,
    `A_VERROUILLER contient un doublon (${declarees.length} entrées pour ${new Set(declarees).size} noms)`);

// ── 3. L'INSTRUCTION EST TOUJOURS EXÉCUTÉE ───────────────────────────────
//
// Une liste juste et une boucle supprimée, et tout est vert pour rien.
verifier(/for \(const table of A_VERROUILLER\)/.test(src) &&
    /ALTER TABLE public\.\$\{table\} ENABLE ROW LEVEL SECURITY/.test(src),
    "la boucle qui applique RLS a disparu de services/schema.js : la liste ne serait plus qu'une " +
    "déclaration d'intention");

// ── 4. ON NE FORCE PAS RLS AU PROPRIÉTAIRE ───────────────────────────────
//
// FORCE ROW LEVEL SECURITY appliquerait RLS AU SERVEUR LUI-MÊME. Sans aucune
// politique, l'application ne verrait plus une seule ligne : elle répondrait
// 200 partout et n'afficherait rien. C'est la panne la plus silencieuse
// possible, et c'est à une lettre près de ce qu'on écrit ici.
verifier(!/FORCE ROW LEVEL SECURITY/i.test(src),
    "services/schema.js force RLS au propriétaire : le serveur ne verrait plus aucune ligne, " +
    "sans la moindre erreur");

// ── 5. AUCUNE POLITIQUE N'EST CRÉÉE, ET C'EST VOULU ──────────────────────
verifier(!/CREATE POLICY/i.test(src),
    "une politique RLS est créée dans services/schema.js : le motif du projet est " +
    "« aucune politique », donc aucun accès pour personne d'autre que le propriétaire. " +
    "Une politique mal écrite ouvre plus qu'elle ne ferme");

// ── 6. ET CONTRE UNE VRAIE BASE, SI ON EN A UNE ──────────────────────────
//
// Le reste ne se prouve pas en lisant du texte : il faut voir le serveur lire
// ses tables, et un autre rôle ne rien voir du tout.
(async () => {
    const URL = process.env.PGTEST_URL;
    if (!URL) {
        console.log("⏭️  Aucune PGTEST_URL — vérification RLS sur vraie base ignorée (normal hors développement).");
        return;
    }
    // Garde-fou, le même que credits-reel, missions-longues et portefeuille :
    // cette suite appelle schema.preparer() (elle CRÉE des tables) et écrit
    // dans « workspaces ». Elle ne doit pouvoir viser qu'une base d'essai,
    // même si quelqu'un colle la mauvaise URL dans son terminal.
    if (!/localhost|127\.0\.0\.1|host=\//.test(URL) || !/test/i.test(URL)) {
        console.error("❌ PGTEST_URL doit être une base LOCALE dont le nom contient « test ». Suite refusée.");
        process.exit(1);
    }
    process.env.DATABASE_URL = URL;
    const db = require(path.join(RACINE, "services/db.js"));
    const schema = require(path.join(RACINE, "services/schema.js"));

    await schema.preparer();

    const etat = await db.query(
        `SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forcee
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1)`,
        [SENSIBLES]
    );
    for (const t of SENSIBLES) {
        const ligne = etat.find((r) => r.relname === t);
        verifier(ligne && ligne.rls === true,
            `sur une vraie base, « ${t} » n'a pas RLS activée après le démarrage`);
        verifier(!ligne || ligne.forcee === false,
            `« ${t} » a RLS FORCÉE : le serveur lui-même ne verrait plus ses lignes`);
    }

    // ── CE QUI FAIT VRAIMENT TENIR LE MONTAGE : LA PROPRIÉTÉ ─────────────
    //
    // Tout repose sur une seule chose : le rôle du serveur POSSÈDE ces
    // tables. Un propriétaire contourne RLS sans politique ; un rôle qui ne
    // possède pas voit zéro ligne, sans la moindre erreur.
    //
    // Le jour où l'application se connecterait avec un autre rôle — un rôle
    // applicatif restreint, une migration d'hébergeur, un utilisateur créé à
    // la main — le QG afficherait des pages vides et rien ne le dirait.
    // C'est la seule façon dont ce chantier peut casser le produit, donc
    // c'est ce qu'on vérifie.
    const roleInfos = await db.query(
        `SELECT r.rolsuper, r.rolbypassrls,
                (SELECT count(*) FROM pg_class c
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relname = ANY($1)
                    AND pg_get_userbyid(c.relowner) = current_user) AS possedees
           FROM pg_roles r WHERE r.rolname = current_user`,
        [SENSIBLES]
    );
    const role = roleInfos[0] || {};
    verifier(Number(role.possedees) === SENSIBLES.length || role.rolsuper === true || role.rolbypassrls === true,
        `le rôle du serveur ne possède que ${role.possedees}/${SENSIBLES.length} de ces tables et n'a ni ` +
        "superutilisateur ni BYPASSRLS : avec RLS activée et aucune politique, il ne verrait plus une " +
        "seule ligne — et sans aucune erreur, juste des pages vides");
    if (role.rolsuper === true) {
        console.log("ℹ️  Le rôle de test est superutilisateur : il contourne RLS de toute façon. " +
            "Les lectures ci-dessous ne prouvent donc rien à elles seules — c'est la vérification " +
            "de propriété juste au-dessus qui porte la démonstration.");
    }

    // Le serveur continue de lire et d'écrire. C'est LA question qui compte :
    // une protection qui casse le produit n'est pas une protection.
    for (const t of SENSIBLES) {
        let ok = true;
        try { await db.query(`SELECT count(*) FROM ${t}`); } catch { ok = false; }
        verifier(ok, `le serveur ne peut plus lire « ${t} » après l'activation de RLS`);
    }
    let ecritureOk = true;
    try {
        // `nom` et `owner_email` sont NOT NULL : un INSERT incomplet échouerait
        // sur une contrainte de schéma et se ferait passer pour un blocage RLS.
        await db.query(
            `INSERT INTO workspaces (id, nom, owner_email) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            ["rls-test-ws", "QG de contrôle RLS", "rls-test@exemple.local"]
        );
        await db.query(`DELETE FROM workspaces WHERE id = 'rls-test-ws'`);
    } catch { ecritureOk = false; }
    verifier(ecritureOk, "le serveur ne peut plus écrire dans « workspaces » après l'activation de RLS");
})().then(() => {
    if (echecs.length) {
        console.log(`\n❌ RLS : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.log(`   • ${e}`);
        console.log("");
        process.exit(1);
    }
    console.log(`✅ RLS : ${verifs} vérifications passées`);
}).catch((err) => {
    console.log(`\n❌ RLS : la suite n'a pas pu s'exécuter — ${err.message}\n`);
    process.exit(1);
});
