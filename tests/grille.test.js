// ==========================================================================
// SAMII OS — LA GRILLE TARIFAIRE : CE QUE LE CLIENT PAIE, ET POURQUOI
// ==========================================================================
//
// ── CE QUI A CHANGÉ, ET CE QUI N'A PAS CHANGÉ ────────────────────────────
//
// Avant : DEUX constantes plates. Un message à 0,01 $, et DIX actes au même
// prix de 0,05 $ — alors que leur consommation mesurée va de un appel à
// sept. Un `preparer_publication` (7 appels) était vendu au prix d'un
// `passer_commande` (3 appels).
//
// Après : une grille par CATÉGORIE D'USAGE, adossée aux appels réellement
// mesurés en HTTP réel lors des chantiers précédents.
//
// ── LA DÉCISION N'EST PAS UN CALCUL ──────────────────────────────────────
//
// `config/credits.js` reste la liste de prix qui FAIT FOI : des nombres
// écrits par un humain, qu'on peut lire et discuter. `config/economie.js`
// dit ce que les choses COÛTENT.
//
// On ne fait pas lire l'un par l'autre — sinon les prix du produit
// changeraient tout seuls le jour où Google bouge les siens, et personne ne
// s'en apercevrait. Cette suite est le LIEN : elle vérifie que la décision
// et le modèle de coût ne divergent pas en silence.
//
// ── CE QUI EST MESURÉ ET CE QUI NE L'EST PAS ─────────────────────────────
//
// MESURÉ : le nombre d'appels par catégorie (HTTP réel, base neuve).
// ESTIMÉ : les tokens par appel, donc les dollars. Aucune clé Gemini n'est
//          disponible dans l'environnement de développement. Les marges
//          calculées ici sont des ESTIMATIONS, et les seuils sont larges
//          exprès : ils gardent un ORDRE DE GRANDEUR, pas une décimale.
//
// Lancer :  node tests/grille.test.js
// ==========================================================================

const CREDITS = require("../config/credits");
const ECO = require("../config/economie");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };
const proche = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

// ══════════════════════════════════════════════════════════════════════════
// 1. L'UNITÉ : 1 CRÉDIT = 1 CENTIME, PARTOUT
// ══════════════════════════════════════════════════════════════════════════
//
// Le portefeuille tient une comptabilité en DOLLARS, en partie double. Le
// crédit est une unité d'AFFICHAGE posée par-dessus — pas une seconde
// monnaie. Deux monnaies dans un même ledger, c'est deux vérités et un jour
// d'écart entre elles.
{
    verifier(ECO.CREDIT.valeurUSD === 0.01,
        `un crédit vaut ${ECO.CREDIT.valeurUSD} $ au lieu de 0,01 — toute la grille est ` +
        "exprimée en crédits entiers, changer l'unité les rend tous faux");
    verifier(CREDITS.DEVISE_COMPTE === "USD",
        "le portefeuille ne tient plus ses comptes en dollars : la conversion en crédits " +
        "n'aurait plus de base");
    verifier(ECO.creditsPour(0.05) === 5 && ECO.usdPourCredits(5) === 0.05,
        "l'aller-retour crédits ↔ dollars ne se referme pas");
}

