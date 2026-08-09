// ==========================================================================
// Documente dans le code les colonnes de `annonces` déjà présentes en
// production (ajoutées manuellement) mais absentes de tout script versionné.
// `annonces` est la table officielle de la Marketplace (utilisée par
// routes/marketplace.js et par scripts/import-cj-products.js).
// Idempotent : ADD COLUMN IF NOT EXISTS, ne touche à aucune donnée existante.
// ==========================================================================
const db = require("../services/db");

async function run() {
    try {
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS partenaire_id BIGINT`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS media_id BIGINT`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS provider_code TEXT`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS provider_product_id TEXT`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS provider_variant_ids JSONB DEFAULT '[]'::jsonb`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS source_url TEXT`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS region_fournisseur TEXT`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS prix_fournisseur NUMERIC`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS devise TEXT DEFAULT 'DZD'`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS stock INTEGER`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS sku TEXT`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS fournisseur_verifie BOOLEAN DEFAULT false`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS variantes JSONB DEFAULT '[]'::jsonb`);
        await db.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS pays_expedition JSONB DEFAULT '[]'::jsonb`);
        console.log("✅ Colonnes fournisseur (CJ/BigBuy/...) confirmées sur annonces.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}
run();
