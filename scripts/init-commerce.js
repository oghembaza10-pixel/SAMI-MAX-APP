const db = require("../services/db");
async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS stock (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                produit_id INTEGER REFERENCES produits(id),
                quantite INTEGER DEFAULT 0,
                seuil_alerte INTEGER DEFAULT 5,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS factures (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                commande_id TEXT REFERENCES commandes(id),
                montant NUMERIC DEFAULT 0,
                devise TEXT DEFAULT 'DZD',
                statut TEXT DEFAULT 'en_attente',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS fournisseurs (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                nom TEXT,
                region TEXT,
                contact TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS reservations (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                client_nom TEXT,
                client_telephone TEXT,
                date_reservation TIMESTAMP,
                nb_personnes INTEGER,
                statut TEXT DEFAULT 'en_attente',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Tables commerce créées : stock, factures, fournisseurs, reservations.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
