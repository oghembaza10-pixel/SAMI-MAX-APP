// ==========================================================================
// SAMII OS — Recharger SAMII : l'argent arrive-t-il, et une seule fois ?
//
// POURQUOI CE TEST EXISTE.
//
// C'est de l'argent réel, encaissé chez des gens qui n'en ont pas beaucoup.
// Trois pannes sont possibles ici, et aucune ne ressemble à une panne :
//
//   1. LE DOUBLE CRÉDIT. Un webhook de paiement se rejoue — Chargily réessaie
//      quand notre réponse tarde, et il a raison. Sans garde, le second
//      passage recrédite la somme entière : on donne de l'argent qu'on n'a
//      pas encaissé, et rien ne le signale.
//   2. LE TAUX OFFICIEL. Au taux officiel, 2 $ font ~270 DZD ; mais pour se
//      procurer ces 2 $ qu'on doit ensuite à Google, il faut passer par le
//      marché parallèle où ils coûtent près du double. Facturer au taux
//      officiel, c'est vendre à perte à chaque recharge — et ne le découvrir
//      qu'au relevé bancaire.
//   3. LE DÉBIT AVANT LA RÉPONSE. Facturer un message avant de savoir si
//      SAMII a répondu, c'est facturer les pannes. La personne paie pour un
//      incident qui est chez nous, et elle ne recharge jamais plus.
//
// COMMENT. La comptabilité est éprouvée sur un VRAI registre en mémoire (les
// mêmes fonctions que la production, avec une base simulée qui tient
// réellement les lignes) : une doublure qui dirait « oui » à tout prouverait
// seulement que le test s'accorde avec lui-même.
//
// Lancer :  npm test
// ==========================================================================
const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const CREDITS = require(path.join(RACINE, "config", "credits.js"));
const devises = require(path.join(RACINE, "services", "devises.js"));
const CONFIG = require(path.join(RACINE, "config.js"));

// ── 1. L'ÉCONOMIE ANNONCÉE EST CELLE QUI S'APPLIQUE ──────────────────────
{
    verifier(CREDITS.PRIX_MESSAGE_USD === 0.01,
        `un message coûte ${CREDITS.PRIX_MESSAGE_USD} $ au lieu de 0,01 $`);
    verifier(CREDITS.MINIMUM_RECHARGE_USD === 2,
        `le minimum de recharge est de ${CREDITS.MINIMUM_RECHARGE_USD} $ au lieu de 2 $`);

    // 2 $ doivent faire exactement 200 messages. Si ce calcul dérive, le prix
    // affiché et le prix facturé ne disent plus la même chose.
    verifier(CREDITS.messagesPour(2) === 200,
        `2 $ donnent ${CREDITS.messagesPour(2)} messages au lieu de 200`);
    verifier(CREDITS.messagesPour(0.005) === 0,
        "un montant inférieur au prix d'un message donne quand même un message");

    // Chaque montant proposé annonce le bon nombre de messages : un écart ici
    // est une promesse qu'on ne tiendra pas, écrite sur le bouton lui-même.
    for (const m of CREDITS.MONTANTS) {
        verifier(CREDITS.messagesPour(m.usd) === m.messages,
            `le bouton « ${m.usd} $ » annonce ${m.messages} messages mais en donne ${CREDITS.messagesPour(m.usd)}`);
        verifier(m.usd >= CREDITS.MINIMUM_RECHARGE_USD,
            `le bouton « ${m.usd} $ » est sous le minimum annoncé`);
    }
}

