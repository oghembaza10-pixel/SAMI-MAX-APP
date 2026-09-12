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
function apresConnexion(req, res, { suite, typeCompte, aUneBoutique, nombreBoutiques } = {}) {
    const communautes = require("../config/communautes");
    const COM = res?.locals?.COM || communautes.get(communautes.DEFAUT);

    if (suite) return suite;

    // La communauté d'où l'on vient, quand elle diffère de celle du service.
    const traversee = req?.session?.communaute;
    if (traversee && traversee !== COM.slug
        && traversee !== communautes.DEFAUT && communautes.existe(traversee)) {
        return "/c/" + communautes.nettoyer(traversee);
    }

    // ══════════════════════════════════════════════════════════════════════
    // ON NE DÉCIDE PLUS À SA PLACE : ON LE DÉPOSE CHEZ SAMII
    // ══════════════════════════════════════════════════════════════════════
    //
    // Cette fonction choisissait une destination pour chacun : le fil pour un
    // client, /agence pour une agence, /qg pour un marchand. Chaque règle
    // était défendable prise seule, et l'ensemble revenait à décider à la
    // place des gens dès la seconde qui suit leur mot de passe.
    //
    // « Après connexion, l'utilisateur doit rester libre de choisir son
    // expérience. » Il atterrit donc dans la conversation, et c'est SAMII qui
    // demande — son QG, ses outils, la marketplace restent à un clic dans la
    // barre latérale, qui liste maintenant ses QG.
    //
    // LE CHAT ET LE QG NE SONT PAS DEUX APPLICATIONS. Un seul SAMII, une
    // seule mémoire : passer de l'un à l'autre ne coupe aucune conversation.
    // La session porte déjà workspaceId (routes/login.js le pose avant
    // d'appeler cette fonction), donc « Mon QG » s'ouvre depuis le chat sans
    // repasser par une page de sélection.
    //
    // TROIS CHOSES CONTINUENT DE PASSER AVANT, et ce ne sont pas des
    // exceptions à la règle — c'est la règle :
    //   - `suite` (traité plus haut) : quelqu'un qu'on a interrompu pour
    //     l'identifier retourne où il allait. Honorer une intention n'est pas
    //     en imposer une.
    //   - la communauté traversée (plus haut aussi) : chez une partenaire, on
    //     reste chez elle.
    //   - plusieurs QG : voir plus bas, on demande lequel.
    //
    // Chez une partenaire (`COM.ecosysteme` faux), RIEN NE CHANGE : « / » y
    // redirige vers sa communauté, et le chat n'est pas son produit.
    if (!COM.ecosysteme) {
        if (typeCompte === "client") return communautes.accueilClient(COM);
        if (Number(nombreBoutiques) > 1) return "/mes-qg";
        return aUneBoutique ? "/qg" : communautes.accueilMarchand(COM);
    }

    // Plusieurs QG : on demande lequel avant de déposer dans la conversation.
    // Ce n'est pas contradictoire avec la liberté — c'est une question dont
    // seule la personne a la réponse, et la barre latérale du chat permettra
    // d'en changer ensuite sans se reconnecter.
    if (Number(nombreBoutiques) > 1) return "/mes-qg";

    return "/";

    // ── UNE AGENCE QUI TIENT AUSSI SA BOUTIQUE ───────────────────────────
    //
    // Avant : `typeCompte === "agence"` envoyait sur /agence, TOUJOURS, même
    // pour quelqu'un qui possède ses propres QG. « Je me connecte et je
    // tombe sur agence au lieu de mon propre poste de commandement. »
    //
    // C'est le bon reproche. Le QG Agence est une vue sur les clients des
    // AUTRES ; quand on a sa propre boutique, sa maison c'est son QG à soi.
    // /agence reste à un clic dans le menu, l'inverse n'était pas vrai.
    //
    // Une agence SANS boutique va toujours sur /agence : c'est son seul
    // espace, l'y envoyer reste juste.
    //
    // Le garde `COM.ecosysteme` reste : chez une partenaire, /agence est
    // fermé, et y déposer quelqu'un rouvrait une 404 par une autre porte.
    // ── CE QUI VIVAIT ICI ────────────────────────────────────────────────
    //
    // Suivaient une règle pour les agences (« /agence, toujours ») et le
    // retour final « /qg ou l'accueil marchand ». Les deux sont maintenant
    // inatteignables : le bloc ci-dessus répond avant.
    //
    // Elles ne sont pas déplacées, elles sont RETIRÉES. Du code mort qui
    // contredit la règle en vigueur finit toujours par être relu comme la
    // règle — c'est précisément ce qui avait laissé quatre secteurs
    // abandonnés survivre dans routes/hub.js. Le choix qu'elles faisaient
    // est maintenant offert dans la barre latérale du chat, où la personne
    // le fait elle-même : QG Agence compris, pour un compte agence.
}

module.exports = { suiteSure, apresConnexion };
