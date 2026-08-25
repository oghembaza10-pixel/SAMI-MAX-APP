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

// CE QUI COMPTE COMME UN CANAL. Un marchand ne doit pas « brûler » son quota
// de canaux en branchant son transporteur ou son moyen de paiement : livrer
// et encaisser ne sont pas des canaux de vente. Seuls les endroits où un
// client parle ou achète sont comptés — c'est là qu'est la valeur, et le coût.
const CANAUX_COMPTES = [
    "whatsapp", "telegram", "discord",
    "facebook", "instagram", "tiktok", "youtube", "linkedin",
    "gmail", "google", "shopify", "woocommerce",
];

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
        // Un seul canal : de quoi démarrer pour de vrai (Telegram), pas de quoi
        // faire tourner un commerce à plusieurs canaux sans jamais payer.
        canauxMax: 1,
        publication: null,   // aucune publication automatique
        integrations: false, // ni API ni webhooks
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
        // Trois canaux : le trio qui fait tourner un commerce (WhatsApp,
        // Telegram, Gmail) sans ouvrir toute la façade sociale d'un coup.
        canauxMax: 3,
        publication: "3x_semaine", // cadence maximale dans /autopost
        integrations: false,
    },
    pro: {
        id: "pro",
        nom: "Souverain",
        icone: "👑",
        prix: 49,
        payant: true,
        canauxMax: null,          // tous les canaux
        publication: "2x_jour",   // cadence maximale dans /autopost
        // C'est ici que l'API publique et les webhooks s'ouvrent : brancher
        // n8n, Make ou un ERP, c'est ce que demande une structure qui a déjà
        // ses outils — pas un marchand qui démarre.
        integrations: true,
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
        canauxMax: null,
        publication: "2x_jour",
        integrations: true,
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

// Nombre de canaux autorisés, ou null pour « sans limite ».
// Attention au `??` ici : « sans limite » s'écrit null, donc un ?? ferait
// retomber les paliers illimités sur la valeur du gratuit — c'est-à-dire un
// seul canal pour un client à 49 $. On distingue donc « palier inconnu » de
// « palier sans plafond ».
function canauxMax(palier) {
    return Object.prototype.hasOwnProperty.call(PALIERS, palier)
        ? PALIERS[palier].canauxMax
        : PALIERS.free.canauxMax;
}

// Cadences de publication, de la plus rare à la plus fréquente. Mêmes clés
// que engines/autopostEngine.js (INTERVALLES_MS) — ne pas renommer.
const CADENCES = ["hebdo", "3x_semaine", "quotidien", "2x_jour"];

// Ramène une cadence demandée à ce que le palier autorise. Renvoie null si le
// palier n'ouvre aucune publication automatique. On ne masque pas les autres
// choix dans le formulaire — le marchand doit voir ce qu'il gagnerait à
// monter — on refuse simplement d'enregistrer plus que ce qui est vendu.
function cadencePublication(palier, demandee) {
    const plafond = PALIERS[palier]?.publication ?? null;
    if (plafond === null) return null;
    const i = CADENCES.indexOf(demandee);
    return i !== -1 && i <= CADENCES.indexOf(plafond) ? demandee : plafond;
}

// Vrai si ce palier ouvre l'API publique et les webhooks.
function aLesIntegrations(palier) {
    return PALIERS[palier]?.integrations === true;
}

function rang(palier) {
    const i = ORDRE.indexOf(palier || "free");
    return i === -1 ? 0 : i;
}

module.exports = {
    PALIERS, ORDRE, PAYANTS, CANAUX_COMPTES, CADENCES,
    prixUSD, estAchetable, canauxMax, cadencePublication, aLesIntegrations, rang,
};
