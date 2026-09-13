// ==========================================================================
// SAMII OS — Le webhook Chargily répond-il la vérité ?
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE.
//
// La réponse HTTP d'un webhook n'est pas cosmétique : c'est un ordre donné à
// Chargily. 200 veut dire « c'est traité, n'y reviens pas ». 500 veut dire
// « rejoue ». Se tromper de code, c'est décider du sort d'un paiement.
//
// LA PANNE MESURÉE SUR L'APPLICATION QUI TOURNE. `services/chargily.js`
// avalait TOUTE erreur et renvoyait `null`. Ce `null` voulait donc dire deux
// choses incompatibles : « ce paiement n'est pas confirmé » et « je n'ai pas
// pu joindre Chargily ». Le webhook, ne pouvant pas les distinguer, répondait
// 200 dans les deux cas. Quatre appels réseau en échec observés en vrai
// (« request blocked … pay.chargily.net ») → HTTP 200 → aucun rejeu jamais.
// Un paiement réellement encaissé pendant une panne réseau restait à jamais
// non crédité, sans erreur, sans trace, sans rattrapage possible.
//
// CE QU'ON VÉRIFIE ICI, EN PILOTANT LE VRAI ROUTEUR EN HTTP :
//
//   A. La distinction elle-même : 404 est une réponse, tout le reste est une
//      panne.
//   B. Paiement non confirmé            → 200, aucun crédit.
//   C. Panne réseau                     → 500.
//   D. Délai dépassé                    → 500.
//   E. Paiement confirmé                → 200, ET le solde est crédité.
//   F. Signature invalide               → 403, sans rien appeler.
//   G. Rejeu d'un paiement déjà crédité → 200, et PAS de second crédit.
//   H. Crédit en échec                  → 500, et la ligne redevient
//      rejouable au lieu d'être perdue.
//
// On monte le VRAI routeur avec le VRAI orders.js sur un registre en mémoire.
// Seul Chargily est remplacé — c'est un tiers, on ne peut pas le faire tomber
// à la demande. Tout le reste est le code de production.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const CLE = "cle-essai-webhook";
process.env.CHARGILY_API_KEY = CLE;

// ── LA DOUBLURE DE CHARGILY ──────────────────────────────────────────────
// Elle ne fait qu'une chose : jouer le scénario qu'on lui demande. Le reste
// du chemin — orders.js, creditsSamii, portefeuille — est le vrai code.
let scenario = { genre: "introuvable" };
const chargilyDouble = {
    isEnabled: () => true,
    verifySignature: (payload, signature) => {
        const attendu = crypto.createHmac("sha256", CLE).update(payload).digest("hex");
        return attendu === signature;
    },
    getCheckout: async () => {
        if (scenario.genre === "introuvable") return null;              // 404 chez Chargily
        if (scenario.genre === "reseau") {
            const e = new Error("connect ECONNREFUSED 1.2.3.4:443");
            e.code = "ECONNREFUSED";
            e.technique = true;
            throw e;
        }
        if (scenario.genre === "timeout") {
            const e = new Error("timeout of 15000ms exceeded");
            e.code = "ECONNABORTED";
            e.technique = true;
            throw e;
        }
        if (scenario.genre === "impaye") return { id: scenario.id, status: "pending", metadata: scenario.metadata };
        if (scenario.genre === "paye") return { id: scenario.id, status: "paid", metadata: scenario.metadata };
        throw new Error("scénario inconnu : " + scenario.genre);
    },
};

// ── LE REGISTRE ET LES RECHARGES, EN MÉMOIRE MAIS FIDÈLES ────────────────
const lignes = [];
const recharges = new Map();     // checkoutId → { user_id, montant_usd, statut }
let creditPlante = false;        // pour le scénario H
let journalPlante = false;       // pour le scénario I

