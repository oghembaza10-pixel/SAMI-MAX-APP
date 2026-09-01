// ==========================================================================
// SAMII OS — « ET APRÈS LA CONNEXION, ON M'EMMÈNE OÙ ? »
//
// POURQUOI CE FICHIER EXISTE. Elle clique sur le lien de SON espace
// d'administration, on la reconnaît comme n'ayant pas de session, on
// l'envoie se connecter — et après la connexion, on la dépose sur le fil de
// sa communauté. Pas là où elle allait.
//
// Elle doit alors retrouver toute seule le chemin vers l'admin. Ça marche,
// et c'est exactement le genre de détour qui fait dire « ça marche pas ».
//
// ── LA PARTIE QUI COMPTE : CETTE ADRESSE VIENT DU DEHORS ────────────────
//
// Le retour voyage dans l'URL puis dans un formulaire. N'importe qui peut
// donc écrire ce qu'il veut dedans et envoyer le lien à quelqu'un :
//
//     /c/coindudigital/connexion?suite=https://faux-site.example/vol
//
// La victime voit NOTRE domaine, notre marque, se connecte pour de vrai —
// et se fait déposer sur une page qui lui demandera « de confirmer son mot
// de passe ». C'est une redirection ouverte, et c'est un classique de
// l'hameçonnage, pas une curiosité théorique.
//
// D'où une liste blanche, encore : on n'accepte QUE des chemins internes.
// Tout le reste est jeté sans discussion, et l'appelant retombe sur sa
// destination habituelle.
//
// Les cas refusés, et pourquoi chacun :
//   https://ailleurs   → un autre site, évidemment
//   //ailleurs         → « protocole relatif » : le navigateur comprend
//                        https://ailleurs. C'est CELUI qu'on oublie.
//   /\ailleurs         → certains navigateurs le lisent comme //
//   javascript:…       → exécution de code au clic
//   texte avec \n      → permet d'injecter d'autres en-têtes HTTP
// ==========================================================================

function suiteSure(valeur) {
    const s = String(valeur ?? "").trim();
    if (!s) return null;
    // Un chemin, et un seul segment initial. `startsWith("/")` seul ne
    // suffit pas : « //ailleurs.example » commence par « / ».
    if (!s.startsWith("/")) return null;
    if (s.startsWith("//") || s.startsWith("/\\")) return null;
    // Ni saut de ligne, ni caractère de contrôle, ni deux-points avant le
    // premier « / » — pas de « /..:javascript ».
    if (/[\x00-\x1f\x7f]/.test(s)) return null;
    if (s.length > 512) return null;
    return s;
}

// ── ET QUAND PERSONNE N'A DEMANDÉ DE DESTINATION ? ──────────────────────
//
// LE BUG QUI A DONNÉ CE CODE. Sur le domaine d'Inès, on se connectait
// correctement — bon email, bon mot de passe, session créée — et on
// atterrissait sur une page 404.
//
// La destination par défaut d'un marchand sans boutique était écrite en dur :
// « /hub ». Le Hub est NOTRE page (nos boutiques, nos métiers, notre
// marque) ; la porte le ferme chez une partenaire. Connexion réussie,
// arrivée dans le vide. Même chose pour « /client-qg » côté acheteur.
//
// La communauté était bien connue à cet instant — mais on la cherchait au
// mauvais endroit : dans `session.communaute`, que seul un lien `?c=` pose.
// Quelqu'un qui tape l'adresse de sa communauté directement, ou qui revient
// par un favori, n'a jamais ce marqueur. Or c'est le SERVICE qui décide de
// la communauté (`res.locals.COM`), pas le chemin parcouru.
//
// Ici on demande donc au registre où va cette personne CHEZ ELLE :
// `accueilMarchand` / `accueilClient` connaissent déjà la réponse pour
// chaque communauté. Une page fermée n'est plus une impasse.
//
// L'ordre est délibéré :
//   1. `suite`  — la page qu'on voulait vraiment ouvrir (déjà validée)
//   2. `?c=`    — la communauté traversée, utile sur NOTRE domaine, où
//                 `COM` vaut toujours « samii »
//   3. le service — la maison de cette personne, jamais une page en dur
function apresConnexion(req, res, { suite, typeCompte, aUneBoutique } = {}) {
    const communautes = require("../config/communautes");
    const COM = res?.locals?.COM || communautes.get(communautes.DEFAUT);

    if (suite) return suite;

    // La communauté d'où l'on vient, quand elle diffère de celle du service.
    const traversee = req?.session?.communaute;
    if (traversee && traversee !== COM.slug
        && traversee !== communautes.DEFAUT && communautes.existe(traversee)) {
        return "/c/" + communautes.nettoyer(traversee);
    }

    if (typeCompte === "client") return communautes.accueilClient(COM);
    // Le QG Agence est un espace à nous : chez une partenaire, une agence
    // est un marchand comme un autre. Sans ce garde, on rouvrait la même
    // 404 par une autre porte.
    if (typeCompte === "agence" && COM.ecosysteme) return "/agence";
    return aUneBoutique ? "/qg" : communautes.accueilMarchand(COM);
}

module.exports = { suiteSure, apresConnexion };
