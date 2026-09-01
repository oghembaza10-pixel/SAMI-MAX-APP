// ==========================================================================
// SAMII OS — LE CATALOGUE DES MODÈLES WHATSAPP
//
// POURQUOI CE FICHIER EXISTE.
//
// Un modèle WhatsApp s'appelle PAR SON NOM, et ses variables partent dans
// un tableau ordonné : la première valeur remplit {{1}}, la deuxième {{2}}.
// Le texte, lui, vit chez Meta — nous ne l'avons pas.
//
// Ça veut dire qu'une erreur d'ordre ne se voit nulle part chez nous. Le
// code envoie [montant, prenom] au lieu de [prenom, montant], Meta accepte
// (les deux sont du texte), et le client reçoit « Bonjour 15 000 FCFA,
// votre commande Marlyse est confirmée ». Aucune erreur, aucun journal :
// juste un marchand qui perd la face devant son client.
//
// Un nom mal orthographié, lui, fait échouer l'envoi — plus visible, mais
// silencieux quand même si personne ne lit les journaux.
//
// D'où ce fichier : les noms et l'ordre des variables sont écrits UNE fois,
// ici, comme des données. Et `scripts/test-whatsapp.js` va les comparer à ce
// que Meta déclare vraiment, plutôt que de nous laisser deviner.
//
// COMMENT AJOUTER UN MODÈLE. On le crée chez Meta, on attend l'approbation,
// on l'ajoute ici avec son nom exact et l'ordre de ses variables, puis on
// lance le script de contrôle. Rien d'autre à toucher dans le code.
// ==========================================================================

// Les modèles tels qu'ils existent sur le compte, au 1er septembre 2026.
//
// `variables` DÉCRIT l'ordre attendu — c'est de la documentation exécutable :
// le script de contrôle compare ce nombre à celui que Meta déclare, et crie
// si les deux divergent. Les noms n'ont d'importance que pour nous.
//
// `repli` est le texte envoyé aux marchands restés sur Green API, qui ne
// connaît pas les modèles. Sans lui, ils cessent de recevoir en silence.
// LES CHIFFRES CI-DESSOUS NE SONT PAS DEVINÉS.
//
// Une première version de ce fichier portait des nombres de variables
// inventés d'après le nom des modèles. `scripts/test-whatsapp.js`, en
// interrogeant Meta, en a corrigé trois d'un coup :
//   • commande_confirmee n'existe pas (créé puis supprimé le 1er sept.)
//   • echec_de_la_livraison attend 3 variables, on en déclarait 2
//   • rejoinds_samii n'en attend AUCUNE, on en déclarait 1
//
// Aucune de ces trois erreurs n'aurait laissé de trace en production : Meta
// accepte du texte dans n'importe quelle variable. Les valeurs seraient
// simplement parties décalées, et le client aurait lu une phrase absurde
// signée du marchand. Relancer ce script après chaque modification chez Meta
// est la seule façon de garder les deux côtés d'accord.
const MODELES = {
    livraison_estime: {
        nom: "livraison_estime",
        langue: "fr",
        categorie: "UTILITY",
        // Texte approuvé :
        //   Bonjour {{1}}, votre commande {{2}} est en route et devrait
        //   arriver bientôt. Livraison estimée : {{3}}
        variables: ["prenom", "reference", "date_estimee"],
        repli: (v) => `Bonjour ${v[0]}, votre commande ${v[1]} est en route.\n`
                    + `Livraison estimée : ${v[2]}`,
    },

    commande_livree: {
        nom: "commande_livree",
        langue: "fr",
        categorie: "UTILITY",
        // Texte approuvé :
        //   Salut {{1}}, votre commande {{2}} a été livrée.
        //   Besoin de retourner ou de remplacer un article ?
        variables: ["prenom", "reference"],
        repli: (v) => `Salut ${v[0]}, votre commande ${v[1]} a été livrée.\n`
                    + `Besoin de retourner ou de remplacer un article ? Répondez à ce message.`,
    },

    echec_de_la_livraison: {
        nom: "echec_de_la_livraison",
        langue: "fr",
        categorie: "UTILITY",
        // ⚠️ CELUI-CI N'ATTEND PAS DE RÉFÉRENCE DE COMMANDE.
        //
        // Texte approuvé chez Meta, mot pour mot :
        //   Bonjour {{1}},
        //   Nous avons tenté de livrer votre commande le {{2}}, mais sans succès.
        //   Pour reprogrammer la livraison, veuillez nous contacter au {{3}}.
        //
        // {{2}} est une DATE et {{3}} un NUMÉRO DE TÉLÉPHONE. Ce fichier
        // déclarait [prenom, reference, detail] : le compte était juste — trois
        // valeurs — mais le sens était faux. SAMII aurait écrit « nous avons
        // tenté de livrer votre commande le CMD-2026-0042 », et rien n'aurait
        // signalé quoi que ce soit.
        //
        // C'est précisément l'erreur que compter les variables ne peut pas
        // attraper. Seul le texte approuvé la montre — d'où son affichage
        // dans scripts/test-whatsapp.js.
        variables: ["prenom", "date_tentative", "telephone_contact"],
        repli: (v) => `Bonjour ${v[0]},\n`
                    + `Nous avons tenté de livrer votre commande le ${v[1]}, mais sans succès.\n`
                    + `Pour reprogrammer la livraison, contactez-nous au ${v[2]}.`,
    },

    rejoinds_samii: {
        nom: "rejoinds_samii",
        langue: "fr",
        categorie: "MARKETING",
        // AUCUNE variable : le texte est entièrement figé chez Meta. En
        // envoyer une faisait rejeter l'appel — Meta refuse un composant
        // « body » dont il n'a pas besoin.
        variables: [],
        repli: () => `Laisse Sami s'occuper du travail lourd et concentre-toi sur l'essentiel.\n`
                   + `Rejoins le mouvement dès maintenant.`,
    },
};

