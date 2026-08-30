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

module.exports = { suiteSure };
