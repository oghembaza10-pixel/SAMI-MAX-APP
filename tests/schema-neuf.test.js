// ==========================================================================
// SAMII OS — UNE BASE VIDE + UN DÉMARRAGE = UNE APPLICATION QUI MARCHE
// ==========================================================================
//
// CE QUE CETTE SUITE SURVEILLE, ET POURQUOI ELLE EXISTE.
//
// Mesuré sur une base réellement vierge, avec le seul processus officiel du
// projet (le démarrage) : **20 échecs de schéma**, 29 tables créées.
//
// Toutes les erreurs disaient la même chose sous des noms différents —
// `services/schema.js` ALTÉRAIT DES TABLES QU'IL NE CRÉAIT JAMAIS. Les
// tables de base vivaient dans huit scripts séparés qu'il fallait lancer à
// la main, DANS UN ORDRE ÉCRIT NULLE PART.
//
// Et l'ordre n'était pas un détail : lancés alphabétiquement, `init-all.js`
// passe avant `init-db.js`. Or `commandes` porte `REFERENCES workspaces(id)`
// et `init-all.js` tient toute sa fondation dans un seul try/catch. La
// première erreur emportait les quinze tables suivantes sans un mot.
//
// Résultat constaté : `commandes`, `clients`, `annonces`, `publications` et
// `samii_conversations` n'étaient créées par RIEN.
//
// ── CE QUE ÇA COÛTAIT À QUELQU'UN ────────────────────────────────────────
//
// Un déploiement neuf ne lance que le démarrage. La création d'un QG
// répondait donc HTTP 200 et n'enregistrait rien — « column w.owner does not
// exist » partait dans un catch que personne ne lit. Le marchand voyait une
// page normale et n'avait pas de QG.
//
// ── CE QUE CETTE SUITE NE FAIT PAS ───────────────────────────────────────
//
// Elle ne se connecte à aucune base. Elle LIT le schéma déclaré et le
// compare à ce que le code demande réellement — en balayant les requêtes du
// projet. Une suite qui exigerait Postgres ne tournerait jamais en intégration
// continue, donc ne protégerait rien.
//
// La preuve sur base réelle est faite à part, en HTTP, et le rapport la
// donne. Ici on garde l'invariant : ce que le code lit doit exister.
//
// Lancer :  npm test
// ==========================================================================

const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const schema = require(path.join(RACINE, "services", "schema.js"));

// Tout le SQL que le démarrage joue, dans l'ordre.
const SQL = schema.BLOCS.flatMap((b) => b.sql);
const TOUT = SQL.join("\n");

// ── CE QUE LE DÉMARRAGE CRÉE ─────────────────────────────────────────────
const CREEES = new Set(
    [...TOUT.matchAll(/CREATE TABLE IF NOT EXISTS\s+(?:public\.)?([a-z_]+)/gi)].map((m) => m[1].toLowerCase()),
);

