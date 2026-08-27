// ==========================================================================
// SAMII OS — Le partage d'une vente est-il juste, et la liste honnête ?
//
// POURQUOI CE TEST EXISTE. Sur une vente faite chez une partenaire, trois
// personnes se partagent une somme. Une erreur d'arrondi ne se voit pas à
// l'écran : elle se voit six mois plus tard, dans un désaccord avec une
// créatrice qui a 8,5 millions de vues par mois. Un centime qui manque dans
// un grand livre, c'est un grand livre auquel plus personne ne se fie.
//
// CE QUI EST VÉRIFIÉ ICI.
//   1. Les trois parts font EXACTEMENT le total, à tous les montants.
//   2. Le partage suit ce qui a été convenu : 40 % de la commission pour
//      elle, 60 % pour la maison.
//   3. La communauté maison ne verse rien à personne.
//   4. Aucun moyen de paiement n'est proposé s'il échouerait — clés
//      absentes, adaptateur non écrit, ou pays non couvert.
//   5. Le piège XOF/XAF : deux monnaies au même nom courant, jamais
//      confondues.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const Module = require("module");
const vraiRequire = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "./db" || nom === "../services/db") return { query: async () => [] };
    return vraiRequire.apply(this, arguments);
};
const paiements = require(path.join(RACINE, "services", "paiements.js"));
const fournisseurs = require(path.join(RACINE, "config", "paiements.js"));
const communautes = require(path.join(RACINE, "config", "communautes.js"));
Module.prototype.require = vraiRequire;

// ── 1. Les trois parts font le total, à tous les montants ────────────────
// Y compris ceux qui tombent mal : 333, 1 001, 99,99. C'est exactement là
// que deux pourcentages arrondis chacun de leur côté laissent un centime
// orphelin.
//
// Les quatre derniers ne sont pas là par hasard : ce sont des montants dont
// la commission tombe pile sur un demi-centime. C'est le SEUL endroit où
// « total moins commission » et « total fois (1 − taux) » divergent — partout
// ailleurs les deux formules donnent le même résultat et la faute passe
// inaperçue. Sans ces valeurs, ce test disait vrai sans rien prouver.
const MONTANTS = [100, 333, 999, 1000, 1001, 4999, 5000, 15000, 99.99, 0.03, 123456.78,
                  1234.55, 55.55, 7.55, 0.15];

for (const slug of Object.keys(communautes.COMMUNAUTES)) {
    for (const m of MONTANTS) {
        const p = paiements.partager(m, slug);
        const somme = paiements.sous(p.vendeur + p.partenaire + p.maison);
        verifier(somme === paiements.sous(m),
            `${slug} — ${m} : les parts font ${somme} au lieu de ${m} (vendeur ${p.vendeur} + partenaire ${p.partenaire} + maison ${p.maison})`);
        verifier(p.vendeur >= 0 && p.partenaire >= 0 && p.maison >= 0,
            `${slug} — ${m} : une part est négative (${JSON.stringify(p)})`);

        // La part du vendeur DOIT être obtenue par soustraction, jamais par
        // un second pourcentage. Aux taux ronds les deux donnent le même
        // résultat, et c'est précisément le piège : la divergence n'apparaît
        // qu'à un taux qui tombe mal (7,5 %, un tiers…), c'est-à-dire le jour
        // où le taux se renégocie — pas le jour où le code s'écrit.
        verifier(p.vendeur === paiements.sous(p.total - p.commission),
            `${slug} — ${m} : la part du vendeur (${p.vendeur}) n'est pas total moins commission (${paiements.sous(p.total - p.commission)}) — calculée par pourcentage, elle laissera un centime orphelin dès que le taux tombera mal`);
        verifier(p.maison === paiements.sous(p.commission - p.partenaire),
            `${slug} — ${m} : la part de la maison n'est pas la commission moins celle de la partenaire`);
    }
}

// ── 2. Ce qui a été convenu avec elle ────────────────────────────────────
const COM = communautes.get("coindudigital");
verifier(!!COM.commission, "la communauté partenaire n'a plus de règle de commission");
if (COM.commission) {
    verifier(COM.commission.partPartenaire === 0.40,
        `la part de la partenaire est ${COM.commission.partPartenaire} au lieu de 0,40 — 40 % pour elle, c'est ce qui a été dit`);

    // Sur 10 000 : la maison prend sa commission, elle en touche 40 %.
    const p = paiements.partager(10000, "coindudigital");
    const commissionAttendue = paiements.sous(10000 * COM.commission.taux);
    verifier(p.commission === commissionAttendue,
        `commission de ${p.commission} au lieu de ${commissionAttendue}`);
    verifier(p.partenaire === paiements.sous(commissionAttendue * 0.40),
        `la partenaire touche ${p.partenaire} au lieu de ${paiements.sous(commissionAttendue * 0.40)}`);
    verifier(p.maison > p.partenaire,
        "la maison devrait toucher plus que la partenaire (60/40)");
    verifier(p.vendeur === paiements.sous(10000 - commissionAttendue),
        `le vendeur touche ${p.vendeur} au lieu de ${paiements.sous(10000 - commissionAttendue)}`);
}