const faussebase = {
    query: async (sql, params = []) => {
        if (/INSERT INTO portefeuille_mouvements/i.test(sql)) {
            if (creditPlante) throw new Error("écriture du registre impossible (simulée)");
            lignes.push({
                operation: params[0], compte: params[1], poche: params[2],
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
            return [{ solde: total, total }];
        }
        if (/SELECT 1 FROM portefeuille_mouvements/i.test(sql)) {
            const type = /type = 'depot'/.test(sql) ? "depot" : "consommation";
            const [ref, compte] = params;
            return lignes.filter((l) =>
                l.transaction_ref === ref && l.type === type
                && (compte === undefined || l.compte === compte)).length
                ? [{ "?column?": 1 }] : [];
        }
        // La prise de la recharge : ne rend une ligne QUE si elle est encore
        // en attente. C'est exactement ce que fait la vraie requête, et c'est
        // ce qui interdit le double crédit.
        if (/UPDATE recharges_samii SET statut = 'payee'/i.test(sql)) {
            const r = recharges.get(params[0]);
            if (!r || r.statut !== "en_attente") return [];
            r.statut = "payee";
            return [{ user_id: r.user_id, montant_usd: r.montant_usd }];
        }
        // La remise en attente après un crédit raté.
        if (/UPDATE recharges_samii SET statut = 'en_attente'/i.test(sql)) {
            const r = recharges.get(params[0]);
            if (r && r.statut === "payee") r.statut = "en_attente";
            return [];
        }
        return [];
    },
    transaction: async (fn) => fn(faussebase.query),
};

// ── ON MONTE LE VRAI CHEMIN ──────────────────────────────────────────────
const Module = require("module");
const vrai = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "./db" || nom === "../services/db") return faussebase;
    if (nom === "./chargily" || nom === "../services/chargily") return chargilyDouble;
    // Les effets de bord qui ne regardent pas cette suite (sockets, envois,
    // journal) : on les neutralise pour que rien ne parte vraiment.
    if (nom === "./socketService") return { emitToShop: () => {} };
    if (nom === "./notify") return { notifyWorkspace: () => {} };
    if (nom === "./journalService") return { log: async () => { if (journalPlante) throw new Error("journal injoignable (simulé)"); } };
    return vrai.apply(this, arguments);
};
for (const m of ["services/portefeuille.js", "services/creditsSamii.js", "services/orders.js",
    "routes/webhook-chargily.js"]) {
    delete require.cache[require.resolve(path.join(RACINE, m))];
}
const creditsSamii = require(path.join(RACINE, "services", "creditsSamii.js"));
const routeurWebhook = require(path.join(RACINE, "routes", "webhook-chargily.js"));
const chargilyReel = vrai.call(module, path.join(RACINE, "services", "chargily.js"));
Module.prototype.require = vrai;

const express = require("express");
const app = express();
app.use("/webhook/chargily", express.raw({ type: "*/*" }), routeurWebhook);

// Envoie un vrai webhook signé et rend le code HTTP.
function appeler(corpsObjet, { signatureValide = true } = {}) {
    const corps = JSON.stringify(corpsObjet);
    const signature = signatureValide
        ? crypto.createHmac("sha256", CLE).update(Buffer.from(corps)).digest("hex")
        : "00" + "f".repeat(62);
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: "127.0.0.1", port: serveur.address().port, path: "/webhook/chargily",
            method: "POST",
            headers: { "Content-Type": "application/json", signature, "Content-Length": Buffer.byteLength(corps) },
        }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
        req.on("error", reject);
        req.end(corps);
    });
}

const USER = "u-webhook";
const soldeDe = async () => (await creditsSamii.etat(USER)).soldeUSD;

