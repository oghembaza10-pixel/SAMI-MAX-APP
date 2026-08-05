const db = require("../services/db");
async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS arsenal_historique (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                carte TEXT,
                resultat TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Table arsenal_historique créée.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
