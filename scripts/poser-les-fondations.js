// ==========================================================================
// POSER LES FONDATIONS D'UNE BASE NEUVE
// ==========================================================================
//
// ── CE QUE CE FICHIER RÉPARE ──────────────────────────────────────────────
//
// Sur une base Postgres vide, SAMII ne peut pas créer un seul compte. Pas
// « une fonctionnalité en moins » : `POST /register` répond « Erreur
// serveur. Réessayez. », et le journal dit :
//
//     relation "utilisateurs" does not exist
//     relation "workspaces"   does not exist
//     relation "annonces"     does not exist
//     relation "publications" does not exist
//     relation "avis"         does not exist
//
// La raison : `services/schema.js` tourne bien à chaque démarrage, mais il
// ne fait que des `ALTER TABLE … ADD COLUMN`. Il suppose que les tables
// existent déjà. Elles existent — dans la base de production — parce que
// quelqu'un a lancé ces 35 scripts à la main, un par un, dans un ordre que
// personne n'a écrit nulle part.
//
// Conséquence : SAMII n'a jamais été déployable depuis le dépôt. La base de
// production est le seul exemplaire, et il n'existe aucune recette pour en
// refaire une. Une deuxième partenaire, une restauration après incident, un
// environnement d'essai : les trois butent au même endroit.
//
// ── POURQUOI C'EST SÛR DE LES REJOUER ─────────────────────────────────────
//
// J'ai relu les 35 : chaque création est un `CREATE TABLE IF NOT EXISTS`,
// chaque colonne un `ADD COLUMN IF NOT EXISTS`. Et surtout — vérifié un par
// un — AUCUN ne contient de `DROP TABLE`, `DELETE FROM` ni `TRUNCATE`.
// Relancer ce fichier sur la base de production ne peut donc rien effacer :
// tout ce qui existe déjà est laissé tel quel.
//
// ── POURQUOI PAS AU DÉMARRAGE DU SERVEUR ──────────────────────────────────
//
// Trente-cinq processus enfants, c'est plusieurs dizaines de secondes. Les
// imposer à chaque redéploiement de Render allongerait chaque mise en
// ligne pour un travail qui n'est utile qu'une fois. On l'appelle donc
// explicitement : `npm run fondations`.
//
// ── L'ORDRE COMPTE ────────────────────────────────────────────────────────
//
// Plusieurs tables déclarent `REFERENCES workspaces(id)`. Créer `commandes`
// avant `workspaces` échoue. L'ordre ci-dessous n'est pas alphabétique :
// c'est l'ordre des dépendances, établi en relevant quelle table chaque
// script crée et laquelle il référence.

const { spawnSync } = require("child_process");
const path = require("path");

// 1. LE SOCLE — tout le reste s'y accroche.
//    `utilisateurs` d'abord : c'est la seule table que rien ne référence,
//    et que presque tout référence.
const SOCLE = [
    "init-utilisateurs.js",   // utilisateurs
    "init-db.js",             // workspaces, produits
];

// 2. LES TABLES MÉTIER — elles référencent le socle, jamais l'inverse.
const METIER = [
    "init-all.js",            // commandes, clients, annonces, avis, journal, connecteurs, transactions…
    "init-commandes.js",
    "init-commerce.js",       // factures, fournisseurs, stock, reservations
    "init-communication.js",  // messages, conversations, documents
    "init-community.js",      // publications, likes, commentaires
    "init-memoire-samii.js",  // samii_conversations, samii_souvenirs, samii_medias
    "init-academie.js",
    "init-admin.js",
    "init-arsenal-hist.js",
    "init-configuration.js",
    "init-diffusion.js",
    "init-immobilier.js",
    "init-parrainage.js",
    "init-partenariat.js",
    "init-rendezvous.js",
    "init-saison.js",
    "init-shipments.js",
    "create-academie.js",
    "create-api-partenaires.js",
    "create-apps.js",
    "create-portefeuille.js",
    "create-prospects-vitrine.js",
];

// 3. LES AJOUTS DE COLONNES — ils supposent la table déjà là.
const COLONNES = [
    "alter-academie.js",
    "alter-annonces-provider.js",
    "alter-annonces-videos.js",
    "alter-community.js",
    "alter-journal.js",
    "alter-vitrine.js",
    "alter-workspaces.js",
    "alter-workspaces-agence.js",
    "verif-securite-tables.js",
];

const TOUT = [...SOCLE, ...METIER, ...COLONNES];

// `securiser-rls.js` est volontairement absent : il pose des politiques de
// sécurité au niveau des lignes, ce qui change qui peut lire quoi. Ça se
// décide, ça ne se déroule pas dans un script de mise en place.
//
// Les scripts d'import (produits CJ, BigBuy) et les `test-*.js` sont
// absents aussi : ils insèrent des DONNÉES ou appellent des services
// dehors. Poser les fondations d'une base ne doit ni la remplir ni
// téléphoner à personne.

function lancer(nom) {
    const chemin = path.join(__dirname, nom);
    // Chaque script appelle `process.exit()` en finissant : impossible de
    // les `require()` ici sans arrêter celui-ci au premier. On les lance
    // donc en processus séparés — ce qui a un autre mérite : un script qui
    // plante n'emporte pas les suivants.
    const r = spawnSync(process.execPath, [chemin], {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
        timeout: 60000,
    });
    const sortie = ((r.stdout || "") + (r.stderr || "")).toString().trim();
    // Ces scripts attrapent leurs propres erreurs et sortent quand même
    // en 0 — leur code de sortie ne dit donc pas la vérité. Ce qui la dit,
    // c'est ce qu'ils ont écrit.
    const rate = /❌|does not exist|error:/i.test(sortie);
    return { nom, rate, sortie, mort: r.status !== 0 && r.status !== null };
}

(async () => {
    console.log(`\n🧱 Pose des fondations — ${TOUT.length} scripts, dans l'ordre des dépendances.\n`);
    const rates = [];

    for (const groupe of [["SOCLE", SOCLE], ["TABLES MÉTIER", METIER], ["COLONNES", COLONNES]]) {
        console.log(`── ${groupe[0]} ${"─".repeat(Math.max(0, 50 - groupe[0].length))}`);
        for (const nom of groupe[1]) {
            const r = lancer(nom);
            if (r.rate || r.mort) {
                rates.push(r);
                console.log(`  ❌ ${nom}`);
                for (const ligne of r.sortie.split("\n").slice(0, 4)) console.log(`       ${ligne}`);
            } else {
                console.log(`  ✅ ${nom}`);
            }
        }
        console.log("");
    }

    if (rates.length) {
        console.log(`❌ ${rates.length} script(s) en échec — la base n'est pas complète.`);
        console.log("   Les tables manquantes se liront dans le détail ci-dessus.\n");
        process.exit(1);
    }
    console.log("✅ Fondations posées. La base peut recevoir une première inscription.\n");
    process.exit(0);
})();
