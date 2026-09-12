// ==========================================================================
// SAMII OS — LE PRIX DE PARLER À SAMII
// ==========================================================================
//
// POURQUOI UNE RECHARGE ET PAS UN ABONNEMENT.
//
// L'abonnement est une idée étrangère ici : il demande de la confiance à
// l'avance, à quelqu'un qui ne connaît pas encore le produit. La recharge,
// elle, est un geste que tout le monde a déjà fait — une flexy Mobilis ou
// Djezzy. On n'invente pas un comportement, on en emprunte un qui existe.
//
// Et le solde NE S'EFFACE PAS à la fin du mois. C'est toute la différence
// avec un forfait : ce qui est payé reste acquis, donc recharger n'est
// jamais un pari.
//
// ── LES DEUX SEULS CHIFFRES QUI COMPTENT ──────────────────────────────────
//
// Un message coûte 1 centime de dollar. La recharge minimale est de 2 $,
// soit 200 messages : assez pour que ça vaille le geste, assez peu pour
// qu'on le fasse sans réfléchir.
//
// ── LE DINAR SE COMPTE AU MARCHÉ PARALLÈLE, ET C'EST OBLIGATOIRE ──────────
//
// Au taux officiel, 2 $ font environ 270 DZD. Mais personne ne peut acheter
// des dollars à ce taux : pour se procurer les 2 $ qu'on doit ensuite à
// Google, il faut passer par le marché parallèle, où ils coûtent près du
// double. Facturer au taux officiel reviendrait donc à encaisser 270 DZD
// pour dépenser l'équivalent de 480 — à vendre à perte, à chaque recharge,
// sans que rien ne le signale avant le relevé.
//
// Le taux vit dans config.js (`TAUX_USD_DZD`, déjà marqué « marché
// parallèle ») et se change par variable d'environnement, parce qu'il bouge.
// Aucun taux n'est écrit en dur ici.
//
// ── CE QUI N'EST PAS ICI ──────────────────────────────────────────────────
//
// Le coût réel d'un message chez Gemini. Il n'est pas encore mesuré, et
// écrire un chiffre inventé à côté du prix de vente donnerait l'illusion
// d'une marge connue. Tant qu'il n'est pas mesuré, 1 centime est une
// décision commerciale assumée, pas un calcul.

// Tout est compté en dollars, y compris pour un Algérien : c'est la monnaie
// dans laquelle on PAIE l'IA. Le dinar est un affichage et un moyen de
// paiement, jamais l'unité de compte — sinon chaque variation du taux
// réécrirait la valeur des soldes déjà achetés.
const DEVISE_COMPTE = "USD";

// Un message à SAMII. Le même prix pour tout le monde, partout.
const PRIX_MESSAGE_USD = 0.01;

// En dessous, le geste ne vaut pas les frais de transaction.
const MINIMUM_RECHARGE_USD = 2;

// Les montants proposés. Le deuxième est mis en avant : c'est le palier où
// la recharge cesse d'être un essai. Aucun bonus pour l'instant — en
// promettre un qu'on n'a pas mesuré, c'est promettre une marge qu'on ignore.
const MONTANTS = [
    { usd: 2,  messages: 200 },
    { usd: 5,  messages: 500, net: true },
    { usd: 10, messages: 1000 },
    { usd: 20, messages: 2000 },
];

// Combien de messages pour une somme en dollars. `Math.floor` : on ne vend
// jamais un message qu'on n'a pas été payé, et le reste va au solde.
function messagesPour(montantUSD) {
    const n = Number(montantUSD);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n / PRIX_MESSAGE_USD);
}

// Un montant est-il acceptable en recharge ? Renvoie une RAISON quand c'est
// non, pour que la page puisse la dire au lieu d'un refus muet.
function verifierMontant(montantUSD) {
    const n = Number(montantUSD);
    if (!Number.isFinite(n)) return { ok: false, raison: "montant illisible" };
    if (n < MINIMUM_RECHARGE_USD) {
        return { ok: false, raison: `le minimum est de ${MINIMUM_RECHARGE_USD} $` };
    }
    // Un plafond existe pour la même raison qu'un minimum : une erreur de
    // frappe à quatre zéros ne doit pas partir chez l'opérateur de paiement.
    if (n > 500) return { ok: false, raison: "au-delà de 500 $, écris-nous plutôt" };
    return { ok: true, montant: n };
}

module.exports = {
    DEVISE_COMPTE,
    PRIX_MESSAGE_USD,
    MINIMUM_RECHARGE_USD,
    MONTANTS,
    messagesPour,
    verifierMontant,
};
