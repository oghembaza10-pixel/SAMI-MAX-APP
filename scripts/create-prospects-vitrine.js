// ==========================================================================
// Table des prospects captés par le chat SAMII de la page d'accueil publique.
// Volontairement séparée des tables métier (clients, commandes...) : ce sont
// des visiteurs anonymes, rattachés à aucun workspace.
//
// Lancer une seule fois :  node scripts/create-prospects-vitrine.js
// ==========================================================================
const db = require("../services/db");

(async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS prospects_vitrine (
                id          BIGSERIAL PRIMARY KEY,
                email       TEXT,
                telephone   TEXT,
                message     TEXT,
                langue      TEXT DEFAULT 'fr',
                ip          TEXT,
                traite      BOOLEAN DEFAULT FALSE,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_prospects_vitrine_created ON prospects_vitrine (created_at DESC);`);
        console.log("✅ Table prospects_vitrine prête.");
    } catch (err) {
        console.error("❌ Création prospects_vitrine :", err.message);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
})();