// ── 2. LES REFUS SONT EXPLICITES ─────────────────────────────────────────
// Un refus muet sur un paiement laisse la personne recliquer sans comprendre.
{
    for (const [valeur, quoi] of [[1, "sous le minimum"], [0, "zéro"], ["abc", "illisible"],
                                  [null, "vide"], [100000, "aberrant"]]) {
        const r = CREDITS.verifierMontant(valeur);
        verifier(!r.ok, `« ${valeur} » est accepté alors qu'il est ${quoi}`);
        verifier(typeof r.raison === "string" && r.raison.length > 3,
            `« ${valeur} » est refusé sans raison lisible`);
    }
    verifier(CREDITS.verifierMontant(2).ok, "le minimum lui-même est refusé");
    verifier(CREDITS.verifierMontant(20).ok, "20 $ est refusé");
}

// ── 3. LE DINAR SE COMPTE AU MARCHÉ PARALLÈLE ────────────────────────────
//
// LA VÉRIFICATION QUI PROTÈGE LA MARGE. Le taux officiel tourne autour de
// 135 DZD/$ ; le parallèle autour du double. Si quelqu'un « corrige » un jour
// le taux vers l'officiel en croyant bien faire, chaque recharge se vendrait
// à perte — et ça ne se verrait qu'au relevé.
{
    const taux = CONFIG.DEVISES.USD_TO_DZD;
    verifier(taux >= 180,
        `le taux USD→DZD est de ${taux} : c'est le taux officiel, pas le marché parallèle. ` +
        "Chaque recharge serait vendue à perte, puisque les dollars qu'on doit ensuite à " +
        "Google s'achètent au parallèle.");

    const deuxDollars = devises.convertir(2, "USD", "DZD");
    verifier(deuxDollars.ok, `2 $ ne se convertissent pas en dinars : ${deuxDollars.raison}`);
    verifier(deuxDollars.montant > 350,
        `2 $ valent ${Math.round(deuxDollars.montant)} DZD — trop peu pour être un taux parallèle`);

    // Les autres monnaies du marché doivent toutes répondre : un taux
    // manquant ferait échouer la recharge d'un pays entier, en silence.
    for (const d of ["DZD", "MAD", "TND", "XOF", "XAF", "EUR"]) {
        const c = devises.convertir(5, "USD", d);
        verifier(c.ok && c.montant > 0, `5 $ ne se convertissent pas en ${d} : ${c.raison || "montant nul"}`);
    }

    // Et une devise inconnue est REFUSÉE, jamais rendue telle quelle : un
    // montant inchangé facturerait des dollars à la place des dinars.
    const inconnue = devises.convertir(5, "USD", "XYZ");
    verifier(!inconnue.ok, "une devise inconnue renvoie un montant au lieu d'un refus");
}

