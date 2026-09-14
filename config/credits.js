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
// Un message coûte 3 centimes, un acte de 5 à 11 selon ce qu'il mobilise —
// voir la grille plus bas, et `config/economie.js` pour ce qui la justifie.
// La recharge minimale reste de 2 $ : assez pour que ça vaille le geste,
// assez peu pour qu'on le fasse sans réfléchir.
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
// ── LE PRIX D'UN MESSAGE DANS LE QG ──────────────────────────────────────
//
// 0,01 $ → 0,03 $, et c'est la seule hausse que ce chantier applique au
// geste quotidien.
//
// MESURÉ en HTTP réel : un message du QG déclenche DEUX appels Gemini, pas
// un. Le second est l'extraction de mémoire, que personne n'a demandée et
// que personne ne payait. À 0,01 $, le message était vendu à perte dès que
// Google double ses tarifs au 01/01/2027 — coût estimé 0,019 $ pour 0,01 $
// encaissé.
//
// 3 crédits laissent 69 % de marge aujourd'hui et 37 % après le doublement.
// La grille est dimensionnée sur 2027 EXPRÈS : annoncer une hausse en
// janvier à des marchands qui viennent de s'habituer est le pire moment
// possible pour en annoncer une.
const PRIX_MESSAGE_USD = 0.03;

// Un acte : quelque chose qui existe maintenant et n'existait pas avant.
// ── LES ACTES NE COÛTENT PLUS TOUS LE MÊME PRIX ──────────────────────────
//
// ⚠️ C'ÉTAIT LE DÉFAUT ÉCONOMIQUE CENTRAL DU PRODUIT.
//
// Dix actes, un seul prix — alors que leur consommation MESURÉE va de trois
// appels Gemini à sept. Une `preparer_publication` (7 appels) était vendue
// au prix d'un `passer_commande` (3 appels), donc à perte dès 2027.
//
// Les cinq prix ci-dessous suivent les catégories de `config/economie.js`,
// elles-mêmes adossées aux appels comptés un par un en HTTP réel.
//
// CE QUI NE BOUGE PAS : l'acte simple. C'est le geste le plus fréquent du
// produit — enregistrer une commande, poser un rendez-vous — et il reste à
// 0,05 $. Un marchand qui vend et prend des rendez-vous ne voit aucune
// hausse sur ce qu'il fait toute la journée.
const PRIX_ACTE_SIMPLE_USD = 0.05;      //  5 crédits — 3 appels mesurés
const PRIX_ACTE_OUTIL_USD = 0.06;       //  6 crédits — 4 appels mesurés
const PRIX_ACTE_COMPLEXE_USD = 0.07;    //  7 crédits — 4 appels + bac d'exécution
const PRIX_RECHERCHE_USD = 0.08;        //  8 crédits — 3 appels + grounding à la requête
const PRIX_CHAINE_USD = 0.11;           // 11 crédits — 7 appels mesurés