// ══════════════════════════════════════════════════════════════════════════
// 2. CHAQUE PRIX DU PRODUIT TOMBE SUR UN NOMBRE ENTIER DE CRÉDITS
// ══════════════════════════════════════════════════════════════════════════
//
// « Je recharge 500 crédits, je peux faire environ 100 actions. » Cette
// phrase ne tient que si aucun prix ne vaut 2,5 crédits. Un prix qui ne
// tombe pas juste oblige à arrondir quelque part, et l'arrondi finit
// toujours par se voir dans le solde.
{
    const prix = [CREDITS.PRIX_MESSAGE_USD, ...Object.values(CREDITS.ACTES).map((a) => a.prix)];
    for (const p of prix) {
        const cr = p / ECO.CREDIT.valeurUSD;
        verifier(Number.isInteger(Math.round(cr * 1e6) / 1e6) && proche(cr, Math.round(cr), 1e-9),
            `le prix ${p} $ vaut ${cr} crédits : un prix qui ne tombe pas sur un entier oblige ` +
            "à arrondir, et l'arrondi se voit dans le solde");
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 3. LES PRIX SUIVENT LA CONSOMMATION MESURÉE
// ══════════════════════════════════════════════════════════════════════════
//
// LE DÉFAUT CENTRAL DE L'ANCIENNE GRILLE : dix actes au même prix, de un à
// sept appels. On vérifie maintenant que l'ordre des prix suit l'ordre des
// coûts — pas au centime près, mais dans le bon sens.
{
    for (const [id, cat] of Object.entries(ECO.CATEGORIES)) {
        for (const acte of cat.actes || []) {
            const prix = CREDITS.prixActe(acte);
            const attendu = ECO.usdPourCredits(cat.creditsRecommandes);
            verifier(proche(prix, attendu, 1e-9),
                `« ${acte} » est facturé ${prix} $ alors que sa catégorie (${id}) recommande ` +
                `${attendu} $. La décision et le modèle de coût ont divergé`);
        }
    }

    // L'ordre, explicitement : une chaîne de sept appels ne peut pas coûter
    // le prix d'un acte de trois.
    const p = (a) => CREDITS.prixActe(a);
    verifier(p("preparer_publication") > p("passer_commande"),
        `une chaîne d'agents (7 appels mesurés) est facturée ${p("preparer_publication")} $ et un ` +
        `acte simple (3 appels) ${p("passer_commande")} $ — c'est exactement le défaut qu'on corrige`);
    verifier(p("executer_code") > p("passer_commande"),
        "exécuter un programme coûte le même prix qu'enregistrer une commande");
    verifier(p("rechercher_prospects") > p("passer_commande"),
        "une recherche web, qui porte en plus le grounding facturé à la requête, coûte le prix " +
        "d'un acte simple");
    verifier(p("envoyer_facture") >= p("passer_commande"),
        "un acte outillé coûte moins cher qu'un acte simple");
}

// ══════════════════════════════════════════════════════════════════════════
// 4. AUCUNE CATÉGORIE N'EST VENDUE À PERTE — NI EN 2026, NI EN 2027
// ══════════════════════════════════════════════════════════════════════════
//
// La grille est DIMENSIONNÉE SUR LE TARIF 2027, pas sur celui d'aujourd'hui.
// Google double ses prix au 01/01/2027 : une grille calée sur 2026 devrait
// être refaite en janvier, et une hausse de prix annoncée à des marchands
// qui viennent de s'habituer est le pire moment possible.
{
    for (const [id, cat] of Object.entries(ECO.CATEGORIES)) {
        if (!cat.creditsRecommandes) continue;   // gratuit assumé, voir bloc 5
        for (const [annee, apres] of [["2026", false], ["2027", true]]) {
            const m = ECO.margeCategorie(id, cat.creditsRecommandes, { apres2026: apres });
            verifier(m && m.marge > 0,
                `${id} est vendue À PERTE en ${annee} : prix ${m && m.prix} $, coût ${m && m.cout.toFixed(4)} $`);
        }
        // Et une marge qui tient encore après le doublement.
        const m27 = ECO.margeCategorie(id, cat.creditsRecommandes, { apres2026: true });
        verifier(m27.taux >= 0.30,
            `${id} : marge de ${Math.round(m27.taux * 100)} % après le doublement de janvier 2027 — ` +
            "en dessous de 30 %, la moindre erreur d'estimation la fait passer sous zéro");
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 5. ET AUCUNE N'EST VENDUE TROP CHER
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CETTE GARDE COMPTE AUTANT QUE LA PRÉCÉDENTE.
//
// SAMII s'adresse à des marchands du Maghreb et d'Afrique de l'Ouest. Une
// marge de 80 % sur un produit qu'ils utilisent tous les jours n'est pas une
// bonne affaire : c'est un produit qu'ils arrêtent d'utiliser.
//
// On borne donc des DEUX CÔTÉS. Un plafond de marge dans une suite de tests
// est inhabituel — c'est justement pour ça qu'il faut l'écrire : rien
// d'autre n'empêche une grille de dériver vers le haut, un ajustement à la
// fois.
{
    for (const [id, cat] of Object.entries(ECO.CATEGORIES)) {
        if (!cat.creditsRecommandes) continue;
        const m26 = ECO.margeCategorie(id, cat.creditsRecommandes);
        verifier(m26.taux <= 0.80,
            `${id} : ${Math.round(m26.taux * 100)} % de marge au tarif d'aujourd'hui. ` +
            "Au-delà de 80 %, SAMII devient cher pour ceux à qui il s'adresse");
    }

    // La conversation avec un client reste GRATUITE, et c'est un choix.
    verifier(ECO.CATEGORIES.A_conversation.creditsRecommandes === 0,
        "la conversation avec un client de boutique est devenue payante : c'est le canal " +
        "d'acquisition du marchand, il paie les ACTES, pas les mots de ses clients");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LES ACTES GRATUITS LE RESTENT
// ══════════════════════════════════════════════════════════════════════════
//
// Lire ses propres données ne se facture pas. Et `confirmer_commande` est
// déjà facturée ailleurs (services/confirmationsQuota.js) : la compter ici
// serait un double débit.
{
    for (const nom of Object.keys(CREDITS.GRATUITS)) {
        verifier(CREDITS.prixActe(nom) === 0,
            `« ${nom} » est déclaré gratuit mais facturé ${CREDITS.prixActe(nom)} $ — ` +
            `motif déclaré : ${CREDITS.GRATUITS[nom]}`);
    }
    verifier(CREDITS.prixActe("confirmer_commande") === 0,
        "confirmer_commande est facturée ici ALORS QU'ELLE L'EST DÉJÀ par confirmationsQuota : " +
        "double débit sur le geste le plus fréquent du produit");
    verifier(CREDITS.prixActe("un_acte_qui_nexiste_pas") === 0,
        "un acte inconnu est facturé : une faute de frappe dans un nom d'outil deviendrait " +
        "une ligne de débit");
}

// ══════════════════════════════════════════════════════════════════════════
// 7. UN ACTE RATÉ NE SE FACTURE PAS, ET NE SE COMPTE PAS DEUX FOIS
// ══════════════════════════════════════════════════════════════════════════
{
    const rate = CREDITS.factureDuTour([{ nom: "preparer_publication", reussi: false }], { avecMessage: false });
    verifier(rate.montant === 0,
        `un acte raté est facturé ${rate.montant} $ : on ne facture jamais un échec`);

    const reussi = CREDITS.factureDuTour([{ nom: "preparer_publication", reussi: true }], { avecMessage: false });
    verifier(reussi.montant === CREDITS.prixActe("preparer_publication"),
        "un acte réussi n'est pas facturé à son prix");

    // Deux actes différents s'additionnent ; le même acte deux fois aussi —
    // ce sont bien DEUX gestes, et c'est voulu.
    const deux = CREDITS.factureDuTour(
        [{ nom: "passer_commande", reussi: true }, { nom: "envoyer_facture", reussi: true }],
        { avecMessage: false });
    verifier(proche(deux.montant, CREDITS.prixActe("passer_commande") + CREDITS.prixActe("envoyer_facture"), 1e-9),
        `deux actes différents font ${deux.montant} $ au lieu de la somme de leurs prix`);

    // Le message n'est compté qu'une fois, et seulement si on le demande.
    const avec = CREDITS.factureDuTour([], { avecMessage: true });
    verifier(proche(avec.montant, CREDITS.PRIX_MESSAGE_USD, 1e-9),
        `un tour sans acte facture ${avec.montant} $ au lieu du seul message`);
    const sans = CREDITS.factureDuTour([], { avecMessage: false });
    verifier(sans.montant === 0,
        "un tour sans acte et sans message facture quand même quelque chose");

    // Un tour vide ne crée jamais de ligne.
    verifier(CREDITS.factureDuTour(null, { avecMessage: false }).montant === 0,
        "une liste d'actes illisible produit une facture");
}

// ══════════════════════════════════════════════════════════════════════════
// 8. LES RECHARGES DISENT LA VÉRITÉ
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ LE PIÈGE DE CE CHANTIER, ET IL ÉTAIT DISCRET.
//
// `MONTANTS` annonçait « 2 $ = 200 messages », un nombre ÉCRIT EN DUR. Il
// était juste tant qu'un message valait 0,01 $. En le passant à 0,03 $, la
// promesse devenait fausse — sans qu'aucune ligne de code ne change, et sans
// qu'aucun test existant ne le voie.
//
// Un chiffre recopié à côté de sa source finit toujours par la contredire.
{
    for (const m of CREDITS.MONTANTS) {
        verifier(m.credits === Math.round(m.usd / ECO.CREDIT.valeurUSD),
            `recharge de ${m.usd} $ : ${m.credits} crédits annoncés au lieu de ` +
            `${Math.round(m.usd / ECO.CREDIT.valeurUSD)}`);
        verifier(m.messages === Math.floor(m.usd / CREDITS.PRIX_MESSAGE_USD),
            `recharge de ${m.usd} $ : ${m.messages} messages annoncés alors que le prix du ` +
            `message (${CREDITS.PRIX_MESSAGE_USD} $) en donne ` +
            `${Math.floor(m.usd / CREDITS.PRIX_MESSAGE_USD)} — une promesse fausse sur la page de recharge`);
        verifier(m.usd >= CREDITS.MINIMUM_RECHARGE_USD,
            `une recharge de ${m.usd} $ est proposée alors que le minimum est de ` +
            `${CREDITS.MINIMUM_RECHARGE_USD} $`);
    }

    verifier(CREDITS.messagesPour(5) === Math.floor(5 / CREDITS.PRIX_MESSAGE_USD),
        "messagesPour ne suit plus le prix du message");
    verifier(CREDITS.verifierMontant(1).ok === false,
        "une recharge sous le minimum est acceptée");
    verifier(CREDITS.verifierMontant(5).ok === true,
        "une recharge de 5 $ est refusée");
    verifier(CREDITS.verifierMontant(-5).ok === false && CREDITS.verifierMontant("x").ok === false,
        "un montant négatif ou illisible est accepté à la recharge");

    // ── LA PLUS PETITE RECHARGE DOIT RESTER UTILE ────────────────────────
    //
    // Une recharge minimale qui ne permet que trois gestes n'est pas un
    // produit accessible, c'est une barrière déguisée.
    const plusPetite = CREDITS.MONTANTS[0];
    const actesSimples = Math.floor(plusPetite.usd / CREDITS.prixActe("passer_commande"));
    verifier(actesSimples >= 20,
        `la plus petite recharge (${plusPetite.usd} $) ne permet que ${actesSimples} actes simples : ` +
        "trop peu pour un marchand qui essaie SAMII pour la première fois");
}

// ══════════════════════════════════════════════════════════════════════════
// 9. LE GRATUIT RESTE EN DEHORS DES CRÉDITS
// ══════════════════════════════════════════════════════════════════════════
//
// Les messages gratuits sont une règle PRODUIT, comptée en messages dans une
// fenêtre de temps. Les convertir en crédits mélangerait deux systèmes qui
// n'ont pas la même unité ni le même but — et rendrait le gratuit débitable.
{
    const src = require("fs").readFileSync(
        require("path").join(__dirname, "..", "services/samiiQuota.js"), "utf8")
        .replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    verifier(!/credits|portefeuille|PRIX_MESSAGE/.test(src),
        "le quota gratuit lit le système de crédits : les 20 messages deviendraient " +
        "débitables, alors que ce sont deux mécaniques séparées");

    // ── CE GARDE EXIGEAIT QUE LA DIVERGENCE EXISTE ──────────────────────
    //
    // Il vérifiait `aligne === false` : la règle annoncée disait 20 / 5 h, le
    // code appliquait 30 / 7 h, et le chantier de l'époque interdisait d'y
    // toucher. Le garde tenait la divergence VISIBLE, ce qui était juste.
    //
    // Elle est corrigée. Exiger qu'elle persiste ferait échouer la suite pour
    // avoir fait exactement ce qu'il fallait faire.
    //
    // La règle durable n'a jamais été « il y a un écart » mais « la table dit
    // la vérité sur le code ». On la vérifie donc contre les constantes
    // réelles, alignées ou non : le jour où l'une des deux rebouge seule, la
    // table redeviendra fausse et ce garde le dira.
    const Q = require("../services/samiiQuota");
    verifier(ECO.GRATUIT.messagesCode === Q.QUOTA_GRATUIT_PAR_FENETRE
        && ECO.GRATUIT.heuresCode === Q.FENETRE_HEURES,
        `config/economie.js déclare ${ECO.GRATUIT.messagesCode} messages / ${ECO.GRATUIT.heuresCode} h ` +
        `alors que le code applique ${Q.QUOTA_GRATUIT_PAR_FENETRE} / ${Q.FENETRE_HEURES} h — ` +
        "une simulation bâtie sur la table serait fausse");
    verifier(ECO.GRATUIT.messagesCible === 20 && ECO.GRATUIT.heuresCible === 5,
        "la règle commerciale cible n'est plus déclarée : on ne saurait plus par rapport à quoi " +
        "mesurer un écart futur");
    verifier(ECO.GRATUIT.aligne === (ECO.GRATUIT.messagesCode === ECO.GRATUIT.messagesCible
        && ECO.GRATUIT.heuresCode === ECO.GRATUIT.heuresCible),
        `la table annonce aligne=${ECO.GRATUIT.aligne} alors que ses propres nombres disent le ` +
        "contraire — un booléen optimiste cacherait l'écart qu'il est censé montrer");
}

// ══════════════════════════════════════════════════════════════════════════
// 10. LA GRILLE RESTE LISIBLE POUR QUELQU'UN QUI N'EST PAS TECHNICIEN
// ══════════════════════════════════════════════════════════════════════════
//
// « Je recharge 500 crédits → je peux faire environ tant d'actions. » Si les
// prix s'étalent de 1 à 50 crédits, cette phrase n'a plus de sens.
{
    const enCredits = Object.values(ECO.CATEGORIES)
        .map((c) => c.creditsRecommandes).filter((n) => n > 0);
    const min = Math.min(...enCredits), max = Math.max(...enCredits);
    verifier(max / min <= 5,
        `les prix vont de ${min} à ${max} crédits (facteur ${(max / min).toFixed(1)}) : ` +
        "au-delà d'un facteur 5, personne ne peut plus estimer ce que sa recharge lui permet");
    verifier(enCredits.every((n) => Number.isInteger(n) && n <= 20),
        `un prix dépasse 20 crédits ou n'est pas entier : ${enCredits.join(", ")}`);
}

// ── VERDICT ──────────────────────────────────────────────────────────────
if (echecs.length) {
    console.log(`\n❌ grille tarifaire : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    echecs.forEach((e) => console.log(`   • ${e}`));
    process.exit(1);
}
console.log(`✅ grille tarifaire : ${verifs} vérifications passées`);
process.exit(0);
