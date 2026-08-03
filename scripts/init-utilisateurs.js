const db = require("../services/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS utilisateurs (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                nom TEXT,
                prenom TEXT,
                email TEXT UNIQUE NOT NULL,
                telephone TEXT,
                password_hash TEXT NOT NULL,
                type_compte TEXT DEFAULT 'client',
                metier TEXT,
                role TEXT DEFAULT 'owner',
                statut_acces TEXT DEFAULT 'actif',
                email_verifie BOOLEAN DEFAULT false,
                token_verification TEXT,
                token_expire_le TIMESTAMP,
                token_reset_password TEXT,
                token_reset_expire_le TIMESTAMP,
                bio_vitrine TEXT,
                photo_profil_url TEXT,
                langue_preferee TEXT DEFAULT 'fr',
                pays TEXT,
                abonnement TEXT DEFAULT 'gratuit',
                grade_actuel TEXT DEFAULT 'Soldat',
                score_grade INTEGER DEFAULT 0,
                temps_total_minutes INTEGER DEFAULT 0,
                nb_achats INTEGER DEFAULT 0,
                nb_posts_valides INTEGER DEFAULT 0,
                code_parrainage TEXT,
                parraine_par TEXT,
                last_login DATE,
                actif BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Table utilisateurs créée avec succès.");
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
