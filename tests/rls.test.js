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

// ══════════════════════════════════════════════════════════════════════════
// CE QUI NE PEUT PAS SORTIR DE LA LISTE, ET QUI N'ÉTAIT GARDÉ PAR RIEN
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ TROUVÉ PAR MUTATION, APRÈS AVOIR AJOUTÉ QUINZE TABLES À `A_VERROUILLER`.
//
// Retirer `recharges_samii` de la liste — l'argent qui entre — laissait cette
// suite ENTIÈREMENT VERTE. Idem pour `whatsapp_contacts`, qui porte des
// numéros de téléphone. `SENSIBLES` ci-dessus ne contient que les six tables
// du chantier précédent : tout ce qu'on ajoute après n'est gardé par personne.
//
// Une liste de protections qu'aucun test ne surveille se vide par petits
// bouts, à chaque refactoring, et personne ne le voit avant une fuite.
//
// ── POURQUOI DEUX LISTES, ET PAS UNE SEULE PLUS LONGUE ───────────────────
//
// `SENSIBLES` sert aussi aux mesures sur vraie base (propriété, lecture,
// écriture) : y verser trente tables rendrait la suite lente sans rien
// prouver de plus. Celle-ci ne répond qu'à une question — « cette table
// a-t-elle le droit de quitter A_VERROUILLER ? » — et la réponse est non.
//
// Chaque entrée dit CE QU'ELLE PORTE. Une table nommée sans motif est une
// table que le prochain lecteur retirera en croyant faire du ménage.
const JAMAIS_OUVERTES = {
    // ── L'ARGENT ────────────────────────────────────────────────────────
    portefeuille_mouvements: "le grand livre : tous les soldes de tout le monde",
    portefeuille_retraits: "les demandes de retrait et leur destination",
    recharges_samii: "user_id, checkout_id, montant_usd, montant_paye, taux appliqué",
    paiements: "les encaissements",
    academie_transactions: "les ventes de l'Academy et leurs commissions",
    // ── NOS COMPTES ─────────────────────────────────────────────────────
    consommation_ia: "cout_google_usd, cout_technique_usd : notre structure de coûts",
    // ── LES DONNÉES DE PERSONNES ────────────────────────────────────────
    prospects_vitrine: "email, telephone, message, ip d'un visiteur",
    whatsapp_contacts: "numero, nom_client",
    clients: "les clients d'un marchand",
    commandes: "ce que les gens ont commandé, et où",
    messages_prives: "des conversations à deux",
    discussion_messages: "les messages des salons",
    // ── LES SECRETS ─────────────────────────────────────────────────────
    api_cles: "les clés des partenaires",
    webhooks_sortants: "les secrets de signature HMAC",
    tendances_video_sources: "des clés d'API tierces",
};

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

