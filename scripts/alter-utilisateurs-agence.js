const db = require("../services/db");
async function run() {
    try {
        await db.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS est_agence BOOLEAN DEFAULT false`);
        await db.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS abandon_signale_par_agence BOOLEAN DEFAULT false`);
        await db.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS abandon_signale_le TIMESTAMP`);
        console.log("✅ Colonnes agence ajoutées à utilisateurs.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
