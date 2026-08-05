const db = require("../services/db");
async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                client_nom TEXT,
                client_telephone TEXT,
                canal TEXT,
                dernier_message TEXT,
                statut TEXT DEFAULT 'ouverte',
                updated_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
                expediteur TEXT,
                contenu TEXT,
                lu BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                nom TEXT,
                url TEXT,
                type TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Tables communication créées : conversations, messages, documents.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
