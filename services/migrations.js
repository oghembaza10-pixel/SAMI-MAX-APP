// ==========================================================================
// SAMII OS — LES MIGRATIONS QUI S'APPLIQUENT TOUTES SEULES
//
// POURQUOI CE FICHIER EXISTE.
// Le dépôt a une vingtaine de scripts `scripts/alter-*.js` qu'il faut lancer
// à la main. Le déploiement, lui, part de git : Render récupère le code et
// redémarre. Personne n'ouvre un terminal entre les deux.
//
// Résultat : une fonctionnalité qui a besoin d'une nouvelle colonne part en
// production sans elle. Le code demande `p.communaute`, Postgres répond
// « column does not exist », et la page tombe. Ce n'est pas une hypothèse :
// c'est la façon dont une correction se transforme en panne pire que le bug
// qu'elle corrigeait.
//
// CE QU'ON MET ICI. Uniquement des changements ADDITIFS et IDEMPOTENTS —
// ajouter une colonne, créer un index. Jamais un DROP, jamais un ALTER qui
// change un type, jamais rien qui perde des données : ce fichier s'exécute
// à chaque démarrage, y compris pendant un redémarrage en boucle.
//
// ET SI ÇA ÉCHOUE ? On note et on continue. Une migration ratée ne doit pas
// empêcher le serveur de démarrer — un site debout avec une fonctionnalité
// en moins vaut mieux qu'un site qui refuse de se lever.
//
// Les scripts `scripts/alter-*.js` restent : ils servent à rejouer une
// migration à la main sur une base précise. Ce fichier, lui, garantit
// qu'elle est appliquée en production sans que personne y pense.
// ==========================================================================
const db = require("./db");

const MIGRATIONS = [
    {
        nom: "publications.communaute",
        // Sans cette colonne, le fil est GLOBAL : ce qu'un membre publie chez
        // une partenaire apparaît dans notre communauté, et inversement.
        // Elle a beau avoir sa marque, ses couleurs et son application, le
        // contenu reste le nôtre — sa communauté n'est pas la sienne.
        // Le défaut « samii » range l'existant chez nous, ce qui est exact :
        // tout ce qui a été publié jusqu'ici l'a été dans la maison.
        sql: `ALTER TABLE publications
              ADD COLUMN IF NOT EXISTS communaute TEXT DEFAULT 'samii'`,
    },
    {
        nom: "publications.communaute (index)",
        // Le fil filtre sur cette colonne à chaque affichage de page.
        sql: `CREATE INDEX IF NOT EXISTS idx_publications_communaute
              ON publications (communaute, created_at DESC)`,
    },
];

async function appliquer() {
    let faites = 0;
    for (const m of MIGRATIONS) {
        try {
            await db.query(m.sql);
            faites++;
        } catch (err) {
            // On note et on passe : voir l'en-tête du fichier.
            console.warn(`⚠️ migration « ${m.nom} » non appliquée : ${err.message}`);
        }
    }
    if (faites) console.log(`🗄️  ${faites}/${MIGRATIONS.length} migrations vérifiées.`);
}

module.exports = { appliquer, MIGRATIONS };
