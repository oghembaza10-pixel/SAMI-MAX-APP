// ==========================================================================
// SAMII OS — LES QUATRE PALIERS, EN UN SEUL ENDROIT
//
// POURQUOI CE FICHIER EXISTE. Le prix d'un abonnement était écrit deux fois :
// dans routes/billing.js (ce que le marchand voit et paie) et dans
// engines/abonnementEngine.js (ce qu'on lui redemande au renouvellement).
// Deux copies d'un même chiffre finissent toujours par diverger, et le jour
// où elles divergent, on facture un montant qu'on n'a jamais affiché. Il n'y
// a donc plus qu'un seul endroit : celui-ci.
//
// CHANGER UN PRIX. Modifie `prix` ci-dessous, c'est tout : la page
// d'abonnement, le lien Chargily, le virement CCP, le rappel de
// renouvellement et la page d'accueil suivent automatiquement.
//
// CE QUI N'EST PAS IMPLÉMENTÉ, ET C'EST VOULU. Il n'y a pas de prix
// « historique » gardé par marchand : si tu augmentes un palier, les
// marchands déjà abonnés voient la hausse à leur prochain renouvellement.
// Tant qu'on n'a pas de parc installé, c'est le comportement le plus simple
// et le plus lisible. Le jour où il faudra protéger les premiers clients, ce
// sera un prix figé sur la ligne `abonnements`, pas une seconde table de prix.
//
// LES PRIX EN USD. Le marchand paie toujours dans sa monnaie (services/
// devises.js fait la conversion, marché parallèle pour le DZD). L'USD n'est
// ici qu'une référence de calcul — ne l'affiche jamais brut à un marchand.
// ==========================================================================

// Ordre croissant — sert aussi à savoir si un palier en couvre un autre.
const ORDRE = ["free", "standard", "pro", "societe"];

const PALIERS = {
    free: {
        id: "free",
        nom: "Découverte",
        icone: "🌑",
        prix: 0,
        // Le palier gratuit n'est pas une démo bridée : il ouvre quatre outils
        // complets (config/cartes-catalog.js). C'est lui qui doit donner envie
        // du palier suivant, pas une page de vente.
        payant: false,
    },
    standard: {
        id: "standard",
        nom: "Actif",
        icone: "🚀",
        prix: 19,
        // Prix de lancement : le premier palier payant doit rester atteignable
        // pour un marchand algérien (19 $ ≈ 4 600 DZD au marché parallèle).
        // Il montera quand le parc installé le justifiera — ce n'est pas une
        // promotion à durée limitée codée en dur, c'est le prix du moment.
        prixDeLancement: true,
        payant: true,
    },
    pro: {
        id: "pro",
        nom: "Souverain",
        icone: "👑",
        prix: 49,
        payant: true,
    },
    societe: {
        id: "societe",
        nom: "Société",
        icone: "🏛️",
        // null = sur devis. Une agence ou un groupe ne se facture pas au même
        // barème qu'un marchand seul : le prix dépend du nombre d'espaces
        // clients, et se négocie. Aucun bouton de paiement, un formulaire.
        prix: null,
        payant: false,
    },
};

// Les seuls paliers qu'on peut acheter en autonomie depuis /billing.
const PAYANTS = Object.values(PALIERS).filter(p => p.payant).map(p => p.id);

// Prix de référence en USD, ou null si le palier ne s'achète pas en ligne.
// C'est la seule fonction que le reste du code doit appeler pour un montant.
function prixUSD(palier) {
    const p = PALIERS[palier];
    return p && p.payant ? p.prix : null;
}

function estAchetable(palier) {
    return PAYANTS.includes(palier);
}

function rang(palier) {
    const i = ORDRE.indexOf(palier || "free");
    return i === -1 ? 0 : i;
}

module.exports = { PALIERS, ORDRE, PAYANTS, prixUSD, estAchetable, rang };
