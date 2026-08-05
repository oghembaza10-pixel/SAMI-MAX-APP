const db = require("../services/db");
async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS diffusion (
                id SERIAL PRIMARY KEY,
                contenu_type TEXT NOT NULL,
                contenu_id INTEGER NOT NULL,
                module_cible TEXT NOT NULL,
                workspace_id TEXT,
                auteur_id TEXT,
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_diffusion_module ON diffusion(module_cible, actif)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_diffusion_contenu ON diffusion(contenu_type, contenu_id)`);
        console.log("✅ Table diffusion créée — relie tout contenu (produit/annonce/service/formation/publication) à n'importe quel module (marketplace/community/academy/qg).");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
