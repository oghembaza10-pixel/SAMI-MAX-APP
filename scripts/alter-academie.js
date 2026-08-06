const db = require("../services/db");
async function run() {
    try {
        await db.query(`ALTER TABLE academie_cours ADD COLUMN IF NOT EXISTS video_url TEXT`);
        await db.query(`ALTER TABLE academie_cours ADD COLUMN IF NOT EXISTS date_live TIMESTAMP`);
        console.log("✅ Colonnes video_url + date_live ajoutées à academie_cours.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
