const db = require("../services/db");
async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS configuration (
                cle TEXT PRIMARY KEY,
                valeur TEXT,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`
            INSERT INTO configuration (cle, valeur) VALUES ('guerre_date_lancement', 
            (NOW() + INTERVAL '7 days')::TEXT)
            ON CONFLICT (cle) DO NOTHING;
        `);
        console.log("✅ Table configuration créée, date de lancement par défaut : +7 jours.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
