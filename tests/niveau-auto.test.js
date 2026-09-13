// ==========================================================================
// SAMII OS — Auto choisit-il le bon niveau, et gratuitement ?
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE.
//
// Auto est le mode par défaut : c'est lui qui décidera de l'effort — donc du
// coût — de presque tous les messages. Quatre pannes possibles, et aucune ne
// ressemble à une panne :
//
//   1. IL COÛTE UN APPEL D'IA. La façon évidente de classer un message
//      serait de le demander à un modèle. On paierait deux fois et on
//      ajouterait une attente sur les questions simples — exactement celles
//      qui doivent répondre tout de suite.
//
//   2. IL RÉPOND DE MÉMOIRE. Le niveau « Rapide » ne porte AUCUN outil. Si
//      Auto y envoyait « combien coûte une livraison Alger → Oran ? », SAMII
//      inventerait un prix avec aplomb, sans rien vérifier. Un prix inventé
//      sur une question de prix, c'est la confiance perdue d'un coup.
//
//   3. IL S'EMBALLE. Sans plafond, « fais-moi un plan complet » devient une
//      façon pour n'importe qui de faire tourner le moteur le plus cher.
//
//   4. IL DÉCIDE À LA PLACE DE LA PERSONNE. Quelqu'un qui choisit « Rapide »
//      veut la vitesse. Monter d'un cran dans son dos, c'est dépenser son
//      argent sans le lui demander.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const A = require(path.join(RACINE, "services", "niveauAuto.js"));
const N = require(path.join(RACINE, "config", "niveaux.js"));

const choisir = (message, opts = {}) => A.choisir({ message, palier: "pro", ...opts });

// ── 1. AUCUN APPEL D'IA, AUCUNE ATTENTE ──────────────────────────────────
//
// La garde structurelle : si `choisir` rendait une promesse, c'est qu'il
// attendrait quelque chose — un réseau, un modèle. Il doit répondre tout de
// suite, sur le texte, en local.
{
    const r = choisir("Analyse mon entreprise");
    verifier(!(r instanceof Promise) && typeof r === "object",
        "choisir() rend une promesse : il attend quelque chose, donc il coûte du temps et " +
        "probablement de l'argent sur CHAQUE message");
    verifier(A.choisir.constructor.name !== "AsyncFunction",
        "choisir() est asynchrone : le classement doit être local et instantané");

    // Deux fois la même question donne le même niveau. Un classement qui
    // varie rendrait la facture imprévisible et le produit incompréhensible.
    const a = choisir("J'ai 500 000 DA, fais-moi un plan complet");
    const b = choisir("J'ai 500 000 DA, fais-moi un plan complet");
    verifier(a.niveau === b.niveau && a.score === b.score,
        "deux fois la même question donne deux niveaux différents");
}

// ── 2. LES GESTES SIMPLES RESTENT RAPIDES ────────────────────────────────
{
    for (const m of [
        "Bonjour",
        "Salut ça va ?",
        "Merci !",
        "Traduis-moi cette phrase en anglais",
        "Reformule ce message pour qu'il soit plus poli",
        "Corrige l'orthographe de ce texte",
    ]) {
        const r = choisir(m);
        verifier(r.niveau === "rapide",
            `« ${m} » part en « ${r.niveau} » au lieu de Rapide — une politesse ne doit pas ` +
            "déclencher le moteur cher");
    }
}

// ── 3. AUTO NE DESCEND JAMAIS À RAPIDE SANS GESTE RECONNU ────────────────
//
// LA GARDE CONTRE LA RÉPONSE INVENTÉE. Rapide ne porte aucun outil : il
// répond de mémoire. Une question factuelle envoyée là reçoit un chiffre
// plausible et faux.
{
    for (const m of [
        "Combien coûte une livraison Alger vers Oran ?",
        "C'est quoi un QG ?",
        "Mes ventes ont baissé ce mois-ci",
        "Aide-moi à écrire un message difficile à un client mécontent",
        "Est-ce que Yalidine livre à Tamanrasset ?",
    ]) {
        const r = choisir(m);
        verifier(r.niveau !== "rapide",
            `« ${m} » part en Rapide, qui ne porte AUCUN outil : SAMII répondrait de mémoire, ` +
            "et un chiffre inventé sur une question de prix fait perdre la confiance d'un coup");
        verifier(N.porteDesOutils(r.niveau),
            `« ${m} » part sur un niveau sans outil (${r.niveau}) : rien à vérifier, donc tout à inventer`);
    }
}

