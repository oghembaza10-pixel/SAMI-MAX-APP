// ==========================================================================
// SAMII OS — Fermeture de la porte PostgREST
//
// LE PROBLÈME. Supabase expose le schéma `public` par une API REST publique
// (PostgREST), utilisable avec la clé « publiable » — une clé conçue pour
// être publique, qu'on retrouve dans n'importe quel navigateur. Sur une table
// où RLS n'est pas activé, cette clé donne un accès direct en lecture ET en
// écriture, sans jamais passer par l'application ni par ses vérifications.
//
// Dix tables étaient dans ce cas. Parmi elles :
//   • webhooks_sortants — contient les SECRETS de signature HMAC. Les lire,
//     c'est pouvoir forger des webhooks parfaitement signés au nom de SAMII ;
//   • api_cles, api_journal, app_installations, apps — tout le système de
//     permissions et sa traçabilité ;
//   • livreurs, livraisons — données personnelles de livreurs et de clients.
//
// LA CORRECTION. Activer RLS sans écrire de politique : le refus devient le
// défaut pour les rôles anon et authenticated. L'application n'est pas
// affectée — elle se connecte en Postgres direct (services/db.js) et ce rôle
// contourne RLS. C'est déjà la posture des ~75 autres tables du projet.
//
// Lancer :  node scripts/securiser-rls.js
// ==========================================================================
const db = require("../services/db");

const TABLES = [
    "api_cles", "api_journal", "apps", "app_installations", "webhooks_sortants",
    "livreurs", "livraisons", "memoire_sessions", "projets_samii", "samii_connaissances",
];

(async () => {
    try {
        for (const table of TABLES) {
            // to_regclass renvoie NULL si la table n'existe pas sur cet
            // environnement : on saute au lieu d'interrompre tout le script.
            const existe = await db.query(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
            if (!existe[0]?.t) {
                console.log(`⏭️  ${table} — absente ici, ignorée`);
                continue;
            }
            await db.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
            console.log(`🔒 ${table}`);
        }

        // Contrôle final : on relit l'état réel plutôt que de supposer que les
        // ALTER ont fait leur travail.
        const restantes = await db.query(
            `SELECT tablename FROM pg_tables
              WHERE schemaname = 'public' AND rowsecurity = FALSE
              ORDER BY tablename`,
        );
        console.log(
            restantes.length
                ? `\n⚠️ Encore sans RLS : ${restantes.map(r => r.tablename).join(", ")}`
                : "\n✅ Plus aucune table du schéma public sans RLS.",
        );
    } catch (err) {
        console.error("❌ securiser-rls :", err.message);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
})();
