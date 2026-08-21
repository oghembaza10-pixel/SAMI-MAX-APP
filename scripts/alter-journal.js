const db = require("../services/db");
async function run() {
    try {
        // Le montant et la référence de l'entité (commande, abonnement, carte...)
        // étaient jusqu'ici seulement écrits en texte libre dans `details`,
        // illisible pour une future analyse agrégée. Colonnes additives,
        // aucune donnée existante touchée.
        await db.query(`ALTER TABLE journal ADD COLUMN IF NOT EXISTS montant NUMERIC`);
        await db.query(`ALTER TABLE journal ADD COLUMN IF NOT EXISTS ref_id TEXT`);
        console.log("✅ Colonnes montant/ref_id ajoutées à journal.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