// ══════════════════════════════════════════════════════════════════════════
// 1. LE BLOC DES FONDATIONS EST LE PREMIER
// ══════════════════════════════════════════════════════════════════════════
//
// L'ORDRE EST LA MOITIÉ DU CORRECTIF. Les clés étrangères de `produits`,
// `commandes`, `clients`, `rendez_vous` pointent vers `workspaces` ; celles
// de `samii_conversations` et `publications` vers `utilisateurs`. Un bloc de
// fondations placé ailleurs qu'en tête et tout retombe exactement dans la
// panne qu'on vient de corriger.
{
    verifier(schema.BLOCS[0]?.nom === "fondations",
        `le premier bloc du schéma est « ${schema.BLOCS[0]?.nom} » et non « fondations » : ` +
        "les tables de base seraient créées APRÈS celles qui les référencent, et toutes les " +
        "clés étrangères échoueraient — exactement la panne d'origine");

    const fondations = schema.BLOCS[0].sql.join("\n");
    for (const table of ["utilisateurs", "workspaces", "produits", "admin_comptes",
        "samii_conversations", "prospects_vitrine", "publications",
        "commandes", "clients", "rendez_vous", "annonces", "journal"]) {
        verifier(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, "i").test(fondations),
            `« ${table} » n'est pas créée par le bloc des fondations : sur une base neuve elle ` +
            "manquerait, et l'erreur partirait dans un catch que personne ne lit");
    }

    // `utilisateurs` avant tout ce qui la référence.
    const iUtil = fondations.search(/CREATE TABLE IF NOT EXISTS utilisateurs\b/i);
    const iWs = fondations.search(/CREATE TABLE IF NOT EXISTS workspaces\b/i);
    verifier(iUtil >= 0 && iWs > iUtil,
        "workspaces est créée avant utilisateurs, qu'elle référence par agence_id");
    for (const t of ["produits", "commandes", "clients", "rendez_vous"]) {
        verifier(fondations.search(new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\b`, "i")) > iWs,
            `${t} est créée avant workspaces, qu'elle référence`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 2. AUCUNE TABLE ALTÉRÉE N'EST ABSENTE DES CRÉATIONS
// ══════════════════════════════════════════════════════════════════════════
//
// LA GARDE CENTRALE. C'est la règle qui manquait : tout ce que le démarrage
// modifie, il doit d'abord savoir le créer. Un ALTER sur une table absente
// n'est pas un avertissement, c'est une colonne qui n'existera jamais.
{
    const alterees = new Set(
        [...TOUT.matchAll(/ALTER TABLE\s+(?:IF EXISTS\s+)?(?:public\.)?([a-z_]+)/gi)].map((m) => m[1].toLowerCase()),
    );
    const orphelines = [...alterees].filter((t) => !CREEES.has(t));
    verifier(!orphelines.length,
        `le démarrage ALTÈRE des tables qu'il ne crée pas : ${orphelines.join(", ")} — ` +
        "sur une base neuve ces instructions échouent, et les colonnes manquent pour toujours");

    // Même règle pour les index.
    const indexees = new Set(
        [...TOUT.matchAll(/CREATE INDEX IF NOT EXISTS\s+[a-z_]+\s+ON\s+(?:public\.)?([a-z_]+)/gi)].map((m) => m[1].toLowerCase()),
    );
    const sansTable = [...indexees].filter((t) => !CREEES.has(t));
    verifier(!sansTable.length,
        `le démarrage indexe des tables qu'il ne crée pas : ${sansTable.join(", ")}`);

    // Et les tables qu'on verrouille en RLS.
    const sansRls = schema.A_VERROUILLER.filter((t) => !CREEES.has(t));
    verifier(!sansRls.length,
        `le démarrage protège en RLS des tables qu'il ne crée pas : ${sansRls.join(", ")} — ` +
        "la protection ne s'appliquerait jamais");

    // Et celles dont il vérifie les colonnes.
    const sansAttendu = [...new Set(schema.ATTENDUS.map((a) => a.table))].filter((t) => !CREEES.has(t));
    verifier(!sansAttendu.length,
        `le démarrage vérifie les colonnes de tables qu'il ne crée pas : ${sansAttendu.join(", ")}`);
}

// ══════════════════════════════════════════════════════════════════════════
// 3. CE QUE LE CODE LIT DOIT EXISTER
// ══════════════════════════════════════════════════════════════════════════
//
// On balaie le projet à la recherche des colonnes de `workspaces` et
// `utilisateurs` réellement employées, et on vérifie que le démarrage les
// fabrique. C'est comme ça que les treize colonnes manquantes ont été
// trouvées — dont `palier_abonnement`, que toute la facturation écrit.
{
    const colonnesDe = (table) => {
        const trouvees = new Set();
        const parcourir = (dossier) => {
            for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
                const p = path.join(dossier, e.name);
                if (e.isDirectory()) { parcourir(p); continue; }
                if (!e.name.endsWith(".js")) continue;
                const src = fs.readFileSync(p, "utf8");
                for (const m of src.matchAll(new RegExp(`UPDATE ${table} SET ([a-z_]+)`, "gi"))) trouvees.add(m[1]);
                for (const m of src.matchAll(new RegExp(`SELECT ([a-z_ ,\\n]+?) FROM ${table}`, "gi"))) {
                    for (const c of m[1].split(",")) {
                        const t = c.trim();
                        if (/^[a-z_]+$/.test(t)) trouvees.add(t);
                    }
                }
            }
        };
        for (const d of ["services", "routes", "engines"]) parcourir(path.join(RACINE, d));
        return [...trouvees];
    };

    // Ce que le démarrage sait fabriquer pour cette table : les colonnes du
    // CREATE, plus tous les ADD COLUMN qui la visent.
    const fabriquees = (table) => {
        const set = new Set();
        const creation = TOUT.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)\\n\\s*\\)`, "i"));
        if (creation) {
            // ⚠️ UNE LIGNE PEUT PORTER PLUSIEURS COLONNES.
            //
            // Première version : un `match` par ligne, ancré au début. Elle a
            // donc annoncé `pays`, `meta_access_token` et `meta_ad_account_id`
            // manquantes alors qu'elles étaient écrites juste là — sur la même
            // ligne qu'une voisine (`metier TEXT, pays TEXT,`). La garde
            // criait pour une raison qui n'était pas la bonne, exactement le
            // piège qu'un test doit éviter.
            //
            // On découpe donc sur les virgules de premier niveau, en laissant
            // de côté celles qui sont entre parenthèses (`NUMERIC(10,2)`).
            let profondeur = 0;
            let morceau = "";
            const morceaux = [];
            for (const c of creation[1]) {
                if (c === "(") profondeur++;
                if (c === ")") profondeur--;
                if (c === "," && profondeur === 0) { morceaux.push(morceau); morceau = ""; continue; }
                morceau += c;
            }
            morceaux.push(morceau);
            for (const m of morceaux) {
                const nom = m.trim().match(/^([a-z_]+)\s+[A-Za-z]/);
                if (nom) set.add(nom[1]);
            }
        }
        // Les ALTER groupés (une instruction, plusieurs ADD COLUMN) comme les
        // isolés. Le découpage par instruction évite d'attribuer à une table
        // les colonnes ajoutées à une autre.
        for (const sql of SQL) {
            if (!new RegExp(`ALTER TABLE\\s+(?:IF EXISTS\\s+)?(?:public\\.)?${table}\\b`, "i").test(sql)) continue;
            for (const m of sql.matchAll(/ADD COLUMN IF NOT EXISTS\s+([a-z_]+)/gi)) set.add(m[1]);
        }
        return set;
    };

    for (const table of ["workspaces", "utilisateurs"]) {
        const voulues = colonnesDe(table);
        const dispo = fabriquees(table);
        const manquantes = voulues.filter((c) => !dispo.has(c) && c !== "*");
        verifier(!manquantes.length,
            `le code lit des colonnes de « ${table} » que le démarrage ne crée pas : ` +
            `${manquantes.join(", ")} — sur une base neuve, ces requêtes échouent en silence`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 4. LE PARCOURS OBLIGATOIRE A TOUTES SES TABLES
// ══════════════════════════════════════════════════════════════════════════
//
// Compte, connexion, chat public, QG, chat QG, historique, crédits. Chaque
// étape est nommée avec la table dont elle dépend : un échec dit tout de
// suite QUELLE étape du produit serait cassée, pas seulement quelle table
// manque.
{
    const PARCOURS = [
        ["création de compte", "utilisateurs"],
        ["chat public — prospect laissé en conversation", "prospects_vitrine"],
        ["chat public et chat QG — la mémoire partagée", "samii_conversations"],
        ["création du QG", "workspaces"],
        ["catalogue du QG", "produits"],
        ["commandes du QG", "commandes"],
        ["rendez-vous du QG", "rendez_vous"],
        ["classement des QG", "journal"],
        ["administration du fondateur", "admin_comptes"],
        ["recharges de crédits", "recharges_samii"],
        ["grand livre des crédits", "portefeuille_mouvements"],
    ];
    for (const [etape, table] of PARCOURS) {
        verifier(CREEES.has(table),
            `« ${etape} » dépend de la table « ${table} », que le démarrage ne crée pas : ` +
            "sur une base neuve cette étape échouerait, et l'erreur partirait dans un catch");
    }

    // ── LA SEULE EXCEPTION, ET ELLE EST ASSUMÉE ──────────────────────────
    //
    // `session` n'est PAS dans services/schema.js, et c'est correct : c'est
    // connect-pg-simple qui la crée, avec sa propre forme et son propre
    // index d'expiration. La recopier ici nous rendrait responsables d'un
    // schéma qui appartient à la bibliothèque, et les deux divergeraient à
    // sa prochaine version.
    //
    // Ce qui compte, c'est que la création soit bien DEMANDÉE. Sans ce
    // drapeau, aucune session ne tient sur une base neuve : personne ne peut
    // se connecter, et il n'y a pas une ligne d'erreur pour le dire.
    const index = fs.readFileSync(path.join(RACINE, "index.js"), "utf8");
    verifier(/tableName\s*:\s*"session"/.test(index) && /createTableIfMissing\s*:\s*true/.test(index),
        "le magasin de sessions ne demande pas la création de sa table : sur une base neuve, " +
        "personne ne pourrait rester connecté, et rien ne le signalerait");
}

// ══════════════════════════════════════════════════════════════════════════
// 5. ON NE DÉPEND PLUS D'UN SCRIPT LANCÉ À LA MAIN
// ══════════════════════════════════════════════════════════════════════════
//
// Les scripts restent en place — ils sont idempotents et ne gênent personne.
// Mais plus rien ne doit en dépendre. On vérifie donc que chaque table qu'ils
// créaient et dont l'application a besoin est désormais dans le démarrage.
{
    const INDISPENSABLES = {
        "scripts/init-utilisateurs.js": ["utilisateurs"],
        "scripts/init-db.js": ["workspaces", "produits"],
        "scripts/init-admin.js": ["admin_comptes"],
        "scripts/init-memoire-samii.js": ["samii_conversations"],
        "scripts/create-prospects-vitrine.js": ["prospects_vitrine"],
        "scripts/init-community.js": ["publications"],
        "scripts/init-all.js": ["commandes", "clients", "annonces", "journal"],
        "scripts/init-rendezvous.js": ["rendez_vous"],
    };
    for (const [script, tables] of Object.entries(INDISPENSABLES)) {
        for (const t of tables) {
            verifier(CREEES.has(t),
                `« ${t} » n'existe que si quelqu'un lance ${script} à la main : un déploiement ` +
                "neuf ne lance que le démarrage, et cette table manquerait en production");
        }
    }

    // Et les colonnes de scripts/alter-workspaces.js, qu'il fallait lancer
    // EN PLUS de init-db.js — sans quoi la création d'un QG échouait en 200
    // silencieux, faute de `owner`.
    const wsCreation = TOUT.match(/CREATE TABLE IF NOT EXISTS workspaces\s*\(([\s\S]*?)\n\s*\)/i);
    for (const colonne of ["owner", "logo", "statut", "agence_id", "langue", "updated_at", "samii"]) {
        verifier(wsCreation && new RegExp(`\\b${colonne}\\s+[A-Z]`).test(wsCreation[1]),
            `workspaces.${colonne} n'est pas dans la création de la table : elle n'arriverait ` +
            "qu'après un script lancé à la main, et la création d'un QG échouerait en silence");
    }
}

// ══════════════════════════════════════════════════════════════════════════
// VERDICT
// ══════════════════════════════════════════════════════════════════════════
if (echecs.length) {
    console.log(`\n❌ schéma neuf : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    echecs.forEach((e) => console.log(`   • ${e}`));
    process.exit(1);
}
console.log(`✅ schéma neuf : ${verifs} vérifications passées (${CREEES.size} tables créées au démarrage)`);