let serveur;
(async () => {
    serveur = app.listen(0);
    await new Promise((r) => serveur.once("listening", r));

    // ── A. LA DISTINCTION, À LA SOURCE ───────────────────────────────────
    //
    // C'est de cette fonction que tout dépend. 404 est une réponse de
    // Chargily (« ce paiement n'existe pas ») : rejouer donnerait
    // éternellement le même 404. Tout le reste veut dire qu'on n'a pas su.
    {
        const panne = (o) => chargilyReel.estPanne(o);
        verifier(panne({ response: { status: 404 } }) === false,
            "un 404 de Chargily est traité comme une panne : le webhook demanderait un rejeu " +
            "éternel pour un paiement qui n'existe pas");
        for (const [cas, err] of [
            ["500 de Chargily", { response: { status: 500 } }],
            ["502 de Chargily", { response: { status: 502 } }],
            ["429 (trop d'appels)", { response: { status: 429 } }],
            ["401 (clé refusée)", { response: { status: 401 } }],
            ["403 (clé révoquée)", { response: { status: 403 } }],
            ["aucune réponse (réseau coupé)", { code: "ECONNREFUSED", message: "connect ECONNREFUSED" }],
            ["délai dépassé", { code: "ECONNABORTED", message: "timeout of 15000ms exceeded" }],
            ["DNS introuvable", { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND" }],
            ["connexion coupée", { code: "ECONNRESET", message: "socket hang up" }],
        ]) {
            verifier(panne(err) === true,
                `« ${cas} » n'est pas reconnu comme une panne : le webhook répondrait 200 ` +
                "et Chargily ne rejouerait jamais un paiement peut-être encaissé");
        }
    }

    // ── A bis. LA VRAIE `getCheckout`, AVEC UN VRAI AXIOS QUI TOMBE ──────
    //
    // Les cas B à H pilotent le webhook à travers une DOUBLURE de Chargily.
    // Ils prouvent que le webhook réagit bien à une panne — mais ils ne
    // verraient RIEN si quelqu'un remettait `getCheckout` à « return null »,
    // puisque la doublure, elle, continuerait de lever. C'est précisément la
    // régression d'origine.
    //
    // On charge donc la VRAIE fonction, avec un axios qui échoue, et on exige
    // qu'elle LÈVE au lieu de rendre `null`.
    {
        const axiosDouble = { get: async () => { const e = new Error("socket hang up"); e.code = "ECONNRESET"; throw e; },
                              post: async () => ({ data: {} }) };
        Module.prototype.require = function (nom) {
            if (nom === "axios") return axiosDouble;
            return vrai.apply(this, arguments);
        };
        delete require.cache[require.resolve(path.join(RACINE, "services", "chargily.js"))];
        const chargilyAvecPanne = require(path.join(RACINE, "services", "chargily.js"));
        Module.prototype.require = vrai;

        let aLeve = false, rendu = "rien";
        try {
            rendu = await chargilyAvecPanne.getCheckout("ck-peu-importe");
        } catch { aLeve = true; }
        verifier(aLeve,
            `getCheckout a rendu « ${JSON.stringify(rendu)} » au lieu de lever sur une panne réseau : ` +
            "le webhook ne peut plus distinguer « pas confirmé » de « je n'ai pas pu savoir », " +
            "et répondra 200 sur un paiement peut-être encaissé");

        // Un 404, lui, reste une réponse : il rend null sans lever.
        const axios404 = { get: async () => { const e = new Error("Request failed with status code 404");
                                              e.response = { status: 404, data: {} }; throw e; },
                           post: async () => ({ data: {} }) };
        Module.prototype.require = function (nom) {
            if (nom === "axios") return axios404;
            return vrai.apply(this, arguments);
        };
        delete require.cache[require.resolve(path.join(RACINE, "services", "chargily.js"))];
        const chargily404 = require(path.join(RACINE, "services", "chargily.js"));
        Module.prototype.require = vrai;

        let leve404 = false, rendu404 = "rien";
        try {
            rendu404 = await chargily404.getCheckout("ck-inexistant");
        } catch { leve404 = true; }
        verifier(!leve404 && rendu404 === null,
            "un 404 de Chargily lève au lieu de rendre null : le webhook demanderait un rejeu " +
            "éternel pour un paiement qui n'existe pas");
    }

    // ── F. SIGNATURE INVALIDE → 403, ET RIEN N'EST APPELÉ ────────────────
    {
        scenario = { genre: "paye", id: "ck-faux", metadata: { type: "recharge_samii" } };
        recharges.set("ck-faux", { user_id: USER, montant_usd: 5, statut: "en_attente" });
        const code = await appeler({ id: "ck-faux" }, { signatureValide: false });
        verifier(code === 403, `signature invalide → HTTP ${code} au lieu de 403`);
        verifier(recharges.get("ck-faux").statut === "en_attente",
            "une signature invalide a quand même fait avancer la recharge");
        verifier(await soldeDe() === 0,
            "une signature invalide a crédité un solde : n'importe qui pourrait se créditer");
        recharges.delete("ck-faux");
    }

    // ── F bis. UN CORPS SIGNÉ MAIS ILLISIBLE → 500, PAS 200 ──────────────
    //
    // Le filet le plus extérieur du webhook répondait 200. Or tout ce qui
    // l'atteint est imprévu : chaque issue métier est déjà traitée plus haut
    // par un retour explicite. Une signature valide sur un corps qu'on
    // n'arrive pas à lire veut dire « on ne sait pas ce qui s'est passé » —
    // et répondre « c'est bon » à Chargily dans ce cas est exactement la
    // panne qu'on vient de corriger un étage plus bas.
    {
        const corps = "ceci n'est pas du JSON";
        const signature = crypto.createHmac("sha256", CLE).update(Buffer.from(corps)).digest("hex");
        const code = await new Promise((resolve, reject) => {
            const req = http.request({
                host: "127.0.0.1", port: serveur.address().port, path: "/webhook/chargily",
                method: "POST",
                headers: { "Content-Type": "application/json", signature, "Content-Length": Buffer.byteLength(corps) },
            }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
            req.on("error", reject);
            req.end(corps);
        });
        verifier(code === 500,
            `corps signé mais illisible → HTTP ${code} au lieu de 500 : une erreur imprévue ` +
            "se ferait passer pour un traitement réussi");
    }

    // ── B. PAIEMENT NON CONFIRMÉ → 200, AUCUN CRÉDIT ─────────────────────
    //
    // Deux formes du même état métier : le checkout n'existe pas (404), et le
    // checkout existe mais n'est pas payé. Aucune des deux n'est une panne.
    {
        scenario = { genre: "introuvable" };
        let code = await appeler({ id: "ck-inconnu" });
        verifier(code === 200, `paiement introuvable (404 chez Chargily) → HTTP ${code} au lieu de 200`);
        verifier(await soldeDe() === 0, "un paiement introuvable a crédité un solde");

        recharges.set("ck-impaye", { user_id: USER, montant_usd: 5, statut: "en_attente" });
        scenario = { genre: "impaye", id: "ck-impaye", metadata: { type: "recharge_samii" } };
        code = await appeler({ id: "ck-impaye" });
        verifier(code === 200, `paiement pas encore payé → HTTP ${code} au lieu de 200`);
        verifier(await soldeDe() === 0, "un paiement NON payé a crédité un solde");
        verifier(recharges.get("ck-impaye").statut === "en_attente",
            "un paiement non payé a été marqué payé");
    }

    // ── C. PANNE RÉSEAU → 500 ────────────────────────────────────────────
    //
    // LA VÉRIFICATION QUI JUSTIFIE TOUTE LA SUITE. Avant, ce cas rendait 200.
    {
        recharges.set("ck-reseau", { user_id: USER, montant_usd: 5, statut: "en_attente" });
        scenario = { genre: "reseau" };
        const code = await appeler({ id: "ck-reseau" });
        verifier(code === 500,
            `Chargily injoignable → HTTP ${code} au lieu de 500 : Chargily ne rejouera pas, ` +
            "et un paiement peut-être encaissé ne sera jamais crédité");
        verifier(await soldeDe() === 0, "une panne réseau a crédité un solde");
        verifier(recharges.get("ck-reseau").statut === "en_attente",
            "une panne réseau a fait avancer la recharge");
    }

    // ── D. DÉLAI DÉPASSÉ → 500 ───────────────────────────────────────────
    {
        scenario = { genre: "timeout" };
        const code = await appeler({ id: "ck-reseau" });
        verifier(code === 500, `délai dépassé → HTTP ${code} au lieu de 500`);
        verifier(await soldeDe() === 0, "un délai dépassé a crédité un solde");
    }

    // ── E. PAIEMENT CONFIRMÉ → 200 AVEC CRÉDIT ───────────────────────────
    {
        recharges.set("ck-ok", { user_id: USER, montant_usd: 5, statut: "en_attente" });
        scenario = { genre: "paye", id: "ck-ok", metadata: { type: "recharge_samii" } };
        const code = await appeler({ id: "ck-ok" });
        verifier(code === 200, `paiement confirmé → HTTP ${code} au lieu de 200`);
        const solde = await soldeDe();
        verifier(Math.abs(solde - 5) < 0.0001,
            `paiement confirmé : solde à ${solde} $ au lieu de 5 $ — le crédit n'a pas eu lieu`);
        verifier(recharges.get("ck-ok").statut === "payee",
            "la recharge n'est pas marquée payée après un crédit réussi");

        // Le registre reste équilibré : rien n'est apparu de nulle part.
        const somme = lignes.reduce((s, l) => s + l.sens * l.montant, 0);
        verifier(Math.abs(somme) < 0.0001, `le grand livre est déséquilibré : ${somme}`);
    }

    // ── G. LE REJEU NE CRÉDITE PAS DEUX FOIS ─────────────────────────────
    //
    // Chargily rejoue quand notre réponse tarde, et il a raison. Deux rejeux
    // de suite, pour ne pas conclure sur un seul essai.
    {
        const avant = await soldeDe();
        scenario = { genre: "paye", id: "ck-ok", metadata: { type: "recharge_samii" } };
        const c1 = await appeler({ id: "ck-ok" });
        const c2 = await appeler({ id: "ck-ok" });
        const apres = await soldeDe();
        verifier(c1 === 200 && c2 === 200, `rejeu d'un paiement déjà traité → HTTP ${c1}/${c2} au lieu de 200`);
        verifier(Math.abs(apres - avant) < 0.0001,
            `un rejeu a recrédité : ${avant} $ → ${apres} $. On donne de l'argent qu'on n'a pas encaissé`);
    }

    // ── H. CRÉDIT EN ÉCHEC → 500, ET LA LIGNE REDEVIENT REJOUABLE ────────
    //
    // Le paiement est confirmé, mais l'écriture du registre tombe. Avant, on
    // répondait 200 et la ligne restait « payee » : le rejeu ne retrouvait
    // plus rien à prendre, donc il ne réparait jamais rien. Argent encaissé,
    // solde vide, et seule une intervention manuelle pouvait le voir.
    {
        recharges.set("ck-casse", { user_id: USER, montant_usd: 10, statut: "en_attente" });
        scenario = { genre: "paye", id: "ck-casse", metadata: { type: "recharge_samii" } };
        const avant = await soldeDe();

        creditPlante = true;
        const code = await appeler({ id: "ck-casse" });
        creditPlante = false;

        verifier(code === 500,
            `crédit en échec → HTTP ${code} au lieu de 500 : Chargily ne rejouerait pas`);
        verifier(Math.abs((await soldeDe()) - avant) < 0.0001,
            "un crédit en échec a quand même bougé le solde");
        verifier(recharges.get("ck-casse").statut === "en_attente",
            "après un crédit raté la ligne reste « payee » : le rejeu ne pourra plus rien réparer, " +
            "l'argent est encaissé et le solde restera vide");

        // Et le rejeu répare vraiment.
        const code2 = await appeler({ id: "ck-casse" });
        const apres = await soldeDe();
        verifier(code2 === 200, `le rejeu réparateur → HTTP ${code2} au lieu de 200`);
        verifier(Math.abs((apres - avant) - 10) < 0.0001,
            `le rejeu n'a pas réparé le crédit : ${avant} $ → ${apres} $ (attendu +10 $)`);

        // Et il ne crédite toujours pas deux fois.
        await appeler({ id: "ck-casse" });
        verifier(Math.abs((await soldeDe()) - apres) < 0.0001,
            "après réparation, un rejeu supplémentaire recrédite");
    }

    // ── I. LE CRÉDIT A ABOUTI, MAIS L'ÉTAPE D'APRÈS TOMBE ────────────────
    //
    // LE CAS EXACT POUR LEQUEL LE DÉPÔT PORTE UNE RÉFÉRENCE.
    //
    // En H, l'écriture du registre échouait : rien n'était crédité, donc
    // rendre la ligne au rejeu était évidemment sans risque. Ici c'est
    // l'inverse : le crédit PASSE, puis le journal tombe. On rend quand même
    // la ligne au rejeu — et si le dépôt n'était pas idempotent, le rejeu
    // créditerait une SECONDE fois. On donnerait de l'argent qu'on n'a jamais
    // encaissé, et le grand livre le dirait sans que personne ne le lise.
    {
        recharges.set("ck-journal", { user_id: USER, montant_usd: 7, statut: "en_attente" });
        scenario = { genre: "paye", id: "ck-journal", metadata: { type: "recharge_samii" } };
        const avant = await soldeDe();

        journalPlante = true;
        const code = await appeler({ id: "ck-journal" });
        journalPlante = false;

        const apresIncident = await soldeDe();
        verifier(code === 500, `crédit abouti mais journal en panne → HTTP ${code} au lieu de 500`);
        verifier(Math.abs((apresIncident - avant) - 7) < 0.0001,
            `le crédit n'a pas eu lieu avant l'incident : ${avant} $ → ${apresIncident} $`);

        // Le rejeu : il retrouve la ligne rendue, recrédite… et la référence
        // doit l'en empêcher.
        const code2 = await appeler({ id: "ck-journal" });
        const apresRejeu = await soldeDe();
        verifier(code2 === 200, `le rejeu après incident → HTTP ${code2} au lieu de 200`);
        verifier(Math.abs(apresRejeu - apresIncident) < 0.0001,
            `LE REJEU A CRÉDITÉ UNE SECONDE FOIS : ${apresIncident} $ → ${apresRejeu} $. ` +
            "Le dépôt n'est plus idempotent — on donne de l'argent qu'on n'a pas encaissé");

        const somme = lignes.reduce((s, l) => s + l.sens * l.montant, 0);
        verifier(Math.abs(somme) < 0.0001, `le grand livre est déséquilibré : ${somme}`);
    }

    serveur.close();

    if (echecs.length) {
        console.log(`\n❌ webhook Chargily : ${echecs.length} échec(s) sur ${verifs} vérifications\n`);
        echecs.forEach((e) => console.log(`   • ${e}`));
        process.exit(1);
    }
    console.log(`✅ webhook Chargily : ${verifs} vérifications passées`);
    process.exit(0);
})().catch((err) => {
    if (serveur) serveur.close();
    console.error("❌ webhook Chargily : la suite n'a pas pu être jouée —", err.message);
    console.error(err.stack);
    process.exit(1);
});
