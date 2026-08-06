const db = require("../services/db");
async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS points_history (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES utilisateurs(id),
                points INTEGER,
                raison TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS offres_saison (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                titre TEXT,
                reduction_pourcent INTEGER,
                produit_id INTEGER,
                mois TEXT,
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS debloquages (
                id SERIAL PRIMARY KEY,
                beneficiaire_id TEXT,
                beneficiaire_type TEXT,
                type_recompense TEXT,
                reference TEXT,
                mois TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Tables saison créées : points_history, offres_saison, debloquages.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
