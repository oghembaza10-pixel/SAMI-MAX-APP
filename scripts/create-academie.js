// ==========================================================================
// SAMII OS — Tables de l'Académie : la porte et le registre
//
// Deux tables, deux rôles bien séparés :
//
//   academie_acceptations — le journal de qui a accepté quoi, et quand. En
//     ajout seulement : on n'écrase JAMAIS une acceptation passée. Le jour où
//     quelqu'un conteste une commission, la seule défense est de pouvoir
//     montrer le texte exact qu'il a coché, à la seconde près. D'où
//     l'empreinte du contrat stockée avec — pas seulement son numéro de
//     version, qui ne prouve rien si le texte a bougé depuis.
//
//   academie_transactions — le registre des sommes. Le taux y est figé ligne
//     par ligne : changer la commission demain ne doit pas réécrire ce qui a
//     été conclu hier.
//
// Lancer :  node scripts/create-academie.js
// ==========================================================================
const db = require("../services/db");

(async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS academie_acceptations (
                id                SERIAL PRIMARY KEY,
                utilisateur_id    TEXT NOT NULL,
                role              TEXT NOT NULL,
                contrat_version   TEXT NOT NULL,
                -- SHA-256 du texte exact accepté : une version peut être
                -- republiée par erreur, une empreinte ne ment pas.
                empreinte_contrat TEXT NOT NULL,
                ip                TEXT,
                agent             TEXT,
                accepte_le        TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_academie_acceptations_user
                        ON academie_acceptations (utilisateur_id, contrat_version);`);

        await db.query(`
            CREATE TABLE IF NOT EXISTS academie_transactions (
                id              SERIAL PRIMARY KEY,
                reference       TEXT UNIQUE NOT NULL,
                type            TEXT NOT NULL,
                app_id          INTEGER,
                vendeur_id      TEXT NOT NULL,
                acheteur_id     TEXT NOT NULL,
                workspace_id    TEXT,
                montant_brut    NUMERIC(12,2) NOT NULL,
                devise          TEXT NOT NULL DEFAULT 'USD',
                -- Figé à la création : voir config/academie.js.
                taux_commission NUMERIC(6,4) NOT NULL,
                commission      NUMERIC(12,2) NOT NULL,
                net_vendeur     NUMERIC(12,2) NOT NULL,
                -- en_attente : conclu, pas encore encaissé
                -- encaissee   : l'argent est arrivé, la commission est due
                -- reversee    : le vendeur a été payé de sa part
                -- annulee / remboursee : aucune commission n'est due
                statut          TEXT NOT NULL DEFAULT 'en_attente',
                detail          TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                encaissee_le    TIMESTAMPTZ,
                reversee_le     TIMESTAMPTZ
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_academie_tx_vendeur ON academie_transactions (vendeur_id, statut);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_academie_tx_statut  ON academie_transactions (statut, created_at DESC);`);

        // Ces deux tables vivent dans le schéma public, donc exposées par
        // PostgREST avec la clé publiable : sans RLS, n'importe qui lirait le
        // chiffre d'affaires de chaque développeur. Refus par défaut, comme
        // partout ailleurs (voir scripts/securiser-rls.js).
        for (const table of ["academie_acceptations", "academie_transactions"]) {
            await db.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
        }

        console.log("✅ Tables academie_acceptations et academie_transactions prêtes (RLS activé).");
    } catch (err) {
        console.error("❌ create-academie :", err.message);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
})();