// ── 4. LE TRAVAIL EST RECONNU COMME TEL ──────────────────────────────────
{
    const plan = choisir("J'ai 500 000 DA, je veux lancer une boutique de vêtements sur Instagram. Fais-moi un plan complet.");
    verifier(N.comparer(plan.niveau, "pro") >= 0,
        `un plan d'affaires chiffré part en « ${plan.niveau} » : trop léger pour ce qu'il demande`);
    verifier(plan.raisons.some((r) => /montant/.test(r)),
        "les montants en jeu ne sont pas repérés dans une demande chiffrée");

    const lourd = choisir(
        "Compare le coût de Yalidine et de ZR Express pour 200 colis par mois vers Oran. " +
        "Quel est le seuil de rentabilité ? Dois-je négocier ? Fais-moi un prévisionnel sur " +
        "6 mois avec les scénarios haut et bas, et dis-moi quoi faire.");
    verifier(lourd.niveau === "maitre",
        `une demande à plusieurs volets chiffrée part en « ${lourd.niveau} » au lieu de Maître`);

    // ── LE CAS TROUVÉ EN MESURANT ────────────────────────────────────────
    //
    // « Résume ce rapport ET dis-moi quoi faire » commence par un geste
    // simple et finit par la vraie demande. L'exception ne doit pas écraser
    // le travail qui suit — c'était le cas avant cette mesure.
    const mixte = choisir("Résume ce rapport et dis-moi quoi faire ensuite");
    verifier(mixte.niveau !== "rapide",
        "« résume ET dis-moi quoi faire » est classé geste simple : la vraie demande est " +
        "la seconde moitié, et elle serait traitée sans aucun outil");

    // Un « merci » au milieu d'une longue demande ne la transforme pas en
    // politesse.
    const poli = choisir("Analyse mes chiffres de vente du mois et dis-moi pourquoi ça stagne, merci !");
    verifier(poli.niveau !== "rapide",
        "un « merci » en fin de phrase suffit à faire passer une analyse pour une politesse");
}

// ── 5. LE PLAFOND MORD, ET IL LE DIT ─────────────────────────────────────
{
    const gratuit = A.choisir({
        message: "Compare tout, fais-moi un prévisionnel, un plan, une stratégie, et dis-moi quoi faire",
        palier: "free",
    });
    verifier(N.comparer(gratuit.niveau, "expert") <= 0,
        `un compte gratuit atteint « ${gratuit.niveau} » : le plafond ne mord pas`);
    verifier(gratuit.borne === true,
        "le plafond a mordu sans le signaler — impossible de proposer l'abonnement au bon moment");

    const abonne = A.choisir({ message: "Bonjour", palier: "pro" });
    verifier(abonne.borne === false, "un simple bonjour est signalé comme borné");
}

// ── 6. UN CHOIX EXPLICITE EST RESPECTÉ — MAIS BORNÉ ──────────────────────
{
    const veutRapide = A.choisir({ message: "Fais-moi un plan complet chiffré", demande: "rapide", palier: "pro" });
    verifier(veutRapide.niveau === "rapide",
        "quelqu'un qui demande Rapide reçoit autre chose : on décide à sa place");
    verifier(veutRapide.auto === false, "un choix explicite est marqué automatique");

    const veutMaitre = A.choisir({ message: "Bonjour", demande: "maitre", palier: "free" });
    verifier(veutMaitre.niveau === "expert",
        `un compte gratuit qui demande Maître obtient « ${veutMaitre.niveau} » : le plafond est ` +
        "une question d'argent, il vaut aussi pour un choix explicite");
    verifier(veutMaitre.borne === true, "le plafond a mordu sur un choix explicite sans le dire");
}