// ── 3. Chez nous, personne ne prélève ────────────────────────────────────
const maison = paiements.partager(10000, communautes.DEFAUT);
verifier(maison.partenaire === 0,
    `la communauté maison verse ${maison.partenaire} à une partenaire qui n'existe pas`);
verifier(maison.vendeur === 10000,
    `chez nous le vendeur devrait toucher la totalité, il touche ${maison.vendeur}`);

// ── 4. Aucun moyen proposé s'il devait échouer ───────────────────────────
// Un moyen affiché puis en échec, c'est la vente perdue au dernier écran —
// celui où l'acheteur avait déjà décidé d'acheter.
for (const pays of ["CM", "DZ", "FR", "BJ", ""]) {
    for (const f of fournisseurs.pour({ pays })) {
        verifier(f.pret,
            `${f.nom} est proposé en ${pays || "«pays inconnu»"} alors que son adaptateur n'est pas écrit`);
        verifier(fournisseurs.configure(f),
            `${f.nom} est proposé en ${pays || "«pays inconnu»"} alors qu'il lui manque des clés`);
        verifier(fournisseurs.couvre(f, pays),
            `${f.nom} est proposé en ${pays || "«pays inconnu»"} alors qu'il ne couvre pas ce pays`);
    }
}

const sebpay = fournisseurs.get("sebpay");
verifier(!!sebpay, "le Mobile Money a disparu du registre");

// ── 5. Les deux francs CFA ───────────────────────────────────────────────
// XOF (Bénin) et XAF (Cameroun) portent le même nom courant, valent la même
// chose face à l'euro, et ne sont pas la même monnaie. Les confondre marche
// à l'affichage et casse au versement.
verifier(sebpay.devises.includes("XOF") && sebpay.devises.includes("XAF"),
    "le Mobile Money doit déclarer XOF et XAF séparément — jamais « CFA » tout court");
verifier(sebpay.pays.includes("CM"),
    "le Cameroun n'est pas dans la couverture du Mobile Money — c'est le pays de la partenaire");
verifier(!fournisseurs.get("chargily").devises.includes("XOF"),
    "Chargily ne fait que du dinar algérien, il ne doit pas déclarer de franc CFA");

// ── 6. Le registre ne peut pas mentir sur le code ────────────────────────
// `pret` est une donnée, l'adaptateur est du code : rien n'empêche les deux
// de se contredire. Passer `pret: true` sans écrire l'adaptateur est une
// ligne à changer — et ça proposerait un moyen de paiement qui refuse.
// On confronte donc les deux, au lieu de croire la donnée sur parole.
(async () => {
    // Un adaptateur qui n'est pas écrit se reconnaît à ceci : appelé sans
    // rien, il refuse en expliquant qu'il lui manque la documentation.
    async function refuseFauteDeDoc(id) {
        const adaptateur = paiements.ADAPTATEURS[id];
        if (!adaptateur) return true;
        try {
            await adaptateur({});
            return false;
        } catch (err) {
            return /documentation/i.test(err.message);
        }
    }

    for (const f of Object.values(fournisseurs.FOURNISSEURS)) {
        verifier(typeof paiements.ADAPTATEURS[f.id] === "function",
            `${f.nom} est dans le registre mais n'a aucun adaptateur dans services/paiements.js`);

        const pasEcrit = await refuseFauteDeDoc(f.id);
        if (f.pret) {
            verifier(!pasEcrit,
                `${f.nom} est déclaré prêt dans le registre alors que son adaptateur refuse faute de documentation — il serait proposé à un acheteur et échouerait`);
        } else {
            verifier(pasEcrit,
                `${f.nom} est déclaré non prêt, mais son adaptateur n'explique pas ce qui manque — le jour où il échouera, personne ne saura pourquoi`);
        }
    }

    if (echecs.length) {
        console.error(`❌ paiements : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ paiements : ${verifs} vérifications passées`);
})();
