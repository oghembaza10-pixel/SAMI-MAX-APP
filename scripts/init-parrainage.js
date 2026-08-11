const db = require("../services/db");

async function run() {
    try {
        await db.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS parrainage_le TIMESTAMP;`);

        await db.query(`
            DO $$ BEGIN
                ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_code_parrainage_key UNIQUE (code_parrainage);
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS commissions_parrainage (
                id SERIAL PRIMARY KEY,
                parrain_id TEXT REFERENCES utilisateurs(id),
                filleul_id TEXT REFERENCES utilisateurs(id),
                plan TEXT,
                montant_paye NUMERIC NOT NULL,
                devise TEXT DEFAULT 'USD',
                commission_montant NUMERIC NOT NULL,
                mois_numero INTEGER NOT NULL,
                source TEXT NOT NULL,
                statut TEXT DEFAULT 'confirmee',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`CREATE INDEX IF NOT EXISTS idx_commissions_parrain ON commissions_parrainage(parrain_id);`);

        console.log("✅ Parrainage : colonne parrainage_le + table commissions_parrainage créées.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
