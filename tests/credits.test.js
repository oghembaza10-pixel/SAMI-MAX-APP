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
    // ⚠️ CETTE GARDE ÉCRIVAIT « 0.01 » EN DUR, ET C'EST CE QU'ELLE GARDAIT.
    //
    // Elle vérifiait un NOMBRE, pas une propriété. Au premier changement de
    // prix — décidé, documenté, justifié — elle est devenue rouge sans rien
    // avoir protégé : elle disait seulement « le prix a changé », ce que le
    // diff disait déjà.
    //
    // Ce qu'il faut garder, c'est que le prix soit UTILISABLE : un nombre
    // fini, positif, et qui tombe sur un compte rond de crédits. La grille
    // elle-même, ses marges et ses bornes, sont vérifiées par
    // `tests/grille.test.js`, qui est fait pour ça.
    verifier(Number.isFinite(CREDITS.PRIX_MESSAGE_USD) && CREDITS.PRIX_MESSAGE_USD > 0,
        `un message coûte ${CREDITS.PRIX_MESSAGE_USD} $ — un prix nul ou illisible rendrait ` +
        "le solde infini");
    verifier(CREDITS.MINIMUM_RECHARGE_USD === 2,
        `le minimum de recharge est de ${CREDITS.MINIMUM_RECHARGE_USD} $ au lieu de 2 $`);

    // Le nombre de messages qu'un montant donne se DÉDUIT du prix, il ne se
    // recopie pas. C'est la seule formulation qui survive à un changement de
    // prix — et c'est exactement le piège dans lequel `MONTANTS` était tombé,
    // avec ses « 200 messages » écrits en dur à côté de leur source.
    verifier(CREDITS.messagesPour(2) === Math.floor(2 / CREDITS.PRIX_MESSAGE_USD),
        `2 $ donnent ${CREDITS.messagesPour(2)} messages au lieu de ` +
        `${Math.floor(2 / CREDITS.PRIX_MESSAGE_USD)}`);
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
                // Le TYPE et le COMPTE viennent de la requête, ils ne sont pas
                // devinés : dépôts et consommations ont chacun leur
                // idempotence, et une référence appartient à un compte. Une
                // doublure qui ignorerait l'un ou l'autre dirait « déjà
                // compté » à la place de la vraie base, ou l'inverse.
                const type = /type = 'depot'/.test(sql) ? "depot" : "consommation";
                const [ref, compte] = params;
                return lignes.filter((l) =>
                    l.transaction_ref === ref && l.type === type
                    && (compte === undefined || l.compte === compte)).length
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
    const MSG_POUR_2 = Math.floor(2 / CREDITS.PRIX_MESSAGE_USD);
    verifier(etat.messages === MSG_POUR_2,
        `après 2 $, ${etat.messages} messages au lieu de ${MSG_POUR_2}`);

    // ── L'ÉQUILIBRE DU REGISTRE ─────────────────────────────────────────
    // La somme signée de TOUTES les lignes doit être nulle, toujours. C'est
    // l'invariant qui rend la comptabilité vérifiable : si elle dérive, de
    // l'argent est apparu ou a disparu sans contrepartie.
    const equilibre = () => Math.round(lignes.reduce((s, l) => s + l.sens * l.montant, 0) * 100) / 100;
    verifier(equilibre() === 0, `le registre est déséquilibré de ${equilibre()} après un dépôt`);

    // On dépense un message.
    const d1 = await credits.debiterMessage(USER, { ref: "msg:1" });
    verifier(d1.ok, `le premier débit échoue : ${d1.raison}`);
    verifier(d1.messages === MSG_POUR_2 - 1,
        `après un message, ${d1.messages} restants au lieu de ${MSG_POUR_2 - 1}`);
    verifier(equilibre() === 0, "le registre est déséquilibré après une consommation");

    // La maison a bien reçu le centime — l'argent va quelque part, il ne
    // s'évapore pas.
    const maison = await portefeuille.soldeDisponible(portefeuille.MAISON, "USD");
    verifier(Math.abs(maison - CREDITS.PRIX_MESSAGE_USD) < 0.0001,
        `la maison a reçu ${maison} $ au lieu de 0,01 $ — la dépense ne va nulle part`);

    // ── LE MÊME MESSAGE REJOUÉ N'EST PAS FACTURÉ DEUX FOIS ──────────────
    const d2 = await credits.debiterMessage(USER, { ref: "msg:1" });
    verifier(d2.ok && d2.dejaCompte, "un message rejoué est facturé une seconde fois");
    etat = await credits.etat(USER);
    verifier(etat.messages === MSG_POUR_2 - 1,
        `après un rejeu, ${etat.messages} messages — le même message a été facturé deux fois`);

    // ── ON NE DÉPENSE PAS CE QU'ON N'A PAS ──────────────────────────────
    // 199 débits de plus doivent passer, le 200e doit être refusé.
    for (let i = 2; i <= MSG_POUR_2; i++) await credits.debiterMessage(USER, { ref: `msg:${i}` });
    etat = await credits.etat(USER);
    verifier(etat.messages === 0,
        `il reste ${etat.messages} messages après avoir dépensé les ${MSG_POUR_2} d'une recharge de 2 $`);

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
        const iDebit = api.indexOf("creditsSamii.debiterTour");
        // On repère l'appel au moteur par ce qu'il EST, pas par la forme
        // exacte de sa ligne : elle a déjà changé une fois (l'arrivée du
        // flux l'a transformée en ternaire), et la garde a crié pour une
        // raison qui n'était pas la bonne. L'ordre, lui, n'avait pas bougé.
        const iReponse = Math.min(
            ...["planner.build(", "planner.buildFlux("]
                .map((forme) => api.indexOf(forme))
                .filter((i) => i !== -1),
        );
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

        // ── LA PAGE NE DOIT PAS AVOIR SA PROPRE RÈGLE DE PAYS ───────────
        //
        // Deux versions se sont trompées de source avant celle-ci :
        // `req.session.pays` (jamais écrite nulle part) puis
        // `utilisateurs.pays` (jamais renseignée par le parcours
        // d'inscription). Dans les deux cas la devise retombait sur « USD »
        // pour TOUT LE MONDE et la conversion locale était du code mort.
        //
        // La réponse vit maintenant dans workspaceService, une seule fois,
        // pour toute l'application. On exige donc que la page la DEMANDE, et
        // qu'elle n'aille surtout pas rechercher un pays elle-même : deux
        // règles de pays finiraient par diverger, et c'est l'utilisateur qui
        // découvrirait laquelle s'applique.
        verifier(/workspaceService\.paysDuCompte\(/.test(route),
            "routes/recharge.js ne demande pas le pays à workspaceService.paysDuCompte : " +
            "soit elle a sa propre règle, soit elle n'en a plus du tout");
        verifier(!/SELECT pays FROM utilisateurs/.test(route),
            "routes/recharge.js relit elle-même utilisateurs.pays — la colonne que le parcours " +
            "d'inscription ne remplit jamais, et une deuxième règle de pays en prime");
        verifier(/devises\.pourPays\(/.test(route),
            "routes/recharge.js n'utilise plus devises.pourPays : le lien pays → monnaie " +
            "serait réécrit une deuxième fois");

        // Et la source de vérité, elle, doit bien regarder le QG — le seul
        // endroit où un pays est RÉELLEMENT saisi dans le parcours.
        const ws = fs.readFileSync(path.join(RACINE, "services", "workspaceService.js"), "utf8");
        const bloc = ws.slice(ws.indexOf("async function paysDuCompte"));
        const corps = bloc.slice(0, bloc.indexOf("\n}\n") + 1);
        verifier(/getById\(workspaceId\)/.test(corps) && /qgPrincipal\(email\)/.test(corps),
            "paysDuCompte ne lit plus le pays du QG : c'est pourtant le seul que le parcours " +
            "d'inscription remplit vraiment (le formulaire le demande, la route le refuse s'il manque)");
        verifier(!/\.devise\b/.test(corps),
            "paysDuCompte se fie à workspaces.devise : le formulaire de création ne la demande " +
            "pas, donc create() y écrit « DZD » pour tout le monde — elle dirait « dinar " +
            "algérien » d'un commerçant de Bamako");

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

    // ── 9. LE SOLDE PAIE LE TRAVAIL, PAS SEULEMENT LES PHRASES ───────────
    //
    // « La recharge, c'est pour les messages ET pour les confirmations de
    // commande, prise de RDV, etc. Ça ne sert pas qu'au message. »
    //
    // Trois choses peuvent casser ici, et deux coûtent de l'argent réel.
    {
        const planner = fs.readFileSync(path.join(RACINE, "brain", "planner.js"), "utf8");

        // (a) AUCUN OUTIL SANS DÉCISION DE PRIX. Le vrai risque n'est pas le
        // tarif d'aujourd'hui : c'est l'outil ajouté dans six mois, qui
        // tombera du côté gratuit par simple oubli. On relit donc la liste
        // réelle des outils et on exige que chacun soit classé.
        const outils = [...planner.matchAll(/case "([a-z_]+)":/g)].map((m) => m[1]);
        verifier(outils.length >= 10,
            `on ne lit que ${outils.length} outils dans planner.js — la liste a changé de forme, ce test ne mesure plus rien`);
        for (const outil of outils) {
            const classe = (outil in CREDITS.ACTES) || (outil in CREDITS.GRATUITS);
            verifier(classe,
                `l'outil « ${outil} » n'a pas de prix décidé : ajoute-le à ACTES ou à GRATUITS dans config/credits.js`);
        }

        // (b) NE JAMAIS FACTURER DEUX FOIS LA MÊME CONFIRMATION. Confirmer
        // une commande était DÉJÀ payant avant la recharge
        // (services/confirmationsQuota.js). Le remettre au tarif des actes
        // ferait payer deux fois, par deux systèmes qui s'ignorent — et
        // personne ne le verrait avant une réclamation.
        verifier(!("confirmer_commande" in CREDITS.ACTES),
            "confirmer_commande est facturé par le solde ALORS QU'IL L'EST DÉJÀ par " +
            "confirmationsQuota.js : la même confirmation est prélevée deux fois");
        verifier("confirmer_commande" in CREDITS.GRATUITS,
            "confirmer_commande n'est plus classé : quelqu'un doit trancher, et la réponse " +
            "est qu'il est facturé ailleurs");

        // (c) LE PRIX D'UNE CONFIRMATION NE SE RECOPIE PAS. S'il existait en
        // deux exemplaires, ils divergeraient, et le prix dépendrait du rail
        // qui encaisse.
        const credits = fs.readFileSync(path.join(RACINE, "config", "credits.js"), "utf8");
        const quota = require(path.join(RACINE, "services", "confirmationsQuota.js"));
        verifier(!new RegExp(String(quota.PRIX_DEPASSEMENT_USD).replace(".", "\\.")).test(credits)
                 || quota.PRIX_DEPASSEMENT_USD === CREDITS.PRIX_ACTE_USD,
            `le prix d'une confirmation (${quota.PRIX_DEPASSEMENT_USD} $) est recopié dans config/credits.js : ` +
            "deux copies d'un prix finissent toujours par diverger");

        // (d) LA FACTURE D'UN TOUR. Ce que ça coûte vraiment, calculé.
        const seul = CREDITS.factureDuTour([]);
        verifier(seul.montant === CREDITS.PRIX_MESSAGE_USD,
            `un tour sans acte coûte ${seul.montant} $ au lieu du prix d'un message`);

        const avecActe = CREDITS.factureDuTour([{ nom: "prendre_rendez_vous", reussi: true }]);
        verifier(avecActe.montant > seul.montant,
            "un rendez-vous pris coûte le même prix qu'un simple bonjour — " +
            "c'est pourtant la seule des deux choses pour laquelle on recharge");

        // Un acte RATÉ ne se facture pas : même règle que le message sans
        // réponse. On ne fait jamais payer une panne qui est chez nous.
        const rate = CREDITS.factureDuTour([{ nom: "prendre_rendez_vous", reussi: false }]);
        verifier(rate.montant === CREDITS.PRIX_MESSAGE_USD,
            "un rendez-vous qui a ÉCHOUÉ est quand même facturé");

        // Lire ses propres données reste compris dans le message.
        const lecture = CREDITS.factureDuTour([{ nom: "consulter_agenda", reussi: true }]);
        verifier(lecture.montant === CREDITS.PRIX_MESSAGE_USD,
            "consulter son propre agenda est facturé en supplément — " +
            "c'est un péage sur sa propre porte");

        // Un nom inconnu ne coûte rien : on n'invente pas un prix.
        const inconnu = CREDITS.factureDuTour([{ nom: "outil_qui_nexiste_pas", reussi: true }]);
        verifier(inconnu.montant === CREDITS.PRIX_MESSAGE_USD,
            "un acte inconnu se voit attribuer un prix inventé");

        // (e) LE PLANNER DOIT DIRE CE QU'IL A FAIT. Sans ça, rien de tout ce
        // qui précède n'est atteignable : routes/api.js ne sait pas
        // distinguer une commande enregistrée d'un bonjour.
        verifier(/journal\.push\(/.test(planner) && /return \{ success: true, reply, actes \}/.test(planner),
            "brain/planner.js ne rapporte plus les actes exécutés : la facturation " +
            "retombe au prix d'un message quoi que SAMII fasse");

        // Et il doit rapporter l'ÉCHEC honnêtement. Un `reussi: true` écrit
        // en dur passerait tous les tests de tarif ci-dessus — ils calculent
        // à partir de ce que le planner déclare — tout en facturant chaque
        // acte raté. La mesure porte donc sur l'origine de la valeur.
        verifier(/reussi:\s*functionResult\?\.success !== false/.test(planner),
            "brain/planner.js déclare les actes réussis sans regarder le résultat : " +
            "un rendez-vous qui a échoué serait facturé comme un rendez-vous pris");

        // Et la signature de `ask` doit rester compatible : huit appelants
        // attendent une CHAÎNE. Les casser pour facturer serait un très
        // mauvais échange.
        verifier(/async ask\(message, context = \{\}, history = \[\], journal = null\)/.test(planner),
            "la signature de planner.ask a changé de forme — vérifie que Telegram, " +
            "WhatsApp, Meta, discussions et communauté reçoivent toujours une chaîne");
    }

    // ── 10. LE CLIENT D'UN MARCHAND N'EST JAMAIS COUPÉ ───────────────────
    //
    // Sur Telegram et WhatsApp, c'est le CLIENT qui parle à SAMII. Il n'a pas
    // de compte, il ne paie rien : c'est le marchand qui reçoit la commande
    // qui règle l'acte.
    //
    // Et si ce marchand est à sec ? On ne défait rien et on ne coupe
    // personne. L'acte est déjà accompli quand la facturation arrive ; un
    // client laissé sans réponse parce que son marchand n'a plus de solde,
    // c'est une vente perdue pour lui et un service qui a l'air cassé pour
    // tout le monde. Une perte visible vaut mieux qu'un client perdu.
    {
        const svc = fs.readFileSync(path.join(RACINE, "services", "creditsSamii.js"), "utf8");
        const tg = fs.readFileSync(path.join(RACINE, "routes", "telegram.js"), "utf8");

        verifier(/async function facturerActesWorkspace/.test(svc),
            "creditsSamii ne sait plus facturer les actes d'un canal client");

        // La facturation ne doit RIEN renvoyer qui puisse interrompre le
        // canal : pas de throw, pas de propagation.
        const bloc = svc.slice(svc.indexOf("async function facturerActesWorkspace"));
        verifier(!/throw /.test(bloc.slice(0, bloc.indexOf("module.exports"))),
            "facturerActesWorkspace peut lever une erreur : une conversation client " +
            "s'arrêterait parce que le marchand n'a plus de solde");

        // Et le canal doit facturer APRÈS avoir répondu au client.
        //
        // ⚠️ ON LIT LE CODE, PAS LES COMMENTAIRES.
        //
        // `indexOf` prenait la PREMIÈRE occurrence dans le fichier brut. Le
        // jour où un commentaire d'en-tête a mentionné
        // `creditsSamii.facturerActesWorkspace` pour expliquer le débit, ce
        // garde est devenu rouge — alors que l'ordre du code n'avait pas
        // bougé d'une ligne. Il annonçait une facturation prématurée qui
        // n'existait pas.
        //
        // Un garde qui accuse à tort finit par être désactivé, et c'est là
        // qu'on perd la règle qu'il protégeait. Il mesure donc maintenant ce
        // qu'il prétend mesurer : l'ordre des appels EXÉCUTÉS.
        const tgCode = tg.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
        const iReponse = tgCode.indexOf("await reply(chatId, geminiReply, base)");
        const iFacture = tgCode.indexOf("facturerActesWorkspace");
        verifier(iReponse !== -1 && iFacture > iReponse,
            "Telegram facture AVANT de répondre au client : un incident de facturation " +
            "ferait perdre la réponse");

        // Le lien QG → propriétaire est fait à UN seul endroit.
        verifier(/JOIN utilisateurs u ON u\.email = w\.owner_email/.test(svc),
            "le lien entre un QG et le compte qui paie n'est plus fait dans creditsSamii");

        // Une confirmation SANS référence ne doit jamais être prélevée : sans
        // référence, un rejeu facturerait deux fois.
        const cq = fs.readFileSync(path.join(RACINE, "services", "confirmationsQuota.js"), "utf8");
        verifier(/if \(ref\) \{/.test(cq),
            "confirmationsQuota prélève sur le solde sans exiger de référence : " +
            "une livraison rejouée facturerait la même confirmation deux fois");
        verifier(/if \(paye\.ok\) return;/.test(cq),
            "confirmationsQuota prélève sur le solde ET inscrit l'ardoise : " +
            "la même confirmation est comptée deux fois");
    }

    // ── 11. UNE RÉFÉRENCE APPARTIENT À UN COMPTE ─────────────────────────
    //
    // SIXIÈME PANNE, TROUVÉE EN LANÇANT LA SONDE DEUX FOIS DE SUITE.
    //
    // L'idempotence de `consommer` cherchait la référence dans TOUTE la
    // table, sans regarder le compte. Un marchand paie « tg:1:42 » ; un
    // AUTRE marchand ne paie plus rien pour son propre acte, parce qu'une
    // ligne portant cette référence existe déjà quelque part. La fonction
    // répond « déjà compté » — c'est-à-dire un succès. Travail rendu,
    // jamais facturé, aucune alerte.
    //
    // Ça dormait tant que les références venaient d'un identifiant de base,
    // globalement unique. Une référence de canal client — discussion plus
    // message — ne l'est pas : deux bots de deux marchands produisent les
    // mêmes numéros. C'est le branchement de Telegram qui a réveillé le
    // piège, pas qui l'a créé.
    {
        const pf = fs.readFileSync(path.join(RACINE, "services", "portefeuille.js"), "utf8");
        const bloc = pf.slice(pf.indexOf("async function consommer"), pf.indexOf("async function soldeDisponible"));
        verifier(/transaction_ref = \$1 AND compte = \$2/.test(bloc),
            "l'idempotence de consommer() ignore le compte : la référence d'un marchand " +
            "empêche de facturer un autre marchand, en silence et en renvoyant un succès");

        const tg = fs.readFileSync(path.join(RACINE, "routes", "telegram.js"), "utf8");
        verifier(/ref: `tg:\$\{workspaceId/.test(tg),
            "la référence Telegram ne contient pas le QG : deux marchands produisent " +
            "les mêmes numéros de discussion et de message");
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
