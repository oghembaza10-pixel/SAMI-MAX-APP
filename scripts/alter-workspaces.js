const db = require("../services/db");
async function run() {
    try {
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner TEXT`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS logo TEXT`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS langue TEXT DEFAULT 'fr'`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS description TEXT`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS samii TEXT`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS coffre TEXT`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS automatisations TEXT`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS missions TEXT`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meta_access_token TEXT`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meta_ad_account_id TEXT`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meta_page_id TEXT`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Algiers'`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'actif'`);
        await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
        console.log("✅ Colonnes complètes ajoutées à workspaces.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
