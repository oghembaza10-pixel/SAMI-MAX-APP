const db = require("../services/db");

async function run() {
    try {
        // ═══════════════════════════════════════════════
        // COMMERCE — pensé multi-devise, multi-pays dès le départ
        // ═══════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS commandes (
                id TEXT PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                nom_client TEXT,
                telephone TEXT,
                adresse TEXT,
                pays TEXT,
                ville TEXT,
                produit TEXT,
                montant NUMERIC DEFAULT 0,
                devise TEXT DEFAULT 'DZD',
                statut TEXT DEFAULT 'en attente',
                source TEXT DEFAULT 'telegram',
                canal_origine TEXT,
                numero_suivi TEXT,
                transporteur TEXT,
                dernier_statut_suivi TEXT,
                date_commande TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                nom TEXT,
                telephone TEXT,
                pays TEXT,
                ville TEXT,
                total_commandes INTEGER DEFAULT 0,
                total_depense NUMERIC DEFAULT 0,
                devise TEXT DEFAULT 'DZD',
                statut TEXT DEFAULT 'normal',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS produits_variantes (
                id SERIAL PRIMARY KEY,
                produit_id INTEGER REFERENCES produits(id),
                taille TEXT,
                couleur TEXT,
                stock INTEGER DEFAULT 0,
                prix_override NUMERIC
            );
        `);

        // ═══════════════════════════════════════════════
        // ÉCOSYSTÈME CLIENT — Services, Emplois, Marketplace
        // ═══════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                type_service TEXT NOT NULL,
                nom_prestataire TEXT NOT NULL,
                prestataire_id TEXT REFERENCES utilisateurs(id),
                telephone TEXT,
                ville TEXT,
                pays TEXT,
                tarif TEXT,
                devise TEXT DEFAULT 'DZD',
                description TEXT,
                email_prestataire TEXT,
                note_moyenne NUMERIC DEFAULT 0,
                nb_avis INTEGER DEFAULT 0,
                identite_verifiee BOOLEAN DEFAULT false,
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS emplois (
                id SERIAL PRIMARY KEY,
                titre_poste TEXT NOT NULL,
                type_contrat TEXT,
                entreprise_nom TEXT,
                publicateur_id TEXT REFERENCES utilisateurs(id),
                ville TEXT,
                pays TEXT,
                salaire TEXT,
                devise TEXT DEFAULT 'DZD',
                description TEXT,
                contact_telephone TEXT,
                contact_email TEXT,
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS candidatures (
                id SERIAL PRIMARY KEY,
                emploi_id INTEGER REFERENCES emplois(id),
                candidat_id TEXT REFERENCES utilisateurs(id),
                message TEXT,
                statut TEXT DEFAULT 'en_attente',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS annonces (
                id SERIAL PRIMARY KEY,
                titre TEXT NOT NULL,
                categorie TEXT,
                region_fournisseur TEXT,
                description TEXT,
                prix TEXT,
                devise TEXT DEFAULT 'DZD',
                photo_url TEXT,
                photos_urls TEXT,
                caracteristiques TEXT,
                type_vendeur TEXT,
                vendeur_id TEXT,
                vendeur_nom TEXT,
                ville TEXT,
                pays TEXT,
                vues INTEGER DEFAULT 0,
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS avis (
                id SERIAL PRIMARY KEY,
                cible_type TEXT NOT NULL,
                cible_id TEXT NOT NULL,
                auteur_id TEXT REFERENCES utilisateurs(id),
                note INTEGER CHECK (note BETWEEN 1 AND 5),
                commentaire TEXT,
                photo_url TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ═══════════════════════════════════════════════
        // CONNECTEURS — universel, tous canaux/plateformes
        // ═══════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS connecteurs (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT,
                user_id TEXT,
                type TEXT NOT NULL,
                plateforme TEXT,
                config TEXT,
                mode TEXT DEFAULT 'reel',
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ═══════════════════════════════════════════════
        // ENGAGEMENT — favoris, notifications, historique SAMII
        // ═══════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS favoris (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES utilisateurs(id),
                annonce_id INTEGER REFERENCES annonces(id),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES utilisateurs(id),
                titre TEXT,
                message TEXT,
                type TEXT,
                lu BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS samii_interactions (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES utilisateurs(id),
                type TEXT,
                contenu TEXT,
                source TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ═══════════════════════════════════════════════
        // SYSTÈME — abonnements, transactions, journal
        // ═══════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS abonnements (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES utilisateurs(id),
                type TEXT,
                statut TEXT DEFAULT 'actif',
                methode_paiement TEXT,
                montant NUMERIC,
                devise TEXT DEFAULT 'DZD',
                date_debut TIMESTAMP DEFAULT NOW(),
                date_fin TIMESTAMP
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES utilisateurs(id),
                type TEXT,
                montant NUMERIC,
                devise TEXT DEFAULT 'DZD',
                methode TEXT,
                statut TEXT DEFAULT 'en_attente',
                reference TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS journal (
                id SERIAL PRIMARY KEY,
                action TEXT,
                details TEXT,
                workspace_id TEXT,
                user_id TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log("✅ Fondation complète créée : commandes, clients, variantes, services, emplois, candidatures, annonces, avis, connecteurs, favoris, notifications, samii_interactions, abonnements, transactions, journal.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
