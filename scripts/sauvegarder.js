// ==========================================================================
// SAMII OS — Sauvegarde des données vitales
//
// POURQUOI. Une erreur de manipulation, une suppression malheureuse ou un
// incident chez l'hébergeur, et c'est l'entreprise qui s'arrête. Ce script
// existe pour qu'il y ait toujours une copie ailleurs, sans dépendre d'un
// outil externe : ni pg_dump, ni psql, juste Node.
//
// CE FICHIER EST UN SECRET. Il contient les jetons OAuth des marchands
// (table connecteurs) : quiconque le lit peut agir sur leurs comptes Google
// et Meta. Ne le laisse pas dans le dépôt, ne l'envoie pas par email, garde-le
// chiffré. C'est aussi pour cette raison que sauvegardes/ doit rester ignoré
// par git — vérifie-le avant de lancer ce script la première fois.
//
// Lancer :  node scripts/sauvegarder.js [dossier]
// ==========================================================================
const fs = require("fs");
const path = require("path");
const db = require("../services/db");

// L'ordre compte peu ici, mais la liste, oui : ce sont les tables sans
// lesquelles on ne peut pas redémarrer l'activité. Le contenu éditorial
// (academy, community, stories) est volontairement absent — il se reconstruit,
// une commande perdue non.
const VITALES = [
    "utilisateurs", "workspaces", "connecteurs", "abonnements",
    "commandes", "rendez_vous", "clients", "produits", "produits_variantes",
    "api_cles", "webhooks_sortants", "apps", "app_installations",
    "commissions_parrainage", "factures", "transactions",
];

(async () => {
    const dossier = process.argv[2] || path.join(__dirname, "..", "sauvegardes");
    fs.mkdirSync(dossier, { recursive: true });

    const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fichier = path.join(dossier, `samii-${horodatage}.json`);

    const sortie = { genere_le: new Date().toISOString(), tables: {} };
    let lignes = 0;
    const absentes = [];

    try {
        for (const table of VITALES) {
            const existe = await db.query(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
            if (!existe[0]?.t) { absentes.push(table); continue; }

            const rows = await db.query(`SELECT * FROM public.${table}`);
            sortie.tables[table] = rows;
            lignes += rows.length;
            console.log(`  ${String(rows.length).padStart(6)} lignes · ${table}`);
        }

        fs.writeFileSync(fichier, JSON.stringify(sortie));
        // Lisible par le seul propriétaire : ce fichier contient des jetons.
        fs.chmodSync(fichier, 0o600);

        const taille = (fs.statSync(fichier).size / 1024 / 1024).toFixed(2);
        console.log(`\n✅ ${lignes} lignes sauvegardées — ${fichier} (${taille} Mo)`);
        if (absentes.length) console.log(`   (tables absentes ici : ${absentes.join(", ")})`);
        console.log("\n⚠️  Ce fichier contient des jetons OAuth de marchands.");
        console.log("   Copie-le hors du serveur, garde-le chiffré, ne le partage jamais.");

        // Une sauvegarde qu'on ne peut pas relire n'en est pas une : on
        // vérifie tout de suite qu'elle se recharge et qu'elle est complète.
        const relu = JSON.parse(fs.readFileSync(fichier, "utf8"));
        const total = Object.values(relu.tables).reduce((n, t) => n + t.length, 0);
        console.log(total === lignes
            ? "✅ Relecture vérifiée : le fichier est exploitable."
            : `❌ Relecture incohérente : ${total} lignes relues sur ${lignes}.`);
        if (total !== lignes) process.exitCode = 1;
    } catch (err) {
        console.error("❌ sauvegarder :", err.message);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
})();
