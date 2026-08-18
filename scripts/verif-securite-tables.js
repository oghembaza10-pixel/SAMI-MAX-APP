const db = require("../services/db");
async function run() {
    const fixes = [
        `ALTER TABLE annonces ADD COLUMN IF NOT EXISTS region_fournisseur TEXT`,
        `ALTER TABLE annonces ADD COLUMN IF NOT EXISTS description TEXT`,
        `ALTER TABLE annonces ADD COLUMN IF NOT EXISTS photos_urls TEXT`,
        `ALTER TABLE academie_cours ADD COLUMN IF NOT EXISTS video_url TEXT`,
        `ALTER TABLE academie_cours ADD COLUMN IF NOT EXISTS date_live TIMESTAMP`,
        `ALTER TABLE academie_cours ADD COLUMN IF NOT EXISTS pdf_url TEXT`,
        `ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS banniere_url TEXT`,
        `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner TEXT`,
        `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS description TEXT`,
        `ALTER TABLE publications ADD COLUMN IF NOT EXISTS categorie TEXT DEFAULT 'publication'`,
        `ALTER TABLE publications ADD COLUMN IF NOT EXISTS video_url TEXT`,
        `ALTER TABLE commandes ADD COLUMN IF NOT EXISTS numero_suivi TEXT`,
        `ALTER TABLE commandes ADD COLUMN IF NOT EXISTS transporteur TEXT`,
        `ALTER TABLE commandes ADD COLUMN IF NOT EXISTS dernier_statut_suivi TEXT`,
        `ALTER TABLE commandes ADD COLUMN IF NOT EXISTS email TEXT`,
    ];
    let ok = 0, fail = 0;
    for (const sql of fixes) {
        try { await db.query(sql); ok++; } catch (err) { fail++; console.error("❌", sql, "→", err.message); }
    }
    console.log(`✅ ${ok} vérifications appliquées, ${fail} échecs.`);
    process.exit(0);
}
run();
