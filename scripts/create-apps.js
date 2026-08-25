// ==========================================================================
// SAMII OS — APPLICATIONS TIERCES
//
// Ce que ça change par rapport à une clé API remise à la main : l'application
// DÉCLARE ce dont elle a besoin, le marchand APPROUVE en connaissance de
// cause, et il RÉVOQUE en un clic. La clé n'est plus un secret qu'on se passe
// entre deux personnes, c'est le résultat d'un consentement traçable.
//
// Lancer une seule fois :  node scripts/create-apps.js
// ==========================================================================
const db = require("../services/db");

(async () => {
    try {
        // Une application appartient à un utilisateur SAMII — le développeur.
        // Pas de compte développeur séparé : quiconque a un compte peut
        // publier, la barrière est la revue, pas l'inscription.
        await db.query(`
            CREATE TABLE IF NOT EXISTS apps (
                id                BIGSERIAL PRIMARY KEY,
                slug              TEXT NOT NULL UNIQUE,
                developpeur_id    TEXT NOT NULL,   -- UUID : voir services/schema.js
                nom               TEXT NOT NULL,
                description       TEXT NOT NULL DEFAULT '',
                url_site          TEXT,
                webhook_url       TEXT,
                portees_demandees TEXT[] NOT NULL DEFAULT '{}',
                -- brouillon : visible du seul développeur, installable par lui
                --             pour ses propres essais ;
                -- publiee   : visible de tous les marchands ;
                -- suspendue : plus installable, installations existantes coupées.
                statut            TEXT NOT NULL DEFAULT 'brouillon',
                created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_apps_dev ON apps (developpeur_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_apps_statut ON apps (statut);`);

        // Une installation lie une application à UN espace, avec la clé créée
        // au moment de l'approbation. Révoquer l'installation révoque la clé :
        // le marchand n'a jamais à comprendre ce qu'est une clé pour reprendre
        // ce qu'il a donné.
        await db.query(`
            CREATE TABLE IF NOT EXISTS app_installations (
                id                BIGSERIAL PRIMARY KEY,
                app_id            BIGINT NOT NULL,
                workspace_id      TEXT NOT NULL,
                cle_id            BIGINT,
                portees_accordees TEXT[] NOT NULL DEFAULT '{}',
                actif             BOOLEAN NOT NULL DEFAULT TRUE,
                installee_le      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                revoquee_le       TIMESTAMPTZ,
                UNIQUE (app_id, workspace_id)
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_install_ws ON app_installations (workspace_id) WHERE actif;`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_install_app ON app_installations (app_id);`);

        // Lien retour : savoir qu'une clé appartient à une installation permet
        // de l'afficher comme telle au marchand (« clé de l'app Untel »)
        // plutôt que comme une clé anonyme qu'il n'ose pas révoquer.
        await db.query(`ALTER TABLE api_cles ADD COLUMN IF NOT EXISTS installation_id BIGINT;`);

        console.log("✅ Tables apps et app_installations prêtes.");
    } catch (err) {
        console.error("❌ Création tables apps :", err.message);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
})();
