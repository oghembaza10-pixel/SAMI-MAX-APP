const db = require("../services/db");
async function run() {
    try {
        await db.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS banniere_url TEXT`);
        console.log("✅ Colonne banniere_url ajoutée à utilisateurs.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
