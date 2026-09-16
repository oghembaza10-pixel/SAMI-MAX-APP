// ==========================================================================
// SAMII OS — LE QUOTA GRATUIT : 20 MESSAGES / 5 HEURES
// ==========================================================================
//
// ── CE QUI EST DÉFENDU ────────────────────────────────────────────────────
//
// La règle commerciale annoncée est 20 messages gratuits par fenêtre de
// 5 heures. Le code appliquait 30 / 7 h — +50 % de messages sur une fenêtre
// 40 % plus longue. L'écart était connu, documenté dans config/economie.js et
// dans tests/economie.test.js, et laissé tel quel parce que le quota est une
// décision produit qu'aucun chantier n'avait le droit de prendre.
//
// ── CE QUI NE DOIT SURTOUT PAS BOUGER ─────────────────────────────────────
//
// La fenêtre servait AUX TROIS PALIERS : gratuit, standard (50 messages) et
// pro (150). Faire passer une seule constante de 7 à 5 aurait rafraîchi les
// quotas payants 40 % plus souvent — un cadeau non demandé à des clients
// payants, et trois lignes de la page de tarifs qui deviennent fausses d'un
// coup.
//
// La fenêtre du gratuit et celle des paliers payants sont donc DEUX nombres
// distincts. Ce fichier vérifie les deux, parce que c'est précisément le
// genre de couplage qu'on ne voit qu'une fois qu'il a coûté quelque chose.
// ==========================================================================
const path = require("path");
const fs = require("fs");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const QUOTA = require(path.join(RACINE, "services", "samiiQuota.js"));

// ── 1. LES DEUX NOMBRES DE LA RÈGLE COMMERCIALE ──────────────────────────
verifier(QUOTA.QUOTA_GRATUIT_PAR_FENETRE === 20,
    `le quota gratuit applique ${QUOTA.QUOTA_GRATUIT_PAR_FENETRE} messages au lieu de 20 — ` +
    "la règle commerciale annoncée et le code ne disent pas la même chose");
verifier(QUOTA.FENETRE_HEURES === 5,
    `la fenêtre gratuite est de ${QUOTA.FENETRE_HEURES} h au lieu de 5 — ` +
    "un quota qui se renouvelle plus lentement qu'annoncé se voit, et se raconte");

// ── 2. LE PALIER « free » SUIT LE MÊME NOMBRE ────────────────────────────
//
// QUOTA_PAR_PALIER.free et QUOTA_GRATUIT_PAR_FENETRE décrivent la même chose.
// Deux nombres écrits séparément finissent par diverger, et c'est toujours
// celui qu'on ne relit pas qui devient faux.
verifier(QUOTA.QUOTA_PAR_PALIER.free === QUOTA.QUOTA_GRATUIT_PAR_FENETRE,
    `QUOTA_PAR_PALIER.free vaut ${QUOTA.QUOTA_PAR_PALIER.free} alors que le quota gratuit est ` +
    `${QUOTA.QUOTA_GRATUIT_PAR_FENETRE} — deux chiffres pour une seule règle`);

// ── 3. LES PALIERS PAYANTS N'ONT PAS BOUGÉ ───────────────────────────────
verifier(QUOTA.QUOTA_PAR_PALIER.standard === 50,
    `le palier standard donne ${QUOTA.QUOTA_PAR_PALIER.standard} messages au lieu de 50 — ` +
    "ce chantier ne touche qu'au gratuit");
verifier(QUOTA.QUOTA_PAR_PALIER.pro === 150,
    `le palier pro donne ${QUOTA.QUOTA_PAR_PALIER.pro} messages au lieu de 150`);
verifier(QUOTA.FENETRE_PAYANTE_HEURES === 7,
    `la fenêtre des paliers payants est de ${QUOTA.FENETRE_PAYANTE_HEURES} h au lieu de 7 — ` +
    "raccourcir la fenêtre d'un client payant lui offre des messages qu'il n'a pas achetés, " +
    "et rend fausses les lignes « toutes les 7h » de la page de tarifs");