// Conservé : d'autres fichiers du projet le lisent encore, et le retirer
// dépasserait le périmètre de ce chantier. Il vaut désormais le prix de
// l'acte simple, qui est le cas le plus courant.
const PRIX_ACTE_USD = PRIX_ACTE_SIMPLE_USD;

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
    passer_commande:        { prix: PRIX_ACTE_SIMPLE_USD, libelle: "commande enregistrée" },
    prendre_rendez_vous:    { prix: PRIX_ACTE_SIMPLE_USD, libelle: "rendez-vous pris" },
    envoyer_facture:        { prix: PRIX_ACTE_OUTIL_USD, libelle: "facture envoyée" },
    envoyer_email:          { prix: PRIX_ACTE_SIMPLE_USD, libelle: "e-mail envoyé" },
    creer_evenement_agenda: { prix: PRIX_ACTE_SIMPLE_USD, libelle: "événement d'agenda" },
    creer_rapport_sheets:   { prix: PRIX_ACTE_OUTIL_USD, libelle: "rapport créé" },
    rechercher_prospects:   { prix: PRIX_RECHERCHE_USD, libelle: "recherche de prospects" },

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
    preparer_publication:   { prix: PRIX_CHAINE_USD, libelle: "publication préparée" },

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
    executer_code:          { prix: PRIX_ACTE_COMPLEXE_USD, libelle: "programme exécuté" },

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
    preparer_strategie:     { prix: PRIX_CHAINE_USD, libelle: "stratégie préparée" },
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
    // ⚠️ `= []` NE COUVRE QUE `undefined`, PAS `null`.
    //
    // `factureDuTour(null)` levait « actes is not iterable » — une exception
    // au milieu du calcul d'une facture. Le seul appelant du projet se
    // protège en amont (`Array.isArray`), donc la panne n'était pas visible ;
    // mais la fonction est exportée, et le prochain appelant ne le saura pas.
    //
    // Une fonction de facturation ne doit jamais lever : dans le doute, elle
    // ne facture rien. Trouvé par la suite `grille`, pas par la relecture.
    const liste = Array.isArray(actes) ? actes : [];
    const lignes = [];
    if (avecMessage) lignes.push({ quoi: "message", montant: PRIX_MESSAGE_USD });
    for (const acte of liste) {
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
// ── LES MONTANTS DE RECHARGE ─────────────────────────────────────────────
//
// ⚠️ LE NOMBRE DE MESSAGES ÉTAIT ÉCRIT EN DUR, ET C'EST UN PIÈGE DISCRET.
//
// « 2 $ = 200 messages » était juste tant qu'un message valait 0,01 $. En le
// passant à 0,03 $, la promesse devenait FAUSSE — sans qu'aucune ligne de
// code ne change, et sans qu'aucun test ne le voie. Un chiffre recopié à
// côté de sa source finit toujours par la contredire.
//
// Les équivalences se CALCULENT donc, à partir du seul prix qui fait foi.
//
// Les montants eux-mêmes ne bougent pas : 2 $ ≈ 270 DZD au taux officiel,
// et c'est déjà le bon ordre de grandeur pour un premier geste au Maghreb.
// Les changer est une décision commerciale, pas une conséquence de ce
// chantier.
const MONTANTS = [
    { usd: 2 },
    { usd: 5, net: true },
    { usd: 10 },
    { usd: 20 },
].map((m) => ({
    ...m,
    // Ce que le solde vaut, dans l'unité que la personne voit.
    credits: Math.round(m.usd / 0.01),
    // Et ce que ça permet, dans les mots du produit. `Math.floor` : on
    // n'annonce jamais un message qu'on ne peut pas tenir.
    messages: Math.floor(m.usd / PRIX_MESSAGE_USD),
}));

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

// ══════════════════════════════════════════════════════════════════════════
// CE QUE LA PAGE MONTRE — LU ICI, JAMAIS RECOPIÉ
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CETTE FONCTION EXISTE POUR QU'UNE PAGE NE PUISSE PAS MENTIR.
//
// `MONTANTS` portait « 2 $ = 200 messages », écrit en dur à côté de sa
// source. Juste tant qu'un message valait 1 centime ; faux le jour où il en
// a valu 3, sans qu'une seule ligne change. Le même piège attend n'importe
// quel gabarit qui recopierait un prix : la page et la facture divergent, et
// c'est le client qui découvre l'écart.
//
// Les vues lisent donc CETTE fonction, qui lit les mêmes constantes que
// `factureDuTour`. Afficher et facturer deviennent physiquement le même
// nombre.
//
// Les libellés sont en français et passent par `L()` dans le gabarit : la
// clé de traduction est la phrase elle-même (voir services/langue.js).
//
// ── CE QUI N'EST PAS ICI, ET NE DOIT JAMAIS Y ÊTRE ───────────────────────
//
// Aucun appel Gemini, aucun token, aucun coût fournisseur, aucune marge.
// Le client achète « envoyer une facture », pas « quatre requêtes d'API ».
// Lui montrer la plomberie ne l'aide pas à décider — ça lui apprend à
// comparer SAMII à une facture Google, ce qui n'est pas le même produit.
function grilleVisible() {
    const c = (usd) => Math.round(usd / 0.01);
    return [
        { icone: "💬", quoi: "Parler avec SAMII", credits: 0,
          detail: "Les conversations avec tes clients ne coûtent rien" },
        { icone: "🧠", quoi: "Travailler dans ton QG", credits: c(PRIX_MESSAGE_USD),
          detail: "Un message à SAMII dans ton espace de travail" },
        { icone: "⚡", quoi: "Action simple", credits: c(PRIX_ACTE_SIMPLE_USD),
          detail: "Enregistrer une commande, poser un rendez-vous, envoyer un e-mail" },
        { icone: "🖼", quoi: "Image ou document", credits: c(0.04),
          detail: "SAMII lit une photo, une facture, un PDF" },
        { icone: "🔧", quoi: "Action avec un outil", credits: c(PRIX_ACTE_OUTIL_USD),
          detail: "Envoyer une facture, créer un rapport" },
        { icone: "🤖", quoi: "Étape d'agent", credits: c(PRIX_ACTE_SIMPLE_USD),
          detail: "Un maillon d'une mission qui travaille pour toi" },
        { icone: "💻", quoi: "Exécuter du code", credits: c(PRIX_ACTE_COMPLEXE_USD),
          detail: "SAMII écrit un programme et le fait tourner" },
        { icone: "🔎", quoi: "Recherche sur le web", credits: c(PRIX_RECHERCHE_USD),
          detail: "Trouver de vrais prospects, vérifier une information" },
        { icone: "🚀", quoi: "Mission complète", credits: c(PRIX_CHAINE_USD),
          detail: "Plusieurs spécialistes qui se relaient sur un vrai travail" },
    ];
}

module.exports = {
    grilleVisible,
    PRIX_ACTE_SIMPLE_USD, PRIX_ACTE_OUTIL_USD, PRIX_ACTE_COMPLEXE_USD,
    PRIX_RECHERCHE_USD, PRIX_CHAINE_USD,
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
