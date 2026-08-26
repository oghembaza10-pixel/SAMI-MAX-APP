// ==========================================================================
// SAMII OS — LE RETOUR À SA BASE
//
// LE DÉFAUT, DIT PAR L'USAGE. « Dans certains endroits, il n'y a ni le bouton
// pour changer de langue, ni le bouton pour revenir là où on était. Si on est
// dans le QG, on doit revenir au QG. Si on est dans l'agence, on doit revenir
// dans l'agence. »
//
// Un lien de retour écrit en dur dans un gabarit ne peut pas savoir ça. Une
// page de l'Académie renvoyait toujours vers l'Académie — même quand le
// visiteur venait du QG. Résultat : il se retrouve ailleurs, et il n'a plus
// que la flèche du navigateur, qui n'est pas un produit.
//
// LA RÈGLE, DU PLUS SÛR AU PLUS DEVINÉ.
//   1. Un `retour` explicite dans l'URL, s'il pointe chez nous. C'est la
//      seule source vraiment fiable : c'est la page précédente qui l'a écrit.
//   2. Le type de compte en session — une agence rentre à l'agence, un
//      marchand à son QG, un client à son espace client. C'est ce qui répond
//      à la demande ci-dessus.
//   3. Rien : la page d'accueil. Jamais une erreur, jamais un cul-de-sac.
//
// POURQUOI PAS LE REFERER. Il est absent dès qu'on arrive par un lien
// extérieur, effacé par certains navigateurs, et falsifiable. Un bouton de
// retour qui marche « la plupart du temps » est pire qu'un bouton constant :
// on n'apprend jamais où il mène.
// ==========================================================================

// Une destination n'est acceptée que si elle est chez nous : un `retour`
// fourni par l'URL ne doit jamais pouvoir envoyer un marchand connecté sur un
// site tiers préparé pour ressembler au nôtre.
function interne(chemin) {
    return typeof chemin === "string" && /^\/[^/\\]/.test(chemin);
}

// `cle` est la clé du dictionnaire client (public/i18n/*.json). Le libellé est
// rendu par le serveur dans la langue détectée, mais le sélecteur de langue de
// la barre change la page sans la recharger : sans cette clé, le bouton de
// retour resterait la seule chose en français sur une page passée en arabe.
const BASES = {
    agence:  { url: "/agence",     libelle: "la Tour de contrôle", cle: "nav.retour.agence" },
    marchand:{ url: "/qg",         libelle: "le QG",               cle: "nav.retour.qg" },
    client:  { url: "/client-qg",  libelle: "mon espace",          cle: "nav.retour.client" },
};

function baseDuCompte(req) {
    const type = req.session?.typeCompte;
    if (type === "agence") return BASES.agence;
    if (type === "client") return BASES.client;
    // Un espace de travail suffit à faire un marchand, même si le type n'a
    // jamais été posé — c'est le cas des comptes les plus anciens.
    if (req.session?.workspaceId) return BASES.marchand;
    return null;
}

// { url, libelle } — le libellé sert à écrire « ← Retour au QG » plutôt qu'un
// « ← Retour » qui ne dit pas où l'on va.
function retour(req) {
    const demande = req.query?.retour;
    if (interne(demande)) return { url: demande, libelle: "", cle: "nav.retour.simple" };
    return baseDuCompte(req) || { url: "/", libelle: "l'accueil", cle: "nav.retour.accueil" };
}

// À poser après le middleware de langue : le libellé se traduit.
function middleware(req, res, next) {
    const cible = retour(req);
    const L = res.locals.L || ((s) => s);
    res.locals.retourUrl = cible.url;
    res.locals.retourCle = cible.cle;
    res.locals.retourLibelle = cible.libelle
        ? `${L("Retour à")} ${L(cible.libelle)}`
        : L("Retour");
    next();
}

module.exports = { retour, middleware, BASES, interne };
