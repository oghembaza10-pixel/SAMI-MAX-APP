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
// ── CE QUE LE SOLDE PAIE : LE TRAVAIL DE SAMII, PAS SES PHRASES ───────────
//
// Le solde ne sert pas qu'à parler. Il paie ce que SAMII FAIT : confirmer une
// commande, prendre un rendez-vous, envoyer une facture. C'est là qu'est la
// valeur pour un marchand — une conversation agréable ne remplit pas un
// carnet de commandes.
//
// Donc deux prix, et un principe pour les départager :
//
//   CE QUI LIT est compris dans le message. Consulter son agenda, relire ses
//   commandes, demander le résumé de la journée : SAMII regarde des données
//   qui appartiennent déjà à la personne. Faire payer un supplément pour lire
//   ses propres affaires serait un péage sur sa propre porte.
//
//   CE QUI CRÉE OU ENVOIE se paie. Une commande enregistrée, un rendez-vous
//   posé, une facture partie : quelque chose existe maintenant qui n'existait
//   pas avant, chez le marchand comme chez son client.
//
// Un message coûte 1 centime, un acte 5. La recharge minimale est de 2 $ :
// assez pour que ça vaille le geste, assez peu pour qu'on le fasse sans
// réfléchir.
//
// ── LE TAUX DU DINAR ──────────────────────────────────────────────────────
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

// Un acte : quelque chose qui existe maintenant et n'existait pas avant.
const PRIX_ACTE_USD = 0.05;

// ── LE TARIF DES ACTES ────────────────────────────────────────────────────
//
// La liste est explicite des DEUX côtés. Ce qui se paie est nommé ; ce qui
// est gratuit est nommé AUSSI, avec sa raison. Sans la seconde moitié, le
// premier outil ajouté demain tomberait du côté gratuit par simple oubli, et
// personne ne saurait dire si c'était voulu.
//
// Les noms sont ceux des outils de brain/planner.js. Un test vérifie que les
// deux listes couvrent exactement les outils existants : un outil ajouté sans
// décision de prix fait échouer la suite, et c'est le but.
const ACTES = {
    passer_commande:        { prix: PRIX_ACTE_USD, libelle: "commande enregistrée" },
    prendre_rendez_vous:    { prix: PRIX_ACTE_USD, libelle: "rendez-vous pris" },
    envoyer_facture:        { prix: PRIX_ACTE_USD, libelle: "facture envoyée" },
    envoyer_email:          { prix: PRIX_ACTE_USD, libelle: "e-mail envoyé" },
    creer_evenement_agenda: { prix: PRIX_ACTE_USD, libelle: "événement d'agenda" },
    creer_rapport_sheets:   { prix: PRIX_ACTE_USD, libelle: "rapport créé" },
    rechercher_prospects:   { prix: PRIX_ACTE_USD, libelle: "recherche de prospects" },

    // ── UN ACTE QUI N'EST PAS UN GESTE, MAIS UNE CHAÎNE ──────────────────
    //
    // ⚠️ À REVOIR À LA PASSE TARIFAIRE, ET C'EST LE CAS LE PLUS URGENT DE
    // LA LISTE.
    //
    // Les autres actes coûtent UN aller-retour au fournisseur. Celui-ci en
    // coûte plusieurs : rédaction, puis une adaptation par plateforme
    // demandée, puis une relecture par variante. Trois plateformes, c'est
    // déjà sept ou huit appels facturés au prix d'un seul.
    //
    // On le pose quand même au tarif ordinaire aujourd'hui, pour deux
    // raisons : la passe tarifaire est reportée par décision produit, et un
    // acte SANS prix serait pire — `factureDuTour` refuse de deviner, et la
    // suite crédits refuse un outil dont personne n'a tranché le prix.
    //
    // Ce qu'il faudra trancher : un prix par variante produite, ou un prix
    // de mission plus élevé. Tant que ce n'est pas fait, plus un marchand
    // vise de plateformes, moins la marge est bonne.
    preparer_publication:   { prix: PRIX_ACTE_USD, libelle: "publication préparée" },

    // ── L'EXÉCUTION DE CODE ───────────────────────────────────────────────
    //
    // ⚠️ À REVOIR À LA PASSE TARIFAIRE, avec preparer_publication.
    //
    // Le coût ici n'est PAS le même que celui des autres actes : une boucle
    // de correction, c'est jusqu'à trois exécutions et deux appels d'IA. Mais
    // c'est aussi le seul acte qui consomme du CPU sur NOTRE machine, et on
    // ne saura ce que ça coûte réellement qu'en le mesurant en service.
    //
    // On le pose au tarif ordinaire aujourd'hui pour la même raison que
    // l'autre : un acte SANS prix est refusé par la suite crédits, et
    // improviser un chiffre serait pire que de reporter la question.
    executer_code:          { prix: PRIX_ACTE_USD, libelle: "programme exécuté" },

    // ── UNE MISSION LONGUE NE SE FACTURE PAS PARCE QU'ELLE TOURNE ────────
    //
    // ⚠️ À REVOIR À LA PASSE TARIFAIRE, avec les deux autres.
    //
    // Le piège de ce chantier serait de facturer le TEMPS. Une mission qui
    // tourne dix minutes et rend du vide ne doit rien coûter à personne :
    // c'est notre machine qui a peiné, pas le marchand qui a reçu quelque
    // chose.
    //
    // Ce prix ne se déclenche donc QUE si la mission arrive à `terminee`,
    // c'est-à-dire toutes les étapes passées ET le résultat vérifié. Une
    // mission échouée, annulée ou expirée ne génère aucune ligne.
    preparer_strategie:     { prix: PRIX_ACTE_USD, libelle: "stratégie préparée" },
};

