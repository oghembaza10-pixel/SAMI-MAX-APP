// ==========================================================================
// SAMII OS — L'ACADÉMIE : LA RÈGLE DU LIEU
//
// L'Académie n'est plus seulement une bibliothèque : c'est le lieu où des
// développeurs construisent sur SAMII, et où des marchands viennent les
// chercher. Un lieu où de l'argent change de mains a besoin d'une règle
// écrite, acceptée avant d'entrer, et d'un seul endroit qui la porte. C'est
// ce fichier.
//
// DEUX CHIFFRES, UN SEUL ENDROIT. Le taux de commission et la version du
// contrat vivent ici et nulle part ailleurs. Même leçon que config/paliers.js :
// un taux écrit à deux endroits finit par diverger, et le jour où il diverge,
// on prélève une part qu'on n'a jamais annoncée.
//
// LE TAUX EST FIGÉ SUR CHAQUE TRANSACTION. Changer TAUX_COMMISSION ici ne
// touche que les transactions à venir : chaque ligne garde le taux qui
// s'appliquait le jour où elle a été créée (services/academie.js). Sans ça,
// baisser la commission réécrirait le passé et fausserait toute la
// comptabilité des développeurs.
//
// LA VERSION DU CONTRAT COMMANDE LA PORTE. Un membre qui a accepté la 1.0 ne
// passe plus quand le contrat devient 1.1 : il doit relire et réaccepter.
// C'est la seule façon honnête de modifier les règles d'un lieu où des gens
// gagnent leur vie.
//
// À FAIRE RELIRE PAR UN JURISTE avant d'ouvrir à du volume réel. Ce texte est
// clair et loyal, il n'est pas un acte notarié.
// ==========================================================================

// 10 % — la part de SAMII sur chaque transaction conclue dans l'Académie.
const TAUX_COMMISSION = 0.10;

// Change cette version dès que le texte du contrat change, jamais autrement.
const CONTRAT_VERSION = "1.0";

// Les deux façons d'entrer. Un même compte peut porter les deux : un
// développeur achète aussi, et un marchand finit parfois par publier.
const ROLES = ["developpeur", "client"];

// Le texte exact soumis à l'acceptation. Il est haché au moment où quelqu'un
// coche la case (services/academie.js) : on peut donc prouver plus tard quel
// texte précis a été accepté, et pas seulement quel numéro de version.
const CONTRAT = {
    version: CONTRAT_VERSION,
    titre: "Contrat de l'Académie SAMII",
    resume: "Entrer est gratuit. Publier est gratuit. SAMII prend 10 % sur les transactions conclues ici.",
    articles: [
        {
            titre: "1. Ce que vous gardez",
            texte: "Vous restez propriétaire du code que vous écrivez, de votre marque et de vos clients. "
                 + "SAMII ne revendique aucun droit de propriété sur vos applications ni sur vos travaux.",
        },
        {
            titre: "2. Ce que SAMII apporte",
            texte: "SAMII met à votre disposition son infrastructure, son API, ses permissions, ses webhooks, "
                 + "son catalogue et ses marchands. Vous n'avez ni frais d'entrée, ni frais de publication, "
                 + "ni abonnement à payer pour être présent dans l'Académie.",
        },
        {
            titre: "3. Le partenariat",
            texte: "Pour toute application créée dans l'Académie et pour tout travail vendu ici, SAMII est votre "
                 + "partenaire de commercialisation : il présente votre offre à ses marchands, porte la relation "
                 + "de paiement et garantit l'accès technique au moment de la vente.",
        },
        {
            titre: "4. La part de SAMII : 10 %",
            texte: "SAMII prélève 10 % du montant de chaque transaction conclue dans l'Académie — vente ou "
                 + "location d'application, mission, prestation. Le taux applicable est celui en vigueur le jour "
                 + "de la transaction et reste figé sur celle-ci. Les 90 % restants vous reviennent.",
        },
        {
            titre: "5. Rien n'est dû tant que rien n'est vendu",
            texte: "Aucune commission n'est due sur un échange, un devis, un essai ou une application installée "
                 + "gratuitement. La part de SAMII naît au moment où un paiement est encaissé, et jamais avant.",
        },
        {
            titre: "6. Conclure ailleurs",
            texte: "Vous rencontrer ici et conclure ailleurs pour éviter la commission met fin à votre présence "
                 + "dans l'Académie. Nous préférons le dire simplement plutôt que de le découvrir.",
        },
        {
            titre: "7. Ce que le marchand accorde, il le reprend",
            texte: "Un marchand qui installe votre application choisit les permissions qu'il accorde et peut les "
                 + "reprendre à tout moment, d'un seul geste. Vous ne pouvez demander que ce dont votre "
                 + "application a réellement besoin.",
        },
        {
            titre: "8. Suspension",
            texte: "SAMII peut suspendre une application ou un membre qui met en danger les données d'un marchand, "
                 + "trompe sur ce qu'il vend, ou ne livre pas ce qui a été payé. Les sommes déjà dues au titre "
                 + "d'un travail livré restent dues.",
        },
        {
            titre: "9. Modification des règles",
            texte: "Si ce contrat change, une nouvelle version vous est présentée et vous devez l'accepter avant "
                 + "de continuer. Les transactions déjà conclues restent régies par la version acceptée ce jour-là.",
        },
    ],
};

// Ce qu'on facture, et sur quoi. Une transaction sans type reconnu n'entre pas
// dans le registre : mieux vaut refuser une ligne que compter faux.
const TYPES_TRANSACTION = {
    app_achat: "Achat d'une application",
    app_abonnement: "Abonnement à une application",
    mission: "Mission ou prestation",
    location: "Location d'un espace ou d'un QG",
};

// Calcule le partage. Arrondi au centime, et la part du vendeur est toujours
// le reste — jamais un second arrondi, sinon un centime disparaît et les
// comptes ne tombent plus jamais juste.
function partager(montantBrut, taux = TAUX_COMMISSION) {
    const brut = Math.round(Number(montantBrut) * 100) / 100;
    if (!(brut > 0)) return null;
    const commission = Math.round(brut * taux * 100) / 100;
    return { brut, taux, commission, net: Math.round((brut - commission) * 100) / 100 };
}

module.exports = { TAUX_COMMISSION, CONTRAT_VERSION, CONTRAT, ROLES, TYPES_TRANSACTION, partager };
