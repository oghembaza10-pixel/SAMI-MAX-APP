// ==========================================================================
// API partenaires : clés d'accès et webhooks sortants.
//
// Permet à un système externe (n8n, Make, Zapier, un ERP...) de lire et
// créer des commandes et des rendez-vous dans un espace SAMII, et d'être
// prévenu en temps réel quand quelque chose s'y passe.
//
// Deux portées possibles, jamais les deux à la fois :
//   • workspace_id → clé d'un marchand, bornée à son seul espace ;
//   • agence_id    → clé d'agence, qui couvre TOUS les espaces de son
//                    portefeuille. Une agence branche son n8n une seule
//                    fois pour l'ensemble de ses clients, au lieu de
//                    reconstruire un flux par boutique.
//
// Lancer une seule fois :  node scripts/create-api-partenaires.js
// ==========================================================================
const db = require("../services/db");

(async () => {
    try {
        // La clé n'est JAMAIS stockée en clair : seule son empreinte SHA-256
        // l'est. Si la base fuite, les clés restent inutilisables. Le préfixe
        // sert uniquement à afficher "sk_samii_a1b2…" dans l'interface pour
        // que le propriétaire reconnaisse sa clé.
        await db.query(`
            CREATE TABLE IF NOT EXISTS api_cles (
                id             BIGSERIAL PRIMARY KEY,
                workspace_id   TEXT,
                agence_id      TEXT,
                nom            TEXT NOT NULL DEFAULT 'Clé API',
                cle_hash       TEXT NOT NULL UNIQUE,
                cle_prefixe    TEXT NOT NULL,
                actif          BOOLEAN NOT NULL DEFAULT TRUE,
                derniere_utilisation TIMESTAMPTZ,
                created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT api_cles_portee CHECK (
                    (workspace_id IS NOT NULL AND agence_id IS NULL)
                 OR (workspace_id IS NULL AND agence_id IS NOT NULL)
                )
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_api_cles_hash ON api_cles (cle_hash) WHERE actif;`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_api_cles_ws ON api_cles (workspace_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_api_cles_agence ON api_cles (agence_id);`);

        // Webhooks sortants : SAMII appelle ces URL quand un événement se
        // produit. Le `secret` sert à signer le corps de la requête (HMAC),
        // pour que le destinataire puisse vérifier que l'appel vient bien
        // de nous et n'a pas été altéré.
        await db.query(`
            CREATE TABLE IF NOT EXISTS webhooks_sortants (
                id            BIGSERIAL PRIMARY KEY,
                workspace_id  TEXT,
                agence_id     TEXT,
                url           TEXT NOT NULL,
                evenements    TEXT[] NOT NULL DEFAULT '{}',
                secret        TEXT NOT NULL,
                actif         BOOLEAN NOT NULL DEFAULT TRUE,
                dernier_essai TIMESTAMPTZ,
                dernier_statut INTEGER,
                echecs        INTEGER NOT NULL DEFAULT 0,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT webhooks_portee CHECK (
                    (workspace_id IS NOT NULL AND agence_id IS NULL)
                 OR (workspace_id IS NULL AND agence_id IS NOT NULL)
                )
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_webhooks_ws ON webhooks_sortants (workspace_id) WHERE actif;`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_webhooks_agence ON webhooks_sortants (agence_id) WHERE actif;`);

        // ── Rattrapage ────────────────────────────────────────────────────
        // Les tables ont pu être créées par une première version de ce script,
        // qui ne connaissait que la portée marchand (workspace_id NOT NULL,
        // pas de agence_id). CREATE TABLE IF NOT EXISTS ne les aurait pas
        // touchées : on les met à niveau ici. Tout est idempotent, ce script
        // peut être relancé autant de fois que nécessaire.
        for (const table of ["api_cles", "webhooks_sortants"]) {
            await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS agence_id TEXT;`);
            await db.query(`ALTER TABLE ${table} ALTER COLUMN workspace_id DROP NOT NULL;`);
        }
        // Postgres n'a pas de ADD CONSTRAINT IF NOT EXISTS : on ignore
        // l'erreur "existe déjà" plutôt que de tester le catalogue.
        await db.query(`
            DO $$ BEGIN
                ALTER TABLE api_cles ADD CONSTRAINT api_cles_portee CHECK (
                    (workspace_id IS NOT NULL AND agence_id IS NULL)
                 OR (workspace_id IS NULL AND agence_id IS NOT NULL));
            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);
        await db.query(`
            DO $$ BEGIN
                ALTER TABLE webhooks_sortants ADD CONSTRAINT webhooks_portee CHECK (
                    (workspace_id IS NOT NULL AND agence_id IS NULL)
                 OR (workspace_id IS NULL AND agence_id IS NOT NULL));
            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_api_cles_agence ON api_cles (agence_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_webhooks_agence ON webhooks_sortants (agence_id) WHERE actif;`);

        console.log("✅ Tables api_cles et webhooks_sortants prêtes (marchand + agence).");
    } catch (err) {
        console.error("❌ Création tables API partenaires :", err.message);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
})();