// ── 1 bis. ET AUCUNE DES QUINZE NE PEUT QUITTER LA LISTE ─────────────────
//
// Le motif de chaque table est dans le message : un échec ne dit pas « une
// entrée manque », il dit CE QUI redevient lisible.
for (const [t, porte] of Object.entries(JAMAIS_OUVERTES)) {
    verifier(declarees.includes(t),
        `« ${t} » est sortie de A_VERROUILLER — elle porte ${porte}. ` +
        "Sans RLS, tout rôle qui atteint la base autrement que par le serveur la lit " +
        "et l'écrit : c'est exactement ce qui a été mesuré en production le 2026-09-27, " +
        "où la clé publiable lisait 3 recharges, 10 lignes de coûts et 3302 traces d'agents");
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

// ── 2 bis. LES SIX QUI EXISTENT SANS ÊTRE CRÉÉES ICI ─────────────────────
//
// Elles ont RLS actif en production et `schema.js` ne les fabrique pas : leur
// protection tenait à un script lancé à la main, donc à rien sur une base
// recréée. Elles vivent dans une liste à part, verrouillée SI PRÉSENTE.
//
// ⚠️ Et elles ne doivent PAS être dans `A_VERROUILLER` : `schema-neuf` refuse
// — à raison — d'y voir une table que le démarrage ne crée pas.
const blocSi = (src.match(/const A_VERROUILLER_SI_PRESENTE\s*=\s*\[([\s\S]*?)\]/) || [])[1] || "";
const conditionnelles = [...blocSi.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
const NON_CREEES = ["cartes_achats", "push_subscriptions", "livraisons", "livreurs",
    "stories", "stories_vues"];
for (const t of NON_CREEES) {
    verifier(conditionnelles.includes(t),
        `« ${t} » a quitté A_VERROUILLER_SI_PRESENTE. Elle existe en production avec RLS ` +
        "actif, et ce fichier ne la crée pas : sans cette entrée, sa protection ne repose " +
        "plus que sur un script lancé à la main un jour, et disparaît sur une base recréée");
    verifier(!declarees.includes(t),
        `« ${t} » est passée dans A_VERROUILLER alors que le démarrage ne la crée pas : ` +
        "la liste aurait l'air complète en ne protégeant rien (c'est le refus de schema-neuf)");
}
verifier(new Set(conditionnelles).size === conditionnelles.length,
    "A_VERROUILLER_SI_PRESENTE contient un doublon");

// ── 3. L'INSTRUCTION EST TOUJOURS EXÉCUTÉE, SUR LES DEUX LISTES ──────────
//
// Une liste juste et une boucle supprimée, et tout est vert pour rien. Et une
// deuxième liste qu'on déclare sans la brancher ne protège rien non plus.
verifier(/for \(const table of \[\.\.\.A_VERROUILLER, \.\.\.siPresentes\]\)/.test(src) &&
    /relname = ANY\(\$1\)[\s\S]{0,120}\[A_VERROUILLER_SI_PRESENTE\]/.test(src) &&
    /ALTER TABLE public\.\$\{table\} ENABLE ROW LEVEL SECURITY/.test(src),
    "la boucle qui applique RLS a disparu de services/schema.js, ou elle ne parcourt plus les " +
    "deux listes : l'une d'elles ne serait qu'une déclaration d'intention");

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

    // ── ET LES TRENTE-QUATRE, PAS SEULEMENT LES SIX ──────────────────────
    //
    // ⚠️ MUTATION MUETTE : poser FORCE sur une table verrouillée ne faisait
    // crier personne dès qu'elle n'était pas dans `SENSIBLES`. Or FORCE est la
    // panne la plus silencieuse du projet — le serveur lit zéro ligne, répond
    // 200, et rien n'apparaît dans les logs.
    //
    // La liste déclarée est lue depuis `schema.js` : on vérifie donc CE QUI
    // EST DÉCLARÉ, pas une copie. Une table ajoutée demain est couverte sans
    // que personne y pense.
    const toutes = await db.query(
        `SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forcee
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1)`,
        [declarees]
    );
    verifier(toutes.length === declarees.length,
        `${declarees.length - toutes.length} table(s) de A_VERROUILLER n'existent pas après le ` +
        "démarrage : la protection ne s'appliquerait jamais");
    for (const ligne of toutes) {
        verifier(ligne.rls === true,
            `« ${ligne.relname} » est déclarée dans A_VERROUILLER et n'a PAS RLS après le démarrage`);
        verifier(ligne.forcee === false,
            `« ${ligne.relname} » a RLS FORCÉE : le serveur ne verrait plus une seule de ses ` +
            "lignes, et il répondrait 200 sans une erreur");
    }

    // ── LE VERROU CONDITIONNEL FERME-T-IL VRAIMENT ? ─────────────────────
    //
    // `A_VERROUILLER_SI_PRESENTE` promet : « si elle est là, elle est
    // verrouillée ». Lire la liste ne le prouve pas. On fabrique donc la
    // table que le démarrage ne crée pas, on relance le démarrage, et on
    // regarde ce que la base dit.
    //
    // `cartes_achats` est prise comme témoin parce que c'est celle que le
    // propriétaire a nommée : elle porte `workspace_id` et un identifiant de
    // paiement Chargily.
    await db.query(`DROP TABLE IF EXISTS cartes_achats`);
    await db.query(`CREATE TABLE cartes_achats (id serial PRIMARY KEY, workspace_id text)`);
    const avantVerrou = await db.query(
        `SELECT relrowsecurity AS rls FROM pg_class
         WHERE relnamespace = 'public'::regnamespace AND relname = 'cartes_achats'`);
    verifier(avantVerrou[0]?.rls === false,
        "montage : la table témoin devait naître SANS RLS, sinon le verrou n'a rien à fermer");

    await schema.preparer();

    const apresVerrou = await db.query(
        `SELECT relrowsecurity AS rls, relforcerowsecurity AS forcee FROM pg_class
         WHERE relnamespace = 'public'::regnamespace AND relname = 'cartes_achats'`);
    verifier(apresVerrou[0]?.rls === true,
        "« cartes_achats » existe et le démarrage ne l'a PAS verrouillée : la liste conditionnelle " +
        "est déclarée mais n'agit pas. Sa protection en production ne serait toujours qu'un geste " +
        "manuel, perdu à la première base recréée");
    verifier(apresVerrou[0]?.forcee === false,
        "« cartes_achats » a RLS FORCÉE après le démarrage : le serveur ne verrait plus une seule " +
        "carte achetée, et il répondrait 200 sans une erreur");

    // Et le serveur, lui, écrit et relit — RLS sans politique ne l'empêche de
    // rien, parce qu'il possède la table.
    await db.query(`INSERT INTO cartes_achats (workspace_id) VALUES ('temoin-rls')`);
    const luParLeServeur = await db.query(
        `SELECT count(*)::int AS n FROM cartes_achats WHERE workspace_id = 'temoin-rls'`);
    verifier(luParLeServeur[0]?.n === 1,
        "le serveur ne relit pas ce qu'il vient d'écrire dans une table verrouillée : la posture " +
        "« RLS sans politique » ne tient plus");

    await db.query(`DROP TABLE IF EXISTS cartes_achats`);

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

    // ══════════════════════════════════════════════════════════════════════
    // 7. ET UN AUTRE RÔLE NE VOIT RIEN — MESURÉ, PLUS SUPPOSÉ
    // ══════════════════════════════════════════════════════════════════════
    //
    // ⚠️ C'ÉTAIT LA MOITIÉ MANQUANTE, ET L'EN-TÊTE DE CE FICHIER LA PROMETTAIT.
    //
    // Il est écrit plus haut : « il faut voir le serveur lire ses tables, ET UN
    // AUTRE RÔLE NE RIEN VOIR DU TOUT ». Le code ne faisait que la première
    // moitié. Pour la seconde, il vérifiait la PROPRIÉTÉ des tables — un bon
    // indice, mais un indice : il dit que le montage DEVRAIT tenir, pas qu'il
    // tient. La démonstration « sur une table de démonstration » citée en tête
    // avait été faite à la main, une fois, et n'était pas rejouée.
    //
    // Ça compte parce que le chantier J vient d'ajouter quinze tables à cette
    // liste — dont l'argent qui entre (`recharges_samii`), notre structure de
    // coûts (`consommation_ia`) et des numéros de téléphone
    // (`whatsapp_contacts`) — après avoir constaté en PRODUCTION qu'un rôle
    // non propriétaire y lisait tout.
    //
    // ── LE TÉMOIN EST OBLIGATOIRE ─────────────────────────────────────────
    //
    // « Le rôle ne voit aucune ligne » ne prouve rien si la table est vide.
    // On crée donc DEUX tables : une verrouillée, une ouverte, chacune avec
    // une ligne. Le rôle doit voir 1 dans l'ouverte et 0 dans la verrouillée.
    // Sans ce témoin, un zéro sur un montage cassé se lirait comme un succès.
    {
        const nom = `rls_temoin_${process.pid}`;
        let monte = false;
        try {
            await db.query(`CREATE TABLE IF NOT EXISTS ${nom}_fermee (id int)`);
            await db.query(`CREATE TABLE IF NOT EXISTS ${nom}_ouverte (id int)`);
            await db.query(`INSERT INTO ${nom}_fermee VALUES (1)`);
            await db.query(`INSERT INTO ${nom}_ouverte VALUES (1)`);
            await db.query(`ALTER TABLE ${nom}_fermee ENABLE ROW LEVEL SECURITY`);
            // Le rôle : sans connexion possible, sans héritage de droits. Il
            // n'existe que le temps de cette mesure.
            await db.query(`DROP ROLE IF EXISTS ${nom}`);
            await db.query(`CREATE ROLE ${nom} NOLOGIN NOINHERIT`);
            await db.query(`GRANT SELECT, INSERT ON ${nom}_fermee, ${nom}_ouverte TO ${nom}`);
            monte = true;

            // ⚠️ `db.transaction()` ET SURTOUT PAS `db.query()`, ET C'EST TOUT
            // CE QUI REND CETTE MESURE VALABLE.
            //
            // `db.query` passe par un POOL : deux appels consécutifs peuvent
            // tomber sur deux connexions différentes. Un `SET LOCAL ROLE` sur
            // l'une et un `SELECT` sur l'autre, et le SELECT s'exécute en
            // propriétaire — il lit tout, et le test conclut à une fuite qui
            // n'existe pas. Ou l'inverse, plus grave : il conclut à une
            // fermeture parce que le rôle n'a jamais été posé.
            //
            // Première version de ce bloc : elle enchaînait des `db.query`.
            // Ça a « marché » — par chance, le pool servant le même client
            // pour des appels séquentiels. Un test de sécurité qui tient par
            // chance ne tient pas.
            //
            // `db.transaction()` épingle UN client du début à la fin. C'est
            // exactement ce pour quoi cette fonction existe dans ce projet.
            const vu = await db.transaction(async (q) => {
                await q(`SET LOCAL ROLE ${nom}`);
                // On relit le rôle effectif : si le SET n'avait pas pris, la
                // mesure entière serait fausse et rien ne le dirait.
                const [{ role_effectif }] = await q(`SELECT current_user AS role_effectif`);
                const [compte] = await q(
                    `SELECT (SELECT count(*)::int FROM ${nom}_ouverte) AS ouverte,
                            (SELECT count(*)::int FROM ${nom}_fermee)  AS fermee`
                );
                return { ...compte, role_effectif };
            });

            verifier(vu.role_effectif === nom,
                `la mesure a tourné sous « ${vu.role_effectif} » et non sous « ${nom} » : ` +
                "le changement de rôle n'a pas pris, et tout ce qui suit est faux");
            const o = Number(vu.ouverte);
            const f = Number(vu.fermee);
            // LE TÉMOIN D'ABORD : si l'ouverte rend zéro, la mesure ne mesure rien.
            verifier(o === 1,
                `le témoin est muet : un rôle non propriétaire lit ${o} ligne(s) dans une table ` +
                "SANS RLS alors qu'elle en contient une — le zéro de la table verrouillée ne " +
                "prouverait donc rien");
            verifier(f === 0,
                `un rôle non propriétaire lit ${f} ligne(s) dans une table AVEC RLS et sans ` +
                "politique : le montage de tout ce fichier ne tient pas, et les 34 tables " +
                "déclarées ne protègent rien");

            // Et il ne doit pas pouvoir ÉCRIRE : c'est ce qui empêche qu'on
            // fabrique une recharge ou un contact depuis la clé publiable.
            // Même exigence : UN client, du SET LOCAL ROLE à l'INSERT.
            let ecritureRefusee = false;
            try {
                await db.transaction(async (q) => {
                    await q(`SET LOCAL ROLE ${nom}`);
                    await q(`INSERT INTO ${nom}_fermee VALUES (2)`);
                });
            } catch { ecritureRefusee = true; }
            verifier(ecritureRefusee,
                "un rôle non propriétaire peut ÉCRIRE dans une table avec RLS et sans politique : " +
                "n'importe qui pourrait fabriquer une ligne d'argent");
        } catch (err) {
            // Un rôle qui ne peut pas être créé (droits insuffisants sur ce
            // poste) rend la mesure impossible. On le DIT au lieu de laisser
            // croire que la vérification a eu lieu.
            verifier(false,
                `la mesure « un autre rôle ne voit rien » n'a pas pu être faite (${err.message}) — ` +
                "sans elle, ce fichier ne vérifie que la propriété des tables, pas la fermeture");
        } finally {
            try {
                if (monte) {
                    await db.query(`REVOKE ALL ON ${nom}_fermee, ${nom}_ouverte FROM ${nom}`);
                    await db.query(`DROP ROLE IF EXISTS ${nom}`);
                }
                await db.query(`DROP TABLE IF EXISTS ${nom}_fermee, ${nom}_ouverte`);
            } catch { /* déjà parti */ }
        }
    }
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