// ── 7. ON REND TOUJOURS UN NIVEAU RÉEL ───────────────────────────────────
//
// Jamais « auto » : c'est une façon de choisir, pas un niveau. C'est le
// niveau retenu qu'on facturera et qu'on tracera.
{
    for (const entree of [
        { message: "" }, { message: null }, { message: undefined },
        { message: "?" }, { message: "a".repeat(5000) },
        { message: "Bonjour", demande: "auto" },
        { message: "Bonjour", demande: "niveau-invente" },
        { message: "Bonjour", palier: "palier-invente" },
        {},
    ]) {
        const r = A.choisir(entree);
        verifier(r && N.ORDRE.includes(r.niveau),
            `choisir(${JSON.stringify(entree).slice(0, 60)}) rend « ${r?.niveau} » — pas un niveau réel`);
        verifier(r.niveau !== N.AUTO, "« auto » est rendu comme un niveau alors que c'est une façon de choisir");
        verifier(Array.isArray(r.raisons), "aucune raison rendue : un choix inexplicable est un choix indéfendable");
    }
}

// ── 8. LA PIÈCE JOINTE PÈSE ──────────────────────────────────────────────
{
    const sans = choisir("Regarde ça");
    const avec = choisir("Regarde ça", { piece: { mimeType: "image/png" } });
    verifier(avec.score > sans.score,
        "une pièce jointe ne pèse pas : il y a pourtant quelque chose à examiner avant de répondre");
}

// ── 9. L'ESCALADE : UNE FOIS, ET JAMAIS DANS LE DOS DE LA PERSONNE ───────
{
    const auto = choisir("Mes ventes ont baissé");
    const aveu = "Je n'ai pas accès à tes chiffres de vente pour le moment.";

    verifier(A.doitMonter({ choix: auto, reponse: aveu }) === true,
        "SAMII avoue qu'il lui manque un accès et on ne monte pas d'un cran : la réponse reste creuse");

    verifier(A.doitMonter({ choix: auto, reponse: aveu, dejaMonte: true }) === false,
        "l'escalade peut se répéter : une facture qui peut s'emballer, et le mode de panne le " +
        "plus coûteux d'un agent est la boucle qui se rappelle elle-même");

    const explicite = A.choisir({ message: "Mes ventes ont baissé", demande: "rapide", palier: "pro" });
    verifier(A.doitMonter({ choix: explicite, reponse: aveu }) === false,
        "on monte alors que la personne avait choisi Rapide : c'est dépenser son argent sans le lui demander");

    const plafonne = A.choisir({ message: "Fais-moi un plan complet chiffré avec un prévisionnel", palier: "free" });
    verifier(A.doitMonter({ choix: plafonne, reponse: aveu }) === false,
        "l'escalade franchit le plafond d'un compte gratuit : ce serait une porte dérobée");

    const auSommet = A.choisir({ message: "Compare, analyse, calcule, planifie, dis-moi quoi faire", palier: "societe" });
    if (auSommet.niveau === "maitre") {
        verifier(A.doitMonter({ choix: auSommet, reponse: aveu }) === false,
            "on essaie de monter au-dessus de Maître");
    }

    verifier(A.doitMonter({ choix: auto, reponse: "Voici tes chiffres : 42 ventes ce mois." }) === false,
        "on monte d'un cran alors que SAMII a répondu correctement — chaque tour coûterait double");
    verifier(A.doitMonter({ choix: auto, reponse: "" }) === false, "on monte sur une réponse vide");
}

// ── 10. LE DOMAINE VIENT DU ROUTEUR EXISTANT ─────────────────────────────
//
// Un second routeur finirait par ne plus classer le même message dans le
// même domaine, et personne ne saurait lequel fait foi.
{
    const { detect } = require(path.join(RACINE, "brain", "prompts", "sovereign", "tables.js"));
    verifier(typeof detect === "function",
        "tables.js n'expose plus detect() — niveauAuto devrait alors écrire son propre routeur de domaine");
    for (const m of ["Mes ventes stagnent", "Mon code plante", "Quel budget pour la pub ?"]) {
        verifier(A.peser(m).domaine === detect(m),
            `« ${m} » n'est pas classé dans le même domaine par les deux chemins`);
    }
}

// ── VERDICT ──────────────────────────────────────────────────────────────
if (echecs.length) {
    console.log(`\n❌ niveau auto : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    echecs.forEach((e) => console.log(`   • ${e}`));
    process.exit(1);
}
console.log(`✅ niveau auto : ${verifs} vérifications passées`);
