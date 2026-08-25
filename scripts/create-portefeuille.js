// ==========================================================================
// SAMII OS — Tables du portefeuille
//
// Deux tables :
//
//   portefeuille_mouvements — le grand livre, en ajout seulement. Aucune ligne
//     n'est jamais modifiée ni supprimée : un solde se recalcule, il ne se
//     corrige pas. Une erreur se répare par une écriture inverse, comme en
//     comptabilité — c'est ce qui permet de raconter l'histoire d'un centime
//     six mois plus tard.
//
//   portefeuille_retraits — la file des versements à faire. Elle a un cycle de
//     vie (demandé → payé ou annulé), donc elle vit à part du grand livre, qui
//     lui est immuable.
//
// Lancer :  node scripts/create-portefeuille.js
// ==========================================================================
const db = require("../services/db");

(async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS portefeuille_mouvements (
                id              BIGSERIAL PRIMARY KEY,
                -- Toutes les lignes d'une même opération partagent cette
                -- référence : c'est par elle qu'on vérifie qu'elles s'équilibrent.
                operation       TEXT NOT NULL,
                -- Un identifiant de membre, ou EXTERIEUR (le monde du dehors),
                -- ou SAMII (la maison, qui reçoit les commissions).
                compte          TEXT NOT NULL,
                -- disponible | sequestre | retrait
                poche           TEXT NOT NULL,
                -- +1 crédit, -1 débit. La somme signée de la table vaut 0.
                sens            SMALLINT NOT NULL CHECK (sens IN (-1, 1)),
                montant         NUMERIC(14,2) NOT NULL CHECK (montant > 0),
                devise          TEXT NOT NULL,
                type            TEXT NOT NULL,
                transaction_ref TEXT,
                rail            TEXT,
                detail          TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        // Un solde est une somme filtrée sur (compte, devise, poche) : sans cet
        // index, chaque affichage de solde relit toute la table.
        await db.query(`CREATE INDEX IF NOT EXISTS idx_pf_solde ON portefeuille_mouvements (compte, devise, poche);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_pf_operation ON portefeuille_mouvements (operation);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_pf_transaction ON portefeuille_mouvements (transaction_ref);`);

        await db.query(`
            CREATE TABLE IF NOT EXISTS portefeuille_retraits (
                id          BIGSERIAL PRIMARY KEY,
                reference   TEXT UNIQUE NOT NULL,
                compte      TEXT NOT NULL,
                montant     NUMERIC(14,2) NOT NULL CHECK (montant > 0),
                devise      TEXT NOT NULL,
                -- ccp | mobile_money | virement | especes | carte (config/rails.js)
                rail        TEXT NOT NULL,
                -- Numéro de téléphone, CCP, IBAN… selon le rail. Jamais un secret.
                destination TEXT,
                statut      TEXT NOT NULL DEFAULT 'demande',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                traite_le   TIMESTAMPTZ
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_pf_retraits_statut ON portefeuille_retraits (statut, created_at);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_pf_retraits_compte ON portefeuille_retraits (compte);`);

        // Schéma public = exposé par PostgREST avec la clé publiable. Sans RLS,
        // n'importe qui lirait les soldes et les coordonnées de versement de
        // tout le monde. Refus par défaut.
        for (const table of ["portefeuille_mouvements", "portefeuille_retraits"]) {
            await db.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
        }

        // Contrôle immédiat : sur une base neuve la somme vaut 0, et le jour où
        // ce script est relancé sur une base vivante, il le confirme encore.
        const rows = await db.query(
            `SELECT COALESCE(SUM(sens * montant), 0) AS ecart FROM portefeuille_mouvements`,
        );
        const ecart = Number(rows[0]?.ecart || 0);
        console.log("✅ Tables portefeuille_mouvements et portefeuille_retraits prêtes (RLS activé).");
        console.log(ecart === 0
            ? "✅ Grand livre équilibré (somme signée = 0)."
            : `❌ DÉSÉQUILIBRE DE ${ecart} — ne plus encaisser tant que ce n'est pas expliqué.`);
        if (ecart !== 0) process.exitCode = 1;
    } catch (err) {
        console.error("❌ create-portefeuille :", err.message);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
})();