// ── CE QUI MANQUE ENCORE ─────────────────────────────────────────────────
//
// `commande_confirmee` a été créé le 1er septembre à 04:55 puis supprimé une
// minute plus tard. C'est le message le plus important de la chaîne : sans
// lui, une commande passée hors de la fenêtre de 24 h n'est jamais confirmée
// au client. À recréer chez Meta, en UTILITY (et non en Marketing : un
// client ayant refusé la publicité ne recevrait jamais sa confirmation).
//
// Tant qu'il n'existe pas, `pour("commande.confirmee")` renvoie null et
// l'appelant retombe sur son texte libre — ce qui marche dans la fenêtre de
// 24 h, et seulement là.
const MANQUANTS = {
    commande_confirmee: "à recréer chez Meta, catégorie UTILITY",
};

// ── CE QUI EXISTE CHEZ META ET NE SERT À RIEN ────────────────────────────
//
// Volontairement NON branchés. Les laisser dans le catalogue reviendrait à
// choisir au hasard entre deux messages presque identiques selon le
// fichier qu'on lit.
//
//   commande_livre   « Bonne nouvelle ! Votre commande {{2}} a été livrée. »
//                    Doublon de commande_livree, à un « e » près. Deux
//                    modèles pour le même événement, c'est un jour où l'on
//                    corrige le texte de l'un et où l'autre continue de
//                    partir, inchangé.
//   contenu          Aucune variable, objet inconnu. Rien ne l'appelle.
//
// À supprimer chez Meta quand le doute est levé.
const INUTILISES = ["commande_livre", "contenu"];

// ── CE QUE LE CODE APPELLE ───────────────────────────────────────────────
//
// Les événements de l'application pointent vers un modèle. Cette indirection
// n'est pas décorative : le jour où un modèle est refusé par Meta ou renommé,
// on change UNE ligne ici, et pas les cinq endroits qui envoient.
const POUR = {
    // « commande.confirmee » n'est PAS branché : le modèle n'existe plus chez
    // Meta. Le laisser pointer vers un nom absent ferait échouer chaque envoi
    // avec une erreur que personne ne lit. Sans entrée ici, pour() renvoie
    // null et l'appelant écrit en texte libre — ce qui arrive vraiment dans
    // la fenêtre de 24 h. Ligne à rétablir dès que le modèle est recréé.
    "commande.expediee": "livraison_estime",
    "commande.livree": "commande_livree",
    "livraison.echouee": "echec_de_la_livraison",
    "invitation": "rejoinds_samii",
};

// Prépare un envoi à partir d'un événement et de ses valeurs, DANS L'ORDRE
// déclaré plus haut. Renvoie null si le modèle n'existe pas — l'appelant
// enverra alors son texte libre, ce qui marche dans la fenêtre de 24 h.
function pour(evenement, valeurs = []) {
    const cle = POUR[evenement];
    const m = cle && MODELES[cle];
    if (!m) return null;
    return {
        nom: m.nom,
        langue: m.langue,
        variables: valeurs.slice(0, m.variables.length),
        // Le texte de repli est calculé ici, pas chez l'appelant : c'est le
        // même message, il ne doit pas exister en deux versions qui divergent.
        repli: m.repli ? m.repli(valeurs) : "",
    };
}

module.exports = { MODELES, POUR, MANQUANTS, INUTILISES, pour };
