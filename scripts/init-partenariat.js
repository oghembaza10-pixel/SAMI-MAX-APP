const db = require("../services/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS candidatures_partenariat (
                id SERIAL PRIMARY KEY,
                categorie TEXT NOT NULL,
                email TEXT NOT NULL,
                telephone TEXT,
                description TEXT NOT NULL,
                statut TEXT DEFAULT 'nouveau',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`CREATE INDEX IF NOT EXISTS idx_candidatures_statut ON candidatures_partenariat(statut);`);

        console.log("✅ Partenariat : table candidatures_partenariat créée.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
