// Active le statut "agence" sur un compte SAMII existant.
// Pas de formulaire d'inscription public pour ce statut — c'est OG
// Technology qui choisit ses partenaires, un par un, via ce script.
// Usage : node scripts/promouvoir-agence.js email@exemple.com
const db = require("../services/db");

async function run() {
    const email = process.argv[2];
    if (!email) {
        console.error("Usage : node scripts/promouvoir-agence.js email@exemple.com");
        process.exit(1);
    }

    try {
        const rows = await db.query(
            `UPDATE utilisateurs SET type_compte = 'agence' WHERE email = $1 RETURNING id, email, nom, prenom`,
            [email.trim().toLowerCase()]
        );
        if (!rows[0]) {
            console.error(`❌ Aucun compte trouvé pour ${email}. Le compte doit déjà exister (créé via /register).`);
        } else {
            console.log(`✅ ${rows[0].prenom || ""} ${rows[0].nom || ""} (${rows[0].email}) est maintenant un compte agence.`);
            console.log(`   Prochaine connexion → redirigé automatiquement vers /agence.`);
        }
    } catch (err) {
        console.error("❌", err.message);
    }
    process.exit(0);
}

run();
