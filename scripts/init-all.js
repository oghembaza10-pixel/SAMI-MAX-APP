const db = require("../services/db");

async function run() {
    try {
        // ── COMMANDES (déjà créée, on garde) ──
        await db.query(`
            CREATE TABLE IF NOT EXISTS commandes (
                id TEXT PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                nom_client TEXT,
                telephone TEXT,
                adresse TEXT,
                produit TEXT,
                montant NUMERIC DEFAULT 0,
                statut TEXT DEFAULT 'en attente',
                source TEXT DEFAULT 'telegram',
                numero_suivi TEXT,
                transporteur TEXT,
                dernier_statut_suivi TEXT,
                date_commande TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── CLIENTS (historique client par marchand) ──
        await db.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT REFERENCES workspaces(id),
                nom TEXT,
                telephone TEXT,
                total_commandes INTEGER DEFAULT 0,
                total_depense NUMERIC DEFAULT 0,
                statut TEXT DEFAULT 'normal',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── SERVICES (livraison, garde, prestations) ──
        await db.query(`
            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                type_service TEXT NOT NULL,
                nom_prestataire TEXT NOT NULL,
                telephone TEXT,
                ville TEXT,
                pays TEXT,
                tarif TEXT,
                description TEXT,
                email_prestataire TEXT,
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── EMPLOIS ──
        await db.query(`
            CREATE TABLE IF NOT EXISTS emplois (
                id SERIAL PRIMARY KEY,
                titre_poste TEXT NOT NULL,
                type_contrat TEXT,
                entreprise_nom TEXT,
                ville TEXT,
                pays TEXT,
                salaire TEXT,
                description TEXT,
                contact_telephone TEXT,
                contact_email TEXT,
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── ANNONCES (Marketplace) ──
        await db.query(`
            CREATE TABLE IF NOT EXISTS annonces (
                id SERIAL PRIMARY KEY,
                titre TEXT NOT NULL,
                categorie TEXT,
                description TEXT,
                prix TEXT,
                photo_url TEXT,
                photos_urls TEXT,
                caracteristiques TEXT,
                type_vendeur TEXT,
                vendeur_id TEXT,
                vendeur_nom TEXT,
                ville TEXT,
                pays TEXT,
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── CONNECTEURS (Telegram, WhatsApp, réseaux liés à un workspace ou user) ──
        await db.query(`
            CREATE TABLE IF NOT EXISTS connecteurs (
                id SERIAL PRIMARY KEY,
                workspace_id TEXT,
                user_id TEXT,
                type TEXT NOT NULL,
                config TEXT,
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── PRODUITS FAVORIS (Marketplace, côté client) ──
        await db.query(`
            CREATE TABLE IF NOT EXISTS favoris (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES utilisateurs(id),
                annonce_id INTEGER REFERENCES annonces(id),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── LOGS / JOURNAL (traçabilité globale) ──
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

        console.log("✅ Toutes les tables créées avec succès : commandes, clients, services, emplois, annonces, connecteurs, favoris, journal.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