// ── 4. LE REGISTRE : CRÉDITER, DÉPENSER, ET JAMAIS DEUX FOIS ─────────────
//
// On monte un vrai registre en mémoire : les mêmes fonctions que la
// production, une base simulée qui TIENT réellement les lignes. Une doublure
// qui répondrait « oui » à tout prouverait seulement que le test s'accorde
// avec lui-même.
(async () => {
    const lignes = [];
    const faussebase = {
        query: async (sql, params = []) => {
            if (/INSERT INTO portefeuille_mouvements/i.test(sql)) {
                lignes.push({
                    operation: params[0], compte: params[1], poche: params[2],
                    // La colonne s'appelle `montant` et contient des UNITÉS,
                    // pas des centimes : `centimes()` arrondit à deux
                    // décimales sans changer d'unité, malgré son nom.
                    sens: params[3], montant: params[4], devise: params[5],
                    type: params[6], transaction_ref: params[7],
                });
                return [];
            }
            if (/SUM\(sens \* montant\)/i.test(sql)) {
                const [compte, poche, devise] = params;
                const total = lignes
                    .filter((l) => l.compte === compte && l.poche === poche && l.devise === devise)
                    .reduce((s, l) => s + l.sens * l.montant, 0);
                return [{ solde: total, total: total }];
            }
            if (/SELECT 1 FROM portefeuille_mouvements/i.test(sql)) {
                const ref = params[0];
                return lignes.filter((l) => l.transaction_ref === ref && l.type === "consommation").length
                    ? [{ "?column?": 1 }] : [];
            }
            return [];
        },
        transaction: async (fn) => fn(faussebase.query),
    };

    const Module = require("module");
    const vrai = Module.prototype.require;
    Module.prototype.require = function (nom) {
        if (nom === "./db") return faussebase;
        return vrai.apply(this, arguments);
    };
    delete require.cache[require.resolve(path.join(RACINE, "services", "portefeuille.js"))];
    delete require.cache[require.resolve(path.join(RACINE, "services", "creditsSamii.js"))];
    const portefeuille = require(path.join(RACINE, "services", "portefeuille.js"));
    const credits = require(path.join(RACINE, "services", "creditsSamii.js"));
    Module.prototype.require = vrai;

    const USER = "u-essai";

    // Rien au départ.
    let etat = await credits.etat(USER);
    verifier(etat.messages === 0, `un compte neuf a déjà ${etat.messages} messages`);
    verifier(!(await credits.peutPayer(USER)), "un compte vide peut payer un message");

    // On crédite 2 $.
    await credits.crediter(USER, 2, { detail: "test" });
    etat = await credits.etat(USER);
    verifier(etat.messages === 200, `après 2 $, ${etat.messages} messages au lieu de 200`);

    // ── L'ÉQUILIBRE DU REGISTRE ─────────────────────────────────────────
    // La somme signée de TOUTES les lignes doit être nulle, toujours. C'est
    // l'invariant qui rend la comptabilité vérifiable : si elle dérive, de
    // l'argent est apparu ou a disparu sans contrepartie.
    const equilibre = () => Math.round(lignes.reduce((s, l) => s + l.sens * l.montant, 0) * 100) / 100;
    verifier(equilibre() === 0, `le registre est déséquilibré de ${equilibre()} après un dépôt`);

    // On dépense un message.
    const d1 = await credits.debiterMessage(USER, { ref: "msg:1" });
    verifier(d1.ok, `le premier débit échoue : ${d1.raison}`);
    verifier(d1.messages === 199, `après un message, ${d1.messages} restants au lieu de 199`);
    verifier(equilibre() === 0, "le registre est déséquilibré après une consommation");

    // La maison a bien reçu le centime — l'argent va quelque part, il ne
    // s'évapore pas.
    const maison = await portefeuille.soldeDisponible(portefeuille.MAISON, "USD");
    verifier(Math.abs(maison - 0.01) < 0.0001,
        `la maison a reçu ${maison} $ au lieu de 0,01 $ — la dépense ne va nulle part`);

    // ── LE MÊME MESSAGE REJOUÉ N'EST PAS FACTURÉ DEUX FOIS ──────────────
    const d2 = await credits.debiterMessage(USER, { ref: "msg:1" });
    verifier(d2.ok && d2.dejaCompte, "un message rejoué est facturé une seconde fois");
    etat = await credits.etat(USER);
    verifier(etat.messages === 199,
        `après un rejeu, ${etat.messages} messages — le même message a été facturé deux fois`);

    // ── ON NE DÉPENSE PAS CE QU'ON N'A PAS ──────────────────────────────
    // 199 débits de plus doivent passer, le 200e doit être refusé.
    for (let i = 2; i <= 200; i++) await credits.debiterMessage(USER, { ref: `msg:${i}` });
    etat = await credits.etat(USER);
    verifier(etat.messages === 0, `il reste ${etat.messages} messages après en avoir dépensé 200`);

    const trop = await credits.debiterMessage(USER, { ref: "msg:201" });
    verifier(!trop.ok, "on a pu envoyer un message sans solde — le compte passe en négatif");
    verifier(/solde/i.test(trop.raison || ""),
        `le refus dit « ${trop.raison} » au lieu de nommer le solde épuisé — la page ne saura pas proposer de recharger`);
    verifier(equilibre() === 0, "le registre est déséquilibré après un refus");

    // ── 5. LE CODE QUI ENCAISSE ─────────────────────────────────────────
    {
        const orders = fs.readFileSync(path.join(RACINE, "services", "orders.js"), "utf8");
        verifier(/statut = 'payee'[\s\S]{0,120}WHERE checkout_id = \$1 AND statut = 'en_attente'/.test(orders),
            "la confirmation de recharge ne se protège pas du rejeu : le webhook repassera et recréditera");
        verifier(/checkout\.status !== "paid"/.test(orders.slice(orders.indexOf("confirmChargilyRecharge"))),
            "le statut du paiement n'est pas relu chez Chargily avant de créditer");

        const route = fs.readFileSync(path.join(RACINE, "routes", "recharge.js"), "utf8");
        verifier(!/crediter\(/.test(route),
            "la route de recharge crédite elle-même : un retour de navigateur suffirait à se créditer");
        verifier(/converti\.ok/.test(route),
            "la route n'exige pas que la conversion ait réussi — un taux manquant encaisserait un montant inventé");

        // Le débit a lieu APRÈS la réponse, jamais avant.
        const api = fs.readFileSync(path.join(RACINE, "routes", "api.js"), "utf8");
        const iDebit = api.indexOf("debiterMessage");
        const iReponse = api.indexOf("const result = await planner.build");
        verifier(iDebit > iReponse && iReponse !== -1,
            "le message est débité AVANT d'avoir une réponse — une panne de l'IA serait facturée");
        verifier(/if \(surCredits && result\.reply\)/.test(api),
            "le débit ne vérifie pas qu'une réponse a bien été produite");
    }

    // ── 7. UN CONFIRMATEUR QUI TOMBE NE DOIT PAS FAIRE TAIRE LA RECHARGE ──
    //
    // LA QUATRIÈME PANNE, TROUVÉE EN FAISANT TOMBER LE CODE À LA MAIN.
    //
    // Le webhook appelle quatre confirmateurs à la suite : commande, carte,
    // abonnement, recharge. Ils étaient enchaînés par de simples `await` dans
    // un seul try. Une erreur dans le PREMIER sautait au catch — les trois
    // suivants n'étaient jamais appelés — et ce catch répondait 200.
    //
    // 200 veut dire « c'est traité ». Chargily ne réessaie donc pas. Une
    // recharge encaissée pendant que `confirmChargilyPayment` butait sur un
    // réseau lent (il appelle Chargily : c'est un appel réseau, ça tombe pour
    // de vrai) disparaissait en silence : argent pris, solde jamais crédité.
    //
    // On exige donc les deux moitiés du remède : chacun dans son propre
    // filet, et une réponse en ERREUR si l'un tombe — la seule façon de
    // demander un rejeu. Le rejeu est sans danger : les quatre ne prennent
    // que si le statut n'est pas déjà final.
    {
        const hook = fs.readFileSync(path.join(RACINE, "routes", "webhook-chargily.js"), "utf8");

        // Les quatre sont-ils tous appelés, et chacun protégé ? On mesure le
        // remède par ce qu'il produit — une boucle avec un try à l'intérieur —
        // plutôt que par sa forme exacte, pour ne pas casser au premier
        // remaniement honnête.
        const corps = hook.slice(hook.indexOf("confirmChargilyPayment,"));
        for (const nom of ["confirmChargilyPayment", "confirmChargilyCartePurchase",
            "confirmChargilyAbonnement", "confirmChargilyRecharge"]) {
            verifier(corps.includes(nom),
                `le webhook Chargily n'appelle plus ${nom} — un type de paiement n'est plus confirmé`);
        }

        // La garde qui compte : un échec doit produire une réponse NON-2xx.
        // Sans elle, Chargily reçoit « c'est bon » sur un paiement non traité.
        const echoue = /tombes\.length/.test(hook) && /sendStatus\(5\d\d\)/.test(hook);
        verifier(echoue,
            "le webhook Chargily répond 200 même quand un confirmateur tombe : " +
            "Chargily ne réessaiera jamais, et un paiement encaissé reste non crédité");

        // Et chacun doit être isolé : un seul try autour des quatre, c'est la
        // panne d'origine. On vérifie qu'un try se trouve entre le premier
        // appel et le dernier.
        const iBoucle = hook.indexOf("for (const [nom, confirmer]");
        const iTry = hook.indexOf("try {", iBoucle);
        verifier(iBoucle !== -1 && iTry > iBoucle,
            "les confirmateurs Chargily ne sont pas isolés les uns des autres : " +
            "le premier qui tombe empêche les suivants d'être appelés");
    }

    // ── 8. LA MONNAIE AFFICHÉE EST CELLE DE LA PERSONNE ──────────────────
    //
    // CINQUIÈME PANNE, TROUVÉE EN OUVRANT LA PAGE POUR DE VRAI.
    //
    // La page lisait `req.session.pays`. Cette clé n'est écrite NULLE PART
    // dans le code — ni au login, ni à l'inscription. Elle valait donc
    // toujours undefined, la devise retombait sur « USD » pour tout le monde,
    // et la conversion en monnaie locale était du code mort. Un marchand
    // malien voyait « 478 DZD ≈ 2 USD » : des dinars ALGÉRIENS, et pas un
    // franc CFA.
    //
    // C'est le même accident que celui facturé à Bourama Traoré, à Ségou —
    // 200 dinars algériens pour un Malien. Deux fois la même cause : un pays
    // supposé au lieu d'un pays lu.
    {
        const route = fs.readFileSync(path.join(RACINE, "routes", "recharge.js"), "utf8");

        // On ne doit PAS faire dépendre la devise d'une clé de session que
        // personne ne remplit. Si quelqu'un se met un jour à écrire
        // `req.session.pays` au login, ce test le verra et pourra être
        // assoupli — en le prouvant, pas en le supposant.
        const ecrite = ["login", "register"].some((f) => {
            try {
                return /req\.session\.pays\s*=/.test(
                    fs.readFileSync(path.join(RACINE, "routes", `${f}.js`), "utf8"));
            } catch { return false; }
        });
        const litLaBase = /FROM utilisateurs[\s\S]{0,80}pays|SELECT pays/.test(route);
        verifier(ecrite || litLaBase,
            "routes/recharge.js déduit la devise de req.session.pays, que personne n'écrit : " +
            "tout le monde voit « USD » et la conversion en monnaie locale est du code mort");

        // Et le prix principal reste celui qui sera RÉELLEMENT encaissé : la
        // monnaie locale n'est qu'un repère, jamais le montant du bouton.
        const vue = fs.readFileSync(path.join(RACINE, "views", "recharge.ejs"), "utf8");
        const iPaiement = vue.indexOf("m.paiement.montant");
        const iLocal = vue.indexOf("m.local.montant");
        verifier(iPaiement !== -1 && iPaiement < iLocal,
            "la vue met la monnaie locale avant le montant réellement encaissé : " +
            "la personne croirait payer un chiffre qui n'est pas celui du prélèvement");

        // Un repère identique au prix ne se répète pas : « 478 DZD ≈ 478 DZD »
        // ferait douter du chiffre au moment où il faut y croire.
        verifier(/m\.local\.devise !==/.test(vue),
            "la vue répète la monnaie locale même quand c'est la monnaie de paiement");
    }

    if (echecs.length) {
        console.log(`\n❌ crédits : ${echecs.length} échec(s) sur ${verifs} vérifications\n`);
        echecs.forEach((e) => console.log(`   • ${e}`));
        process.exit(1);
    }
    console.log(`✅ crédits : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ crédits : la comptabilité n'a pas pu être jouée —", err.message);
    console.error(err.stack);
    process.exit(1);
});
