const db = require("../services/db");
async function run() {
    try {
        await db.query(`ALTER TABLE publications ADD COLUMN IF NOT EXISTS categorie TEXT DEFAULT 'publication'`);
        await db.query(`ALTER TABLE publications ADD COLUMN IF NOT EXISTS video_url TEXT`);
        console.log("✅ Colonnes categorie + video_url ajoutées à publications.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
