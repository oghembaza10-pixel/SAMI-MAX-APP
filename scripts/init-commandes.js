const db = require("../services/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS commandes (
                id TEXT PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                nom_client TEXT,
                telephone TEXT,
                adresse TEXT,
                produit TEXT,
                montant NUMERIC DEFAULT 0,
                statut TEXT DEFAULT 'en attente',
                source TEXT DEFAULT 'telegram',
                numero_suivi TEXT,
                transporteur TEXT,
                dernier_statut_suivi TEXT,
                date_commande TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Table commandes créée avec succès.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
