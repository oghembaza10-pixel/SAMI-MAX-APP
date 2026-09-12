// ==========================================================================
// SAMII OS — LA VERSION DES FEUILLES ET DES SCRIPTS, CALCULÉE
// ==========================================================================
//
// LE DÉFAUT CORRIGÉ, ET IL VENAIT DE SE PRODUIRE.
//
// Les adresses portaient un numéro écrit à la main :
// `/css/qg-style.css?v=8`, recopié dans SEPT gabarits. Une règle ajoutée dans
// la feuille sans toucher aux sept numéros, et les navigateurs continuent de
// servir l'ancienne version depuis leur cache.
//
// Ce qu'on a vu en vrai : le repli « Plus » du QG était écrit, déployé, et
// sans effet. Le gabarit (jamais mis en cache) affichait bien le nouveau
// bouton, pendant que la feuille (mise en cache) n'avait pas la règle qui
// replie. Un demi-déploiement — le pire cas, parce que la page a l'air
// nouvelle et se comporte comme l'ancienne, et qu'on cherche le bug dans le
// code plutôt que dans le cache.
//
// LA VERSION VIENT DONC DU FICHIER LUI-MÊME. Une empreinte de son contenu :
// le fichier change, l'adresse change, le navigateur retélécharge. Personne
// n'a plus rien à se rappeler, et l'oubli devient impossible.
//
// Calculée UNE FOIS au démarrage et gardée en mémoire : un déploiement
// redémarre le service, donc l'empreinte est toujours celle du fichier servi.
// Relire à chaque requête coûterait un accès disque par balise, pour une
// valeur qui ne peut pas changer entre deux redémarrages.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RACINE_PUBLIQUE = path.join(__dirname, "..", "public");
const cache = new Map();

// `/css/qg-style.css` → `/css/qg-style.css?v=a1b2c3d4`
//
// Un fichier introuvable renvoie l'adresse SANS version plutôt que de lever :
// une page qui s'affiche avec un cache imparfait vaut mieux qu'une page qui
// ne s'affiche pas du tout. Le chemin est nettoyé de tout « .. » — il vient
// de nos gabarits, mais une fonction qui lit le disque ne doit jamais faire
// confiance à ce qu'on lui passe.
function v(chemin) {
    const propre = String(chemin || "").split("?")[0];
    if (cache.has(propre)) return cache.get(propre);

    let sortie = propre;
    try {
        const complet = path.join(RACINE_PUBLIQUE, propre);
        if (!complet.startsWith(RACINE_PUBLIQUE)) throw new Error("chemin hors de public/");
        const empreinte = crypto.createHash("sha1")
            .update(fs.readFileSync(complet))
            .digest("hex")
            .slice(0, 8);
        sortie = `${propre}?v=${empreinte}`;
    } catch (err) {
        console.warn(`⚠️ actifs.v(${propre}) : ${err.message} — servi sans version`);
    }

    cache.set(propre, sortie);
    return sortie;
}

module.exports = { v };
