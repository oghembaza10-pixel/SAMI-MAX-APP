// ==========================================================================
// SAMII OS — LE SCHÉMA SE MET EN PLACE TOUT SEUL
//
// LE PROBLÈME, VÉCU. Une fonctionnalité était livrée, poussée, déployée — et
// la page restait morte. Pas parce que le code était faux : parce qu'un script
// de création de tables n'avait pas été lancé à la main sur le serveur. La
// page tombait alors en « Erreur de chargement », sans dire lequel des cinq
// scripts manquait. Vu de l'extérieur, le lien est simplement mort.
//
// C'est une classe entière de pannes, et elle ne se règle pas en se souvenant
// mieux : elle se règle en supprimant l'étape. Toutes les tables sont créées
// au démarrage, à chaque démarrage.
//
// POURQUOI C'EST SANS DANGER. Chaque instruction est en CREATE TABLE IF NOT
// EXISTS / CREATE INDEX IF NOT EXISTS / ADD COLUMN IF NOT EXISTS : relancée
// mille fois sur une base pleine, elle ne fait rien. Aucune donnée n'est
// touchée, aucune colonne supprimée, aucun type modifié.
//
// CE QU'ON N'AUTOMATISE PAS. Rien qui puisse détruire : pas de DROP, pas de
// ALTER de type, pas de renommage. Une migration destructrice reste un geste
// humain, lancé en connaissance de cause. Ce fichier ne sait qu'ajouter.
//
// SI ÇA ÉCHOUE, L'APPLICATION DÉMARRE QUAND MÊME. Une base momentanément
// injoignable ne doit pas empêcher le site de répondre : les pages qui ne
// dépendent pas d'elle doivent continuer à vivre. On journalise fort et on
// continue.
// ==========================================================================
const db = require("./db");