// ── 4. LE 20e PASSE, LE 21e EST BLOQUÉ ───────────────────────────────────
//
// On ne lit pas les constantes ici : on fait tourner getEtatQuota pour de
// vrai, avec une base doublée qui rend le nombre de messages qu'on veut.
// Une constante juste dans un calcul faux ne bloquerait personne.
(async () => {
    const chemin = require.resolve(path.join(RACINE, "services", "db.js"));
    const vraiDb = require(chemin);
    const original = vraiDb.query;
    let derniereRequete = "";

    // La doublure : `utilisateurs` dit « gratuit », `workspaces` n'existe pas
    // (donc pas de palier payant), et le comptage rend ce qu'on lui souffle.
    let messagesDejaEnvoyes = 0;
    vraiDb.query = async (sql) => {
        derniereRequete = sql;
        if (/FROM utilisateurs/.test(sql)) return [{ abonnement: "gratuit" }];
        if (/FROM workspaces/.test(sql)) return [];
        if (/count\(\*\)/.test(sql)) return [{ n: messagesDejaEnvoyes }];
        return [];
    };

    for (const [envoyes, doitPouvoir] of [[0, true], [19, true], [20, false], [21, false], [99, false]]) {
        messagesDejaEnvoyes = envoyes;
        const etat = await QUOTA.getEtatQuota("u-test", null);
        const peut = etat.illimite || etat.restant > 0;
        verifier(peut === doitPouvoir,
            `avec ${envoyes} message(s) déjà envoyés, le compte gratuit ${peut ? "PEUT" : "ne peut PAS"} ` +
            `écrire alors qu'il ${doitPouvoir ? "le devrait" : "ne le devrait pas"} ` +
            `(restant=${etat.restant}, total=${etat.total})`);
    }

    // Le total annoncé à l'interface, et la fenêtre qu'elle affiche.
    messagesDejaEnvoyes = 0;
    const neuf = await QUOTA.getEtatQuota("u-test", null);
    verifier(neuf.total === 20 && neuf.restant === 20,
        `un compte gratuit neuf voit total=${neuf.total}, restant=${neuf.restant} au lieu de 20/20`);
    verifier(neuf.fenetreHeures === 5,
        `l'état rendu annonce une fenêtre de ${neuf.fenetreHeures} h — c'est ce nombre que ` +
        "l'interface affiche au visiteur");
    verifier(neuf.depassementFacturable === false,
        "un compte gratuit est annoncé comme pouvant dépasser en payant : il doit être bloqué net");

    // ── 5. LA FENÊTRE DE 5 H ARRIVE VRAIMENT DANS LE SQL ─────────────────
    //
    // La constante pourrait être juste et le comptage interroger une autre
    // durée. C'est la requête qui décide, pas la déclaration.
    verifier(/interval '5 hours'/.test(derniereRequete),
        `le comptage interroge « ${(derniereRequete.match(/interval '[^']*'/) || ["(aucun interval)"])[0]} » ` +
        "au lieu de 5 heures — le quota se renouvellerait à un autre rythme que celui annoncé");

    // Et un palier payant doit toujours compter sur SA fenêtre.
    vraiDb.query = async (sql) => {
        derniereRequete = sql;
        if (/FROM utilisateurs/.test(sql)) return [{ abonnement: "gratuit" }];
        if (/SELECT id FROM workspaces/.test(sql)) return [{ id: "ws-1" }];
        if (/count\(\*\)/.test(sql)) return [{ n: 0 }];
        return [];
    };
    const abo = require(path.join(RACINE, "services", "abonnementService.js"));
    const vraiPalier = abo.getPalier;
    abo.getPalier = async () => "standard";
    const payant = await QUOTA.getEtatQuota("u-test", "ws-1");
    abo.getPalier = vraiPalier;
    vraiDb.query = original;

    verifier(payant.total === 50,
        `un palier standard reçoit ${payant.total} messages au lieu de 50`);
    verifier(payant.fenetreHeures === 7,
        `un palier standard annonce une fenêtre de ${payant.fenetreHeures} h au lieu de 7 — ` +
        "sa fenêtre ne doit pas suivre celle du gratuit");
    verifier(/interval '7 hours'/.test(derniereRequete),
        `le comptage d'un palier payant interroge « ${(derniereRequete.match(/interval '[^']*'/) || ["(aucun)"])[0]} » ` +
        "au lieu de 7 heures");

    // ── 6. LA TABLE ÉCONOMIQUE DIT CE QUE LE CODE FAIT ───────────────────
    const ECO = require(path.join(RACINE, "config", "economie.js"));
    verifier(ECO.GRATUIT.messagesCode === 20 && ECO.GRATUIT.heuresCode === 5,
        `config/economie.js déclare ${ECO.GRATUIT.messagesCode} messages / ${ECO.GRATUIT.heuresCode} h ` +
        "alors que le code applique 20 / 5 — une simulation bâtie dessus serait fausse");
    verifier(ECO.GRATUIT.aligne === true,
        "config/economie.js dit encore que le code diverge de la règle commerciale");

    // ── 7. LA PAGE DE TARIFS NE MENT PAS ─────────────────────────────────
    //
    // Le quota y est écrit en toutes lettres, dans quatre langues. Changer le
    // code sans changer la page, c'est annoncer 30 messages et en donner 20 :
    // pire que la divergence qu'on vient de corriger, parce que celle-là est
    // visible par le client au moment où il paie.
    const billing = fs.readFileSync(path.join(RACINE, "routes/billing.js"), "utf8");
    verifier(!/30 messages SAMII|30 SAMII messages/.test(billing),
        "la page de tarifs annonce encore 30 messages pour le gratuit alors que le code en donne 20");
    verifier(!/20 messages SAMII toutes les 7h|20 SAMII messages every 7h/.test(billing),
        "la page de tarifs annonce 20 messages toutes les 7h — le nombre a été corrigé, pas la fenêtre");
    const lignesGratuit = (billing.match(/2[0]\s*(messages SAMII|SAMII messages)[^<']*/g) || []);
    verifier(lignesGratuit.length >= 3,
        `${lignesGratuit.length} libellé(s) de quota gratuit trouvé(s) dans la page de tarifs — ` +
        "il y en a un par langue, et ils doivent tous dire la même chose");

    // Les paliers payants gardent leur fenêtre : leurs libellés aussi.
    verifier(/50 messages SAMII toutes les 7h|50 SAMII messages every 7h/.test(billing),
        "le libellé du palier standard a changé de fenêtre — ce chantier ne touche qu'au gratuit");
    verifier(/150 messages SAMII toutes les 7h|150 SAMII messages every 7h/.test(billing),
        "le libellé du palier pro a changé de fenêtre — ce chantier ne touche qu'au gratuit");
})().then(() => {
    if (echecs.length) {
        console.log(`\n❌ quota gratuit : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.log(`   • ${e}`);
        console.log("");
        process.exit(1);
    }
    console.log(`✅ quota gratuit : ${verifs} vérifications passées`);
}).catch((err) => {
    console.log(`\n❌ quota gratuit : la suite n'a pas pu s'exécuter — ${err.message}\n`);
    process.exit(1);
});
