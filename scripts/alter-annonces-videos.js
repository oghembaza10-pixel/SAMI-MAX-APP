// ==========================================================================
// Ajoute une colonne dédiée pour les vidéos produit (CJ en fournit parfois).
// Idempotent : ADD COLUMN IF NOT EXISTS, ne touche à aucune donnée existante.
// ==========================================================================
const db = require("../services/db");

async function run() {
    try {
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]'::jsonb`);
        console.log("✅ Colonne videos confirmée sur annonces.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
