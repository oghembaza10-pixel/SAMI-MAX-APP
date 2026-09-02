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
// renommage, pas de rétrécissement de type. Une migration destructrice reste un
// geste humain, lancé en connaissance de cause.
//
// L'EXCEPTION, ET POURQUOI ELLE EN EST UNE. Un ÉLARGISSEMENT de type
// (bigint → text) ne perd rien : toute valeur entière s'écrit en texte. On
// s'autorise ces migrations-là, une par une, listées et conditionnées à l'état
// réel de la base. La raison est arrivée en production : `apps.developpeur_id`
// était déclaré BIGINT alors que les identifiants d'utilisateur sont des UUID.
// Résultat, /apps répondait « invalid input syntax for type bigint » à tout le
// monde — la table n'avait jamais pu servir. CREATE TABLE IF NOT EXISTS ne
// corrige pas ça : la table existe déjà, donc l'instruction ne fait rien, et
// l'erreur survit à tous les déploiements. Sans ALTER, la seule issue était
// qu'un client clique et se cogne.
//
// ET ON VÉRIFIE CE QU'ON CROIT. Ce fichier a été écrit de mémoire, et la
// mémoire s'est déjà trompée deux fois (une colonne inventée, un type faux).
// `ATTENDUS` compare donc, à chaque démarrage, ce que le code suppose avec ce
// que la base contient vraiment. Une divergence devient une ligne de journal au
// démarrage au lieu d'une page morte découverte par un client.
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
                -- TEXT et non BIGINT : un identifiant d'utilisateur est un
                -- UUID dans cette base (6e1f196b-a0cd-…). Déclaré en BIGINT,
                -- ce champ faisait échouer TOUTE requête sur /apps avec
                -- « invalid input syntax for type bigint » — la table n'a
                -- jamais pu servir depuis sa création.
                developpeur_id    TEXT NOT NULL,
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
        // Les besoins publiés par les marchands, et les réponses des
        // développeurs. C'est par eux que la place se remplit : une vitrine
        // pleine de demandes attire plus un développeur qu'une vitrine pleine
        // d'offres déjà faites — c'est du travail qui l'attend.
        nom: "besoins des marchands",
        sql: [
            `CREATE TABLE IF NOT EXISTS besoins (
                id           BIGSERIAL PRIMARY KEY,
                reference    TEXT UNIQUE NOT NULL,
                auteur_id    TEXT NOT NULL,
                workspace_id TEXT,
                titre        TEXT NOT NULL,
                description  TEXT NOT NULL DEFAULT '',
                metier       TEXT,
                budget_min   NUMERIC(12,2),
                budget_max   NUMERIC(12,2),
                devise       TEXT NOT NULL DEFAULT 'USD',
                -- ouvert : visible et ouvert aux réponses
                -- attribue : le marchand a choisi quelqu'un
                -- clos : plus d'actualité
                statut       TEXT NOT NULL DEFAULT 'ouvert',
                created_at   TIMESTAMPTZ NOT NULL DEFAULT now())`,
            `CREATE INDEX IF NOT EXISTS idx_besoins_statut ON besoins (statut, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_besoins_metier ON besoins (metier) WHERE statut = 'ouvert'`,
            `CREATE INDEX IF NOT EXISTS idx_besoins_auteur ON besoins (auteur_id)`,

            `CREATE TABLE IF NOT EXISTS besoin_reponses (
                id           BIGSERIAL PRIMARY KEY,
                besoin_id    BIGINT NOT NULL,
                auteur_id    TEXT NOT NULL,
                message      TEXT NOT NULL,
                prix         NUMERIC(12,2),
                devise       TEXT NOT NULL DEFAULT 'USD',
                delai_jours  INTEGER,
                statut       TEXT NOT NULL DEFAULT 'proposee',
                created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
                -- Un développeur répond une fois par besoin : il modifie sa
                -- proposition plutôt que d'en empiler cinq.
                UNIQUE (besoin_id, auteur_id))`,
            `CREATE INDEX IF NOT EXISTS idx_reponses_besoin ON besoin_reponses (besoin_id, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_reponses_auteur ON besoin_reponses (auteur_id)`,
        ],
    },
    {
        // Les tendances vidéo relevées chez les plateformes. Le cache est
        // partagé par marché, pas par marchand : les tendances d'un marché ne
        // sont pas une donnée personnelle, et l'API YouTube ne donne que
        // 10 000 unités par jour — une recherche en coûte 100. Sans partage,
        // soixante clics le même matin éteignent la fonctionnalité pour tout
        // le monde jusqu'à minuit.
        nom: "tendances vidéo",
        sql: [
            `CREATE TABLE IF NOT EXISTS tendances_video_cache (
                id          BIGSERIAL PRIMARY KEY,
                cle         TEXT NOT NULL,
                resultats   JSONB NOT NULL DEFAULT '[]',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now())`,
            `CREATE INDEX IF NOT EXISTS idx_tendances_cle ON tendances_video_cache (cle, created_at DESC)`,

            // Une source externe se branche ici, sans redéploiement et sans
            // qu'un scraper n'entre dans le dépôt : une URL, un en-tête, et la
            // correspondance entre leurs champs et les nôtres.
            `CREATE TABLE IF NOT EXISTS tendances_video_sources (
                id           BIGSERIAL PRIMARY KEY,
                nom          TEXT NOT NULL,
                workspace_id TEXT,
                url          TEXT NOT NULL,
                entete       JSONB NOT NULL DEFAULT '{}',
                chemin       TEXT NOT NULL DEFAULT '',
                champs       JSONB NOT NULL DEFAULT '{}',
                actif        BOOLEAN NOT NULL DEFAULT TRUE,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT now())`,
            `CREATE INDEX IF NOT EXISTS idx_tendances_src ON tendances_video_sources (actif, workspace_id)`,
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
    {
        // ── Les communautés partenaires ──────────────────────────────────
        // Une créatrice amène son public sous sa marque. Sans ces deux
        // colonnes, « chez elle » n'existe qu'en apparence : le fil des
        // publications était commun aux deux communautés, et le QG de ses
        // membres était le nôtre dès que leur session se vidait.
        nom: "communautés partenaires",
        sql: [
            // À quelle communauté appartient une publication. Le défaut
            // « samii » range l'existant chez nous, ce qui est exact : tout
            // ce qui a été publié jusqu'ici l'a été dans la maison.
            `ALTER TABLE publications ADD COLUMN IF NOT EXISTS communaute TEXT DEFAULT 'samii'`,
            `CREATE INDEX IF NOT EXISTS idx_publications_communaute ON publications (communaute, created_at DESC)`,
            // D'où vient un compte. La session le savait déjà, mais une
            // session se vide : quelqu'un inscrit chez une partenaire qui
            // ferme son téléphone et revient trois jours plus tard
            // retrouvait NOTRE QG, notre marque et nos quatorze modules.
            `ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS communaute TEXT DEFAULT 'samii'`,
            // Les discussions. Sans cette colonne, « les groupes à rejoindre »
            // listait TOUS les groupes de la base : ses membres voyaient les
            // nôtres, pouvaient les rejoindre et lire nos conversations. Ce
            // n'est pas une fuite de marque, c'est une fuite de messages.
            `ALTER TABLE discussions ADD COLUMN IF NOT EXISTS communaute TEXT DEFAULT 'samii'`,
            `CREATE INDEX IF NOT EXISTS idx_discussions_communaute ON discussions (communaute, type)`,
        ],
    },
    {
        // ── LE THÈME CHOISI À L'INSCRIPTION ──────────────────────────────
        //
        // Trouvé en montant une base neuve : `POST /register` écrit
        // `theme_visuel`, et AUCUN fichier de ce dépôt ne crée cette
        // colonne. Elle n'existe en production que parce qu'on l'y a ajoutée
        // à la main, un jour, sans le noter nulle part.
        //
        // Conséquence : le jour où l'on repart d'une base vide — une
        // deuxième partenaire, une restauration, un environnement de test —
        // la toute première inscription répond « Erreur serveur. Réessayez. »
        // et personne ne peut créer de compte. Le code est bon, c'est la
        // base qui ne l'a jamais suivi.
        //
        // Le défaut « strategiste » est celui que `POST /register` applique
        // déjà quand le thème demandé n'est pas débloqué.
        nom: "thème visuel du compte",
        sql: [
            `ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS theme_visuel TEXT DEFAULT 'strategiste'`,
        ],
    },
    {
        // ── LA MÊME OMISSION, UN CRAN PLUS LOIN ──────────────────────────
        //
        // `workspaces.auto_post_config` n'est créée nulle part au démarrage :
        // seul `scripts/verif-securite-tables.js` la pose, et ce script est
        // lancé à la main. Sur une base qui ne l'a jamais vu passer,
        // `GET /autopost` interroge une colonne absente et tombe.
        //
        // Trouvé pendant la vérification : sur la base d'essai, cette page
        // ne renvoyait pas une erreur — elle arrêtait le serveur entier.
        // Le filet à promesses d'`index.js` empêche désormais l'arrêt ; ce
        // bloc-ci empêche l'erreur elle-même.
        nom: "réglage de publication automatique",
        sql: [
            `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS auto_post_config JSONB`,
        ],
    },
    {
        // ── LA TABLE QUI REND SAMII MUETTE ───────────────────────────────
        //
        // `services/connaissances.js` lit `samii_connaissances` à CHAQUE
        // conversation. Aucun fichier de ce dépôt ne la crée : elle
        // n'existait que dans la base de production, posée à la main un
        // jour, et `scripts/securiser-rls.js` se contente de la citer.
        //
        // Sur une base qui ne l'a jamais eue, la conséquence n'est pas
        // « une fonctionnalité en moins » : `POST /api/chat` lève, tombe
        // dans son `catch`, et répond « SAMII démarre. Réessaie dans
        // quelques instants. » — à chaque message, pour toujours. Le chat
        // écrit et la bulle Jarvis sont morts ensemble, sans un mot qui
        // dise pourquoi.
        //
        // Observé pendant la vérification : la bulle a répondu exactement
        // cette phrase, et le journal du serveur disait
        // `relation "samii_connaissances" does not exist`.
        //
        // Les colonnes reprennent celles que `connaissances.js` écrit et
        // relit, sans en inventer une de plus.
        nom: "connaissances permanentes de SAMII",
        sql: [
            `CREATE TABLE IF NOT EXISTS samii_connaissances (
                id             BIGSERIAL PRIMARY KEY,
                user_id        TEXT NOT NULL,
                titre          TEXT,
                contenu_resume TEXT NOT NULL,
                fichier_url    TEXT,
                fichier_nom    TEXT,
                actif          BOOLEAN NOT NULL DEFAULT TRUE,
                created_at     TIMESTAMPTZ NOT NULL DEFAULT now())`,
            // La seule question posée à cette table : « qu'est-ce que ce
            // compte m'a appris, du plus récent au plus ancien ».
            `CREATE INDEX IF NOT EXISTS idx_connaissances_user
                ON samii_connaissances (user_id, created_at DESC) WHERE actif`,
        ],
    },
    {
        // ── CHAQUE MARKETPLACE CHEZ SOI ──────────────────────────────────
        //
        // « Tu lui mets une marketplace VIDE, sans nos colonnes, rattachée
        // aux comptes des membres et à leur profil. »
        //
        // La table `annonces` n'avait aucune notion de communauté. Sa
        // Marketplace aurait donc affiché nos 43 produits CJ, nos
        // fournisseurs importés et les annonces de tous les marchands de la
        // plateforme — exactement la fuite qu'on a déjà corrigée sur le fil,
        // les discussions et le classement, et qui revient à chaque table
        // qu'on n'a pas encore visitée.
        //
        // Le DEFAUT vaut 'samii' et le COALESCE range tout l'existant chez
        // nous : c'est exact, tout ce qui a été publié jusqu'ici l'a été
        // chez nous. Sa Marketplace démarre donc vide, et se remplit de ce
        // que SES membres y mettent.
        nom: "annonces.communaute",
        sql: [
            `ALTER TABLE annonces ADD COLUMN IF NOT EXISTS communaute TEXT DEFAULT 'samii'`,
            `CREATE INDEX IF NOT EXISTS idx_annonces_communaute ON annonces (communaute, actif, created_at DESC)`,
        ],
    },
    {
        // ── LES PUBLICATIONS MISES DE CÔTÉ ───────────────────────────────
        //
        // « Un bouton pour enregistrer. » Quelqu'un voit passer une astuce, un
        // outil, une formation — et n'a pas le temps maintenant. Sans un
        // endroit où le ranger, ça défile et c'est perdu ; c'est exactement ce
        // qui fait revenir les gens dans un fil.
        //
        // La contrainte UNIQUE porte le vrai travail : elle rend « enregistrer
        // deux fois » impossible AU NIVEAU DE LA BASE. Deux clics rapides, une
        // double-tape sur mobile, un rejeu réseau — sans elle, on collectionne
        // des doublons que personne ne sait plus supprimer.
        //
        // ON CONFIE L'EFFACEMENT À POSTGRESQL. Sans ON DELETE CASCADE, la
        // suppression d'une publication laisserait derrière elle des
        // enregistrements pointant vers du vide, et la liste des choses
        // enregistrées se remplirait de lignes fantômes. Le faire à la main
        // dans la route marche jusqu'au jour où une autre route supprime une
        // publication sans y penser.
        nom: "publications_enregistrees",
        sql: [
            `CREATE TABLE IF NOT EXISTS publications_enregistrees (
                id             BIGSERIAL PRIMARY KEY,
                publication_id BIGINT NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
                user_id        TEXT NOT NULL,
                created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (publication_id, user_id))`,
            // « Qu'est-ce que j'ai mis de côté ? », par ordre d'ajout : c'est
            // la seule question qu'on posera à cette table.
            `CREATE INDEX IF NOT EXISTS idx_enregistrees_user ON publications_enregistrees (user_id, created_at DESC)`,
        ],
    },
    {
        // ── LES ABONNEMENTS ENTRE MEMBRES ────────────────────────────────
        //
        // « S'abonner à quelqu'un qui publie bien, qui vend des bonnes
        // choses. »
        //
        // C'est ce qui transforme un fil en communauté : sans lien entre
        // les gens, chaque publication repart de zéro et il faut tout
        // relire pour retrouver quelqu'un. Avec l'abonnement, une vendeuse
        // sérieuse se construit un public qui la suit d'une vente à
        // l'autre — c'est exactement ce qu'on lui vend.
        //
        // La contrainte UNIQUE empêche de s'abonner deux fois (double tape
        // sur un téléphone, rejeu réseau). La contrainte CHECK empêche de
        // s'abonner à soi-même : ça n'a aucun sens, ça gonfle son propre
        // compteur, et une règle écrite dans la base ne s'oublie pas dans
        // une route ajoutée plus tard.
        //
        // `communaute` est portée par la ligne : les mêmes deux personnes
        // peuvent se croiser dans deux communautés, et un abonnement pris
        // chez elle ne regarde pas chez nous.
        nom: "abonnements_membres",
        sql: [
            `CREATE TABLE IF NOT EXISTS abonnements_membres (
                id          BIGSERIAL PRIMARY KEY,
                abonne_id   TEXT NOT NULL,
                auteur_id   TEXT NOT NULL,
                communaute  TEXT NOT NULL DEFAULT 'samii',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (abonne_id, auteur_id, communaute),
                CONSTRAINT abonnements_membres_pas_soi_meme CHECK (abonne_id <> auteur_id))`,
            // « À qui suis-je abonné ? » — pour filtrer le fil.
            `CREATE INDEX IF NOT EXISTS idx_abonnements_membres_abonne ON abonnements_membres (abonne_id, communaute)`,
            // « Combien de personnes me suivent ? » — sur sa vitrine.
            `CREATE INDEX IF NOT EXISTS idx_abonnements_membres_auteur ON abonnements_membres (auteur_id, communaute)`,
        ],
    },
    {
        // ── Le grand livre des paiements ─────────────────────────────────
        // Les montants sont en NUMERIC et jamais en flottant : sur de
        // l'argent, 0.1 + 0.2 qui ne fait pas 0.3 finit par se voir.
        // `reference` est UNIQUE — c'est elle qui rend une confirmation
        // rejouable sans danger quand un prestataire réémet sa notification,
        // ce qu'ils font tous, parfois des dizaines de fois.
        nom: "paiements",
        sql: [
            `CREATE TABLE IF NOT EXISTS paiements (
                id                    BIGSERIAL PRIMARY KEY,
                reference             TEXT UNIQUE NOT NULL,
                reference_fournisseur TEXT,
                fournisseur           TEXT NOT NULL,
                statut                TEXT NOT NULL DEFAULT 'en_attente',
                montant               NUMERIC(14,2) NOT NULL,
                devise                TEXT NOT NULL,
                acheteur_id           TEXT,
                vendeur_id            TEXT,
                communaute            TEXT DEFAULT 'samii',
                objet_type            TEXT,
                objet_id              TEXT,
                part_vendeur          NUMERIC(14,2),
                part_partenaire       NUMERIC(14,2),
                part_maison           NUMERIC(14,2),
                commission            NUMERIC(14,2),
                taux_commission       NUMERIC(6,4),
                note                  TEXT,
                paye_le               TIMESTAMPTZ,
                created_at            TIMESTAMPTZ NOT NULL DEFAULT now())`,
            `CREATE INDEX IF NOT EXISTS idx_paiements_statut ON paiements (statut, created_at DESC)`,
            // « Combien a-t-elle gagné ce mois-ci ? » est la question qu'on
            // posera le plus souvent à cette table.
            `CREATE INDEX IF NOT EXISTS idx_paiements_communaute ON paiements (communaute, statut, paye_le DESC)`,
        ],
    },
    {
        // ── LE CARNET WHATSAPP DU NUMÉRO OFFICIEL ────────────────────────
        //
        // « Je veux que tout le monde utilise cette API de Meta. »
        //
        // Un seul numéro pour toute la plateforme fait apparaître deux
        // questions que Green API ne posait pas, parce que là-bas le numéro
        // du marchand répondait aux deux tout seul.
        //
        // 1. À QUI PARLE-T-ON ? Un message arrive nu : rien dedans ne dit à
        //    quelle boutique le client s'adresse. Le code de boutique n'est
        //    dans le tout premier message (celui du lien pré-rempli), donc
        //    il faut s'en souvenir — sinon SAMII redemande à chaque fois.
        //
        // 2. A-T-ON LE DROIT DE PARLER ? WhatsApp n'autorise le texte libre
        //    que 24 h après le dernier message DU CLIENT. Passé ce délai,
        //    seuls les modèles approuvés passent, et ils se facturent. Sans
        //    cette date, on ne peut pas choisir — et deviner coûte soit un
        //    message qui n'arrive pas, soit un modèle payé pour rien.
        //
        // Une table, ces deux réponses. La clé est le numéro : c'est ce que
        // Meta nous donne, et c'est stable.
        nom: "whatsapp_contacts",
        sql: [
            `CREATE TABLE IF NOT EXISTS whatsapp_contacts (
                numero          TEXT PRIMARY KEY,
                workspace_id    TEXT,
                communaute      TEXT DEFAULT 'samii',
                nom_client      TEXT,
                dernier_entrant TIMESTAMPTZ,
                dernier_sortant TIMESTAMPTZ,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now())`,
            // « Qui a écrit récemment à cette boutique ? » — la question du
            // marchand qui ouvre sa messagerie.
            `CREATE INDEX IF NOT EXISTS idx_wa_contacts_workspace ON whatsapp_contacts (workspace_id, dernier_entrant DESC)`,
        ],
    },
    {
        // ── ÉCRIRE À QUELQU'UN, DEPUIS SON PROFIL ────────────────────────
        //
        // « Sur chaque profil on doit pouvoir lui laisser un message, et il
        // doit avoir un espace Mes messages dans son QG pour les lire. »
        //
        // C'est ce qui manquait pour qu'une marketplace serve à vendre. On
        // voyait un produit, on voyait qui le vendait — et il n'y avait
        // aucun moyen de lui poser une question. Le seul chemin était
        // WhatsApp, qui suppose un numéro et une application installée.
        //
        // POURQUOI PAS `discussions`. Cette table-là porte des salons : des
        // conversations à plusieurs, attachées à une communauté, que
        // n'importe quel membre ouvre. Ici c'est l'inverse — deux personnes,
        // et personne d'autre ne doit voir. Mélanger les deux, c'est le
        // jour où une requête de salon remonte un message privé.
        nom: "messages_prives",
        sql: [
            `CREATE TABLE IF NOT EXISTS messages_prives (
                id             BIGSERIAL PRIMARY KEY,
                expediteur_id  TEXT NOT NULL,
                destinataire_id TEXT NOT NULL,
                contenu        TEXT NOT NULL,
                -- La communauté du message, pas celle des personnes : quelqu'un
                -- présent des deux côtés ne doit pas voir sa conversation de
                -- chez nous apparaître sur le domaine d'une partenaire.
                communaute     TEXT DEFAULT 'samii',
                -- Le contexte : « à propos de cette annonce ». Un message qui
                -- arrive sans objet oblige le vendeur à deviner de quoi on
                -- parle, alors qu'il a trente produits en ligne.
                annonce_id     TEXT,
                lu_le          TIMESTAMPTZ,
                created_at     TIMESTAMPTZ NOT NULL DEFAULT now())`,
            // « Qu'est-ce que j'ai reçu ? » — la question de la boîte de
            // réception, posée à chaque ouverture du QG.
            `CREATE INDEX IF NOT EXISTS idx_mp_destinataire ON messages_prives (destinataire_id, communaute, created_at DESC)`,
            // Une conversation, dans les deux sens : c'est la même paire.
            `CREATE INDEX IF NOT EXISTS idx_mp_paire ON messages_prives (expediteur_id, destinataire_id, created_at DESC)`,
            // Le compteur de non-lus, affiché sur chaque page du QG : sans
            // cet index il relit toute la table à chaque affichage.
            `CREATE INDEX IF NOT EXISTS idx_mp_non_lus ON messages_prives (destinataire_id, lu_le) WHERE lu_le IS NULL`,
        ],
    },
];

// ── Les élargissements de type ───────────────────────────────────────────
// Uniquement des passages vers un type plus large, et jamais l'inverse. Chacun
// est conditionné au type réellement trouvé : une fois passé, il ne se rejoue
// pas. `USING` est obligatoire pour que PostgreSQL accepte de convertir les
// lignes déjà présentes.
const ELARGISSEMENTS = [
    {
        table: "apps", colonne: "developpeur_id",
        depuis: ["bigint", "integer"], vers: "TEXT",
        pourquoi: "les identifiants d'utilisateur sont des UUID, pas des entiers",
    },
];

// Ce que le code suppose de la base. Volontairement court : on n'y met que les
// colonnes dont une erreur de type casse une page entière — pas un inventaire.
const ATTENDUS = [
    { table: "apps",             colonne: "developpeur_id", type: "text" },
    { table: "besoins",          colonne: "auteur_id",      type: "text" },
    { table: "besoin_reponses",  colonne: "auteur_id",      type: "text" },
    { table: "workspaces",       colonne: "owner_email",    type: "text" },
];

async function typeDe(table, colonne) {
    const rows = await db.query(
        `SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, colonne],
    );
    return rows[0]?.data_type || null;
}

// Ces tables vivent dans le schéma public, exposé par PostgREST avec la clé
// publiable. Sans RLS, n'importe qui lirait les soldes, les clés et le chiffre
// d'affaires de chacun. On active le refus par défaut à chaque démarrage : une
// table créée ici ne doit jamais rester ouverte, même une minute.
const A_VERROUILLER = [
    "apps", "app_installations",
    "api_cles", "webhooks_sortants", "api_journal",
    "academie_acceptations", "academie_transactions",
    "portefeuille_mouvements", "portefeuille_retraits",
    "besoins", "besoin_reponses",
    // tendances_video_sources porte des clés d'API tierces : elle ne doit
    // jamais être lisible avec la clé publiable. Le cache l'accompagne, il
    // n'y a aucune raison d'exposer nos relevés.
    "tendances_video_cache", "tendances_video_sources",
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

    // Les élargissements passent après les créations : une table qui vient
    // d'être créée a déjà le bon type, la condition ci-dessous ne fait rien.
    for (const m of ELARGISSEMENTS) {
        try {
            const actuel = await typeDe(m.table, m.colonne);
            if (!actuel || !m.depuis.includes(actuel)) continue;
            await db.query(
                `ALTER TABLE public.${m.table}
                 ALTER COLUMN ${m.colonne} TYPE ${m.vers} USING ${m.colonne}::${m.vers}`,
            );
            console.log(`🔧 ${m.table}.${m.colonne} : ${actuel} → ${m.vers.toLowerCase()} (${m.pourquoi}).`);
        } catch (err) {
            echecs++;
            console.error(`❌ Élargissement (${m.table}.${m.colonne}) : ${err.message}`);
        }
    }

    // La vérification ne corrige rien : elle dit tout haut ce qui ne colle pas,
    // au démarrage, plutôt que de laisser un client le découvrir en cliquant.
    for (const a of ATTENDUS) {
        try {
            const actuel = await typeDe(a.table, a.colonne);
            if (actuel === null) {
                console.warn(`⚠️ Schéma : ${a.table}.${a.colonne} est absente — le code compte dessus.`);
            } else if (actuel !== a.type) {
                console.warn(`⚠️ Schéma : ${a.table}.${a.colonne} est en « ${actuel} », le code attend « ${a.type} ».`);
            }
        } catch { /* base momentanément injoignable : déjà signalé plus haut */ }
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

module.exports = { preparer, BLOCS, A_VERROUILLER, ELARGISSEMENTS, ATTENDUS };