const GRATUITS = {
    // ── LE PIÈGE ÉVITÉ DE JUSTESSE : NE PAS FACTURER DEUX FOIS ───────────
    //
    // Confirmer une commande EST payant — mais pas ici. Ça l'était déjà
    // avant ce fichier : services/confirmationsQuota.js accorde un quota
    // journalier gratuit puis compte chaque confirmation au-delà, au prix
    // qu'il fixe (PRIX_DEPASSEMENT_USD). Ajouter un second prix ici aurait
    // facturé la même confirmation deux fois, par deux systèmes qui
    // s'ignorent — et personne ne l'aurait vu avant une réclamation.
    //
    // Ce que la recharge change pour les confirmations n'est donc pas le
    // prix : c'est le MOYEN DE PAIEMENT. Au lieu d'une ardoise qu'il faut
    // ensuite régulariser par un lien à part, la confirmation est réglée
    // tout de suite sur le solde. L'ardoise ne sert plus que de filet quand
    // le solde est vide.
    confirmer_commande: "déjà facturée par services/confirmationsQuota.js — ne jamais compter deux fois",
    // Annuler, c'est déjà une mauvaise nouvelle. Faire payer quelqu'un pour
    // encaisser une annulation, c'est facturer la perte en plus de la subir.
    annuler_commande: "une annulation ne se facture pas",
    // L'étape AVANT le rendez-vous. La facturer ferait payer deux fois une
    // seule prise de rendez-vous — une fois les créneaux, une fois le rendez-
    // vous — et pénaliserait le client qui hésite entre deux horaires.
    proposer_creneaux_rdv: "c'est l'étape avant le rendez-vous, qui est déjà payant",
    // Lire ses propres affaires. Voir l'en-tête de ce fichier.
    resume_journee: "lire ses propres données",
    consulter_gmail: "lire ses propres données",
    consulter_agenda: "lire ses propres données",
    lister_fichiers_drive: "lire ses propres données",
};

// Ce que coûte un acte. Zéro pour tout ce qui n'est pas au tarif — y compris
// un nom inconnu : on n'invente jamais un prix, on ne facture pas ce qu'on ne
// sait pas nommer.
function prixActe(nom) {
    return ACTES[nom]?.prix || 0;
}

// ── LA FACTURE D'UN TOUR DE CONVERSATION ──────────────────────────────────
//
// Un message, plus les actes RÉUSSIS. Un acte qui a échoué ne se facture
// pas : c'est la même règle que pour le message sans réponse — on ne fait
// jamais payer une panne qui est chez nous.
//
// `avecMessage` à false pour les canaux où le marchand paie les actes de
// SAMII sans payer chaque phrase échangée avec son client (Telegram,
// WhatsApp) : sinon une boutique qui marche bien serait punie par le volume
// de sa propre clientèle.
function factureDuTour(actes = [], { avecMessage = true } = {}) {
    const lignes = [];
    if (avecMessage) lignes.push({ quoi: "message", montant: PRIX_MESSAGE_USD });
    for (const acte of actes) {
        const nom = typeof acte === "string" ? acte : acte?.nom;
        const reussi = typeof acte === "string" ? true : acte?.reussi !== false;
        if (!reussi) continue;
        const prix = prixActe(nom);
        if (prix > 0) lignes.push({ quoi: nom, montant: prix, libelle: ACTES[nom].libelle });
    }
    const montant = Math.round(lignes.reduce((s, l) => s + l.montant, 0) * 100) / 100;
    return { montant, lignes };
}

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
    PRIX_ACTE_USD,
    ACTES,
    GRATUITS,
    prixActe,
    factureDuTour,
    MINIMUM_RECHARGE_USD,
    MONTANTS,
    messagesPour,
    verifierMontant,
};
