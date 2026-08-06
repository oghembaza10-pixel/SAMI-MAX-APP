const db = require("../services/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS rendez_vous (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                client_nom TEXT,
                client_telephone TEXT,
                motif TEXT,
                date_rdv TIMESTAMP,
                statut TEXT DEFAULT 'en_attente',
                source TEXT DEFAULT 'telegram',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Table rendez_vous créée — utilisable par tous les métiers (dentiste, avocat, comptable, coiffeur, etc.).");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
