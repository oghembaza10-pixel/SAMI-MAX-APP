// Ajoute le support "QG Agence" à la table workspaces : une agence peut
// créer et piloter les boutiques de ses clients (voir services/agenceService.js).
// À exécuter une seule fois sur la vraie base (node scripts/alter-workspaces-agence.js).
const db = require("../services/db");

async function run() {
    try {
        await db.query(`
            ALTER TABLE workspaces
                ADD COLUMN IF NOT EXISTS agence_id TEXT REFERENCES utilisateurs(id),
                ADD COLUMN IF NOT EXISTS agence_statut TEXT DEFAULT 'actif';
        `);
        console.log("✅ Colonnes agence_id / agence_statut ajoutées à workspaces.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
