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
const MODELES = {
    // ── Ce qui doit TOUJOURS arriver ─────────────────────────────────────
    commande_confirmee: {
        nom: "commande_confirmee",
        langue: "fr",
        // ⚠️ Déclaré en MARKETING sur le compte. Un client qui a refusé les
        // messages promotionnels ne le recevra donc PAS — alors que c'est le
        // message qui doit toujours arriver. À faire repasser en Utilitaire
        // chez Meta (⋯ → Modifier la catégorie).
        categorie: "MARKETING",
        variables: ["prenom", "reference", "montant", "livraison_prevue"],
        repli: (v) => `Bonjour ${v[0]}, votre commande ${v[1]} est confirmée.\n`
                    + `Montant : ${v[2]}\nLivraison prévue : ${v[3]}`,
    },

    livraison_estime: {
        nom: "livraison_estime",
        langue: "fr",
        categorie: "UTILITY",
        variables: ["prenom", "reference", "date_estimee"],
        repli: (v) => `Bonjour ${v[0]}, votre commande ${v[1]} arrive le ${v[2]}.`,
    },

    commande_livree: {
        nom: "commande_livree",
        langue: "fr",
        categorie: "UTILITY",
        variables: ["prenom", "reference"],
        repli: (v) => `Bonjour ${v[0]}, votre commande ${v[1]} a été livrée. Tout est conforme ?`,
    },

    echec_de_la_livraison: {
        nom: "echec_de_la_livraison",
        langue: "fr",
        categorie: "UTILITY",
        variables: ["prenom", "reference"],
        repli: (v) => `Bonjour ${v[0]}, la livraison de votre commande ${v[1]} n'a pas pu se faire. `
                    + `Répondez à ce message pour qu'on la reprogramme.`,
    },

    rejoinds_samii: {
        nom: "rejoinds_samii",
        langue: "fr",
        categorie: "MARKETING",
        variables: ["prenom"],
        repli: (v) => `Bonjour ${v[0]}, rejoignez-nous sur SAMII.`,
    },
};

// ── CE QUE LE CODE APPELLE ───────────────────────────────────────────────
//
// Les événements de l'application pointent vers un modèle. Cette indirection
// n'est pas décorative : le jour où un modèle est refusé par Meta ou renommé,
// on change UNE ligne ici, et pas les cinq endroits qui envoient.
const POUR = {
    "commande.confirmee": "commande_confirmee",
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

module.exports = { MODELES, POUR, pour };
