const db = require("../services/db");
async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS academie_cours (
                id SERIAL PRIMARY KEY,
                titre TEXT,
                categorie TEXT,
                format TEXT,
                niveau TEXT,
                duree TEXT,
                prix TEXT,
                likes INTEGER DEFAULT 0,
                photo_url TEXT,
                formateur_id TEXT,
                formateur_nom TEXT,
                type_formateur TEXT,
                est_live BOOLEAN DEFAULT false,
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS academie_favoris (
                id SERIAL PRIMARY KEY,
                user_id TEXT,
                cours_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, cours_id)
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS academie_likes (
                id SERIAL PRIMARY KEY,
                user_id TEXT,
                cours_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, cours_id)
            );
        `);
        console.log("✅ Tables Academie créées : academie_cours, academie_favoris, academie_likes.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
