// ==========================================================================
// SAMII OS — Script d'initialisation des tables PostgreSQL (à lancer une fois)
// ==========================================================================
const { pool } = require("../services/db");

async function init() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                nom TEXT NOT NULL,
                owner_email TEXT NOT NULL,
                metier TEXT,
                pays TEXT,
                devise TEXT DEFAULT 'DZD',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS produits (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                nom TEXT NOT NULL,
                description TEXT,
                prix NUMERIC NOT NULL,
                stock INTEGER DEFAULT 0,
                photo_url TEXT,
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log("✅ Tables workspaces + produits créées avec succès.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Erreur init DB :", err.message);
        process.exit(1);
    }
}

init();