// Chaque entrée : un nom lisible dans les journaux, et les instructions à
// jouer dans l'ordre. Ajouter une table ici, c'est garantir qu'elle existera
// partout — développement, essai, production — sans rien lancer à la main.
const BLOCS = [
    {
        nom: "applications tierces",
        sql: [
            `CREATE TABLE IF NOT EXISTS apps (
                id                BIGSERIAL PRIMARY KEY,
                slug              TEXT NOT NULL UNIQUE,
                developpeur_id    BIGINT NOT NULL,
                nom               TEXT NOT NULL,
                description       TEXT NOT NULL DEFAULT '',
                url_site          TEXT,
                webhook_url       TEXT,
                portees_demandees TEXT[] NOT NULL DEFAULT '{}',
                statut            TEXT NOT NULL DEFAULT 'brouillon',
                created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
            `CREATE INDEX IF NOT EXISTS idx_apps_dev ON apps (developpeur_id)`,
            `CREATE INDEX IF NOT EXISTS idx_apps_statut ON apps (statut)`,
            `CREATE TABLE IF NOT EXISTS app_installations (
                id                BIGSERIAL PRIMARY KEY,
                app_id            BIGINT NOT NULL,
                workspace_id      TEXT NOT NULL,
                cle_id            BIGINT,
                portees_accordees TEXT[] NOT NULL DEFAULT '{}',
                actif             BOOLEAN NOT NULL DEFAULT TRUE,
                installee_le      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                revoquee_le       TIMESTAMPTZ,
                UNIQUE (app_id, workspace_id))`,
            `CREATE INDEX IF NOT EXISTS idx_install_ws ON app_installations (workspace_id) WHERE actif`,
            `CREATE INDEX IF NOT EXISTS idx_install_app ON app_installations (app_id)`,
        ],
    },
    {
        // Deux colonnes sur les espaces, et rien d'autre : un bac à sable est
        // un espace ordinaire. Lui donner ses propres tables aurait dupliqué
        // toute la logique métier — et un décor spécial ment toujours, tôt ou
        // tard, sur le comportement réel de la production.
        nom: "bac à sable",
        sql: [
            `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS est_bac_a_sable BOOLEAN NOT NULL DEFAULT FALSE`,
            `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS bac_decor TEXT`,
            `CREATE INDEX IF NOT EXISTS idx_ws_bac ON workspaces (owner) WHERE est_bac_a_sable`,
        ],
    },
    {
        nom: "API partenaires — clés, webhooks, journal",
        sql: [
            `CREATE TABLE IF NOT EXISTS api_cles (
                id             BIGSERIAL PRIMARY KEY,
                workspace_id   TEXT,
                agence_id      TEXT,
                nom            TEXT NOT NULL DEFAULT 'Clé API',
                cle_hash       TEXT NOT NULL UNIQUE,
                cle_prefixe    TEXT NOT NULL,
                actif          BOOLEAN NOT NULL DEFAULT TRUE,
                derniere_utilisation TIMESTAMPTZ,
                created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
            // Rattrapage : une première version ne connaissait que la portée
            // marchand. CREATE TABLE IF NOT EXISTS n'aurait rien corrigé.
            `ALTER TABLE api_cles ADD COLUMN IF NOT EXISTS agence_id TEXT`,
            `ALTER TABLE api_cles ALTER COLUMN workspace_id DROP NOT NULL`,
            // Sans valeur par défaut : un tableau vide DOIT vouloir dire
            // « clé d'avant le Policy Engine », donc accès complet — surtout
            // pas « clé sans aucun droit ».
            `ALTER TABLE api_cles ADD COLUMN IF NOT EXISTS portees TEXT[]`,
            `ALTER TABLE api_cles ADD COLUMN IF NOT EXISTS installation_id BIGINT`,
            `DO $$ BEGIN
                ALTER TABLE api_cles ADD CONSTRAINT api_cles_portee CHECK (
                    (workspace_id IS NOT NULL AND agence_id IS NULL)
                 OR (workspace_id IS NULL AND agence_id IS NOT NULL));
             EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
            `CREATE INDEX IF NOT EXISTS idx_api_cles_hash ON api_cles (cle_hash) WHERE actif`,
            `CREATE INDEX IF NOT EXISTS idx_api_cles_ws ON api_cles (workspace_id)`,
            `CREATE INDEX IF NOT EXISTS idx_api_cles_agence ON api_cles (agence_id)`,

            `CREATE TABLE IF NOT EXISTS webhooks_sortants (
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
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
            `ALTER TABLE webhooks_sortants ADD COLUMN IF NOT EXISTS agence_id TEXT`,
            `ALTER TABLE webhooks_sortants ALTER COLUMN workspace_id DROP NOT NULL`,
            `DO $$ BEGIN
                ALTER TABLE webhooks_sortants ADD CONSTRAINT webhooks_portee CHECK (
                    (workspace_id IS NOT NULL AND agence_id IS NULL)
                 OR (workspace_id IS NULL AND agence_id IS NOT NULL));
             EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
            `CREATE INDEX IF NOT EXISTS idx_webhooks_ws ON webhooks_sortants (workspace_id) WHERE actif`,
            `CREATE INDEX IF NOT EXISTS idx_webhooks_agence ON webhooks_sortants (agence_id) WHERE actif`,

            `CREATE TABLE IF NOT EXISTS api_journal (
                id           BIGSERIAL PRIMARY KEY,
                cle_id       BIGINT,
                workspace_id TEXT,
                agence_id    TEXT,
                methode      TEXT NOT NULL,
                chemin       TEXT NOT NULL,
                statut       INTEGER NOT NULL,
                portee       TEXT,
                refusee      BOOLEAN NOT NULL DEFAULT FALSE,
                ip           TEXT,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
            `CREATE INDEX IF NOT EXISTS idx_api_journal_ws ON api_journal (workspace_id, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_api_journal_cle ON api_journal (cle_id, created_at DESC)`,
        ],
    },
    {
        nom: "Académie — contrat et transactions",
        sql: [
            `CREATE TABLE IF NOT EXISTS academie_acceptations (
                id                SERIAL PRIMARY KEY,
                utilisateur_id    TEXT NOT NULL,
                role              TEXT NOT NULL,
                contrat_version   TEXT NOT NULL,
                empreinte_contrat TEXT NOT NULL,
                ip                TEXT,
                agent             TEXT,
                accepte_le        TIMESTAMPTZ NOT NULL DEFAULT now())`,
            `CREATE INDEX IF NOT EXISTS idx_academie_acceptations_user
                ON academie_acceptations (utilisateur_id, contrat_version)`,
            `CREATE TABLE IF NOT EXISTS academie_transactions (
                id              SERIAL PRIMARY KEY,
                reference       TEXT UNIQUE NOT NULL,
                type            TEXT NOT NULL,
                app_id          INTEGER,
                vendeur_id      TEXT NOT NULL,
                acheteur_id     TEXT NOT NULL,
                workspace_id    TEXT,
                montant_brut    NUMERIC(12,2) NOT NULL,
                devise          TEXT NOT NULL DEFAULT 'USD',
                taux_commission NUMERIC(6,4) NOT NULL,
                commission      NUMERIC(12,2) NOT NULL,
                net_vendeur     NUMERIC(12,2) NOT NULL,
                statut          TEXT NOT NULL DEFAULT 'en_attente',
                detail          TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                encaissee_le    TIMESTAMPTZ,
                reversee_le     TIMESTAMPTZ)`,
            `CREATE INDEX IF NOT EXISTS idx_academie_tx_vendeur ON academie_transactions (vendeur_id, statut)`,
            `CREATE INDEX IF NOT EXISTS idx_academie_tx_statut ON academie_transactions (statut, created_at DESC)`,
        ],
    },
    {
        nom: "portefeuille",
        sql: [
            `CREATE TABLE IF NOT EXISTS portefeuille_mouvements (
                id              BIGSERIAL PRIMARY KEY,
                operation       TEXT NOT NULL,
                compte          TEXT NOT NULL,
                poche           TEXT NOT NULL,
                sens            SMALLINT NOT NULL CHECK (sens IN (-1, 1)),
                montant         NUMERIC(14,2) NOT NULL CHECK (montant > 0),
                devise          TEXT NOT NULL,
                type            TEXT NOT NULL,
                transaction_ref TEXT,
                rail            TEXT,
                detail          TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now())`,
            `CREATE INDEX IF NOT EXISTS idx_pf_solde ON portefeuille_mouvements (compte, devise, poche)`,
            `CREATE INDEX IF NOT EXISTS idx_pf_operation ON portefeuille_mouvements (operation)`,
            `CREATE INDEX IF NOT EXISTS idx_pf_transaction ON portefeuille_mouvements (transaction_ref)`,
            `CREATE TABLE IF NOT EXISTS portefeuille_retraits (
                id          BIGSERIAL PRIMARY KEY,
                reference   TEXT UNIQUE NOT NULL,
                compte      TEXT NOT NULL,
                montant     NUMERIC(14,2) NOT NULL CHECK (montant > 0),
                devise      TEXT NOT NULL,
                rail        TEXT NOT NULL,
                destination TEXT,
                statut      TEXT NOT NULL DEFAULT 'demande',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                traite_le   TIMESTAMPTZ)`,
            `CREATE INDEX IF NOT EXISTS idx_pf_retraits_statut ON portefeuille_retraits (statut, created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_pf_retraits_compte ON portefeuille_retraits (compte)`,
        ],
    },
];

// Ces tables vivent dans le schéma public, exposé par PostgREST avec la clé
// publiable. Sans RLS, n'importe qui lirait les soldes, les clés et le chiffre
// d'affaires de chacun. On active le refus par défaut à chaque démarrage : une
// table créée ici ne doit jamais rester ouverte, même une minute.
const A_VERROUILLER = [
    "apps", "app_installations",
    "api_cles", "webhooks_sortants", "api_journal",
    "academie_acceptations", "academie_transactions",
    "portefeuille_mouvements", "portefeuille_retraits",
];

async function preparer() {
    let creees = 0;
    let echecs = 0;

    for (const bloc of BLOCS) {
        for (const sql of bloc.sql) {
            try {
                await db.query(sql);
                creees++;
            } catch (err) {
                echecs++;
                console.error(`❌ Schéma (${bloc.nom}) : ${err.message}`);
            }
        }
    }

    for (const table of A_VERROUILLER) {
        try {
            await db.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
        } catch (err) {
            // La table peut ne pas exister si son bloc a échoué : inutile de
            // crier deux fois pour la même cause.
            if (!/does not exist/i.test(err.message)) {
                console.warn(`⚠️ RLS (${table}) : ${err.message}`);
            }
        }
    }

    console.log(echecs === 0
        ? `✅ Schéma vérifié (${creees} instructions, ${A_VERROUILLER.length} tables protégées).`
        : `⚠️ Schéma vérifié avec ${echecs} échec(s) — voir ci-dessus.`);
    return { creees, echecs };
}

module.exports = { preparer, BLOCS, A_VERROUILLER };
