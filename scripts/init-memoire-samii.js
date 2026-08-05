const db = require("../services/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS samii_conversations (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES utilisateurs(id),
                role TEXT,
                contenu TEXT,
                source TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS samii_medias (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES utilisateurs(id),
                type TEXT,
                url TEXT,
                contexte TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS samii_souvenirs (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES utilisateurs(id),
                categorie TEXT,
                cle TEXT,
                valeur TEXT,
                importance INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log("✅ Tables mémoire SAMII créées : conversations, medias, souvenirs.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
