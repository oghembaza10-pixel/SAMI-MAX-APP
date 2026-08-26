// ==========================================================================
// SAMII OS — LES COMPTES FONDATEURS
//
// LE DÉFAUT QU'ON RÉPARE. Le fondateur s'est retrouvé bloqué par son propre
// péage : pour brancher SON numéro WhatsApp sur SA plateforme, l'écran lui
// répondait « Palier Actif requis ». C'est absurde, mais ce n'est pas
// seulement gênant — c'est dangereux. Quelqu'un qui ne peut pas utiliser son
// propre produit finit par le contourner : un compte de test créé à la va-vite,
// une exception glissée dans un fichier au hasard, une ligne modifiée à la main
// en base. Chacune de ces solutions laisse une trace qu'on oublie, et c'est
// comme ça qu'une plateforme finit avec des portes dérobées dont plus personne
// ne connaît l'existence.
//
// Donc une seule porte, déclarée, lisible, et à un seul endroit : ici.
//
// COMMENT ÇA MARCHE. Un espace dont le propriétaire est listé ici est traité
// comme un palier « societe » — le plus haut. Rien n'est facturé, rien n'est
// contourné dans le code de paiement : c'est simplement le palier qui répond
// autrement pour ces comptes-là. Le reste du produit ne sait même pas que ces
// comptes existent, ce qui garantit que le fondateur voit EXACTEMENT ce que
// voit un client Souverain — jamais un écran spécial qui masquerait un bug.
//
// SE RÈGLE SANS TOUCHER AU CODE. La variable d'environnement
// COMPTES_FONDATEUR accepte plusieurs adresses séparées par des virgules.
// Ajouter un associé ou un compte de démonstration ne demande donc pas un
// déploiement de code — juste une variable.
// ==========================================================================

// L'adresse du fondateur reste en dur comme filet de sécurité : si la variable
// d'environnement disparaît lors d'une migration de serveur, il ne doit pas se
// retrouver enfermé dehors le jour d'une démonstration client.
const PAR_DEFAUT = ["oghembaza10@gmail.com", "ghembazao@gmail.com"];

function listeConfiguree() {
    return String(process.env.COMPTES_FONDATEUR || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
}

// La comparaison est insensible à la casse et aux espaces : une adresse saisie
// « Oghembaza10@Gmail.com » à l'inscription doit être reconnue.
function estFondateur(email) {
    const e = String(email || "").trim().toLowerCase();
    if (!e) return false;
    return PAR_DEFAUT.includes(e) || listeConfiguree().includes(e);
}

// Le palier accordé. « societe » et non un palier inventé : le fondateur doit
// voir le produit tel qu'un client au palier le plus haut le voit, sinon il ne
// découvre jamais les défauts de cet écran-là.
const PALIER_FONDATEUR = "societe";

module.exports = { estFondateur, PALIER_FONDATEUR, PAR_DEFAUT };
