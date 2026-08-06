const db = require("../services/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS biens_immobiliers (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                titre TEXT,
                type_bien TEXT,
                type_transaction TEXT,
                prix NUMERIC,
                devise TEXT DEFAULT 'DZD',
                ville TEXT,
                pays TEXT,
                surface NUMERIC,
                nb_pieces INTEGER,
                description TEXT,
                photo_url TEXT,
                photos_urls TEXT,
                statut TEXT DEFAULT 'disponible',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Table biens_immobiliers créée.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
