// ==========================================================================
// API partenaires : clés d'accès et webhooks sortants.
//
// Permet à un système externe (n8n, Make, Zapier, un ERP...) de lire et
// créer des commandes et des rendez-vous dans un espace SAMII, et d'être
// prévenu en temps réel quand quelque chose s'y passe.
//
// Lancer une seule fois :  node scripts/create-api-partenaires.js
// ==========================================================================
const db = require("../services/db");

(async () => {
    try {
        // La clé n'est JAMAIS stockée en clair : seul son empreinte SHA-256
        // l'est. Si la base fuite, les clés restent inutilisables. Le préfixe
        // (8 premiers caractères) sert uniquement à afficher "sk_live_a1b2…"
        // dans l'interface pour que le marchand reconnaisse sa clé.
        await db.query(`
            CREATE TABLE IF NOT EXISTS api_cles (
                id             BIGSERIAL PRIMARY KEY,
                workspace_id   TEXT NOT NULL,
                nom            TEXT NOT NULL DEFAULT 'Clé API',
                cle_hash       TEXT NOT NULL UNIQUE,
                cle_prefixe    TEXT NOT NULL,
                actif          BOOLEAN NOT NULL DEFAULT TRUE,
                derniere_utilisation TIMESTAMPTZ,
                created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_api_cles_hash ON api_cles (cle_hash) WHERE actif;`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_api_cles_ws ON api_cles (workspace_id);`);

        // Webhooks sortants : SAMII appelle ces URL quand un événement se
        // produit. Le `secret` sert à signer le corps de la requête (HMAC),
        // pour que le destinataire puisse vérifier que l'appel vient bien
        // de nous et n'a pas été altéré.
        await db.query(`
            CREATE TABLE IF NOT EXISTS webhooks_sortants (
                id            BIGSERIAL PRIMARY KEY,
                workspace_id  TEXT NOT NULL,
                url           TEXT NOT NULL,
                evenements    TEXT[] NOT NULL DEFAULT '{}',
                secret        TEXT NOT NULL,
                actif         BOOLEAN NOT NULL DEFAULT TRUE,
                dernier_essai TIMESTAMPTZ,
                dernier_statut INTEGER,
                echecs        INTEGER NOT NULL DEFAULT 0,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_webhooks_ws ON webhooks_sortants (workspace_id) WHERE actif;`);

        console.log("✅ Tables api_cles et webhooks_sortants prêtes.");
    } catch (err) {
        console.error("❌ Création tables API partenaires :", err.message);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
})();
