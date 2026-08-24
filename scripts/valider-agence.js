// ==========================================================================
// Valide un compte agence auto-inscrit : lève le verrou qui l'empêche de
// créer les espaces de ses clients (voir routes/agence.js).
//
//   node scripts/valider-agence.js email@agence.com
//
// Sans argument, liste les agences en attente de validation.
// ==========================================================================
const db = require("../services/db");

(async () => {
    const email = (process.argv[2] || "").trim().toLowerCase();

    try {
        if (!email) {
            const attente = await db.query(
                `SELECT email, nom, prenom, created_at
                   FROM utilisateurs
                  WHERE type_compte = 'agence' AND statut_acces = 'agence_en_validation'
                  ORDER BY created_at DESC`
            );
            if (!attente.length) {
                console.log("✅ Aucune agence en attente de validation.");
            } else {
                console.log(`⏳ ${attente.length} agence(s) en attente :\n`);
                attente.forEach(a => {
                    const date = a.created_at ? new Date(a.created_at).toLocaleString("fr-FR") : "";
                    console.log(`   • ${a.email}  —  ${a.prenom || ""} ${a.nom || ""}  (inscrite le ${date})`);
                });
                console.log(`\nPour en valider une :\n   node scripts/valider-agence.js <email>`);
            }
            return;
        }

        const rows = await db.query(
            `UPDATE utilisateurs
                SET statut_acces = 'actif'
              WHERE email = $1 AND type_compte = 'agence'
              RETURNING id, email, nom, prenom, statut_acces`,
            [email]
        );

        if (!rows.length) {
            console.error(`❌ Aucun compte AGENCE trouvé pour ${email}.`);
            console.error("   (Vérifie l'email, ou que ce compte s'est bien inscrit en tant qu'agence.)");
            process.exitCode = 1;
            return;
        }

        const a = rows[0];
        console.log(`✅ Agence validée : ${a.email} (${a.prenom || ""} ${a.nom || ""})`);
        console.log("   Elle peut maintenant créer les espaces de ses clients.");
    } catch (err) {
        console.error("❌ valider-agence :", err.message);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
})();
