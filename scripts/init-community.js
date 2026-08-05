const db = require("../services/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS publications (
                id SERIAL PRIMARY KEY,
                auteur_id TEXT REFERENCES utilisateurs(id),
                contenu TEXT,
                image_url TEXT,
                type TEXT DEFAULT 'texte',
                epingle BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS publications_likes (
                id SERIAL PRIMARY KEY,
                publication_id INTEGER REFERENCES publications(id) ON DELETE CASCADE,
                user_id TEXT REFERENCES utilisateurs(id),
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(publication_id, user_id)
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS publications_commentaires (
                id SERIAL PRIMARY KEY,
                publication_id INTEGER REFERENCES publications(id) ON DELETE CASCADE,
                auteur_id TEXT REFERENCES utilisateurs(id),
                contenu TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log("✅ Tables Community créées : publications, publications_likes, publications_commentaires.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
