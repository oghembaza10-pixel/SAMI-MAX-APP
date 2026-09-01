// ==========================================================================
// SAMII OS — Le numéro WhatsApp unique : à qui on parle, et si on a le droit
//
// POURQUOI CE TEST EXISTE. « Maintenant qu'on a Meta API, on n'a pas besoin
// de Green API. Je veux que tout le monde utilise cette API de Meta. »
//
// Un seul numéro pour toute la plateforme casse deux choses que Green API
// réglait sans qu'on y pense, parce que là-bas le téléphone du marchand
// répondait tout seul aux deux questions :
//
//   1. À QUI PARLE-T-ON ? Le message arrive nu.
//   2. A-T-ON LE DROIT DE PARLER ? WhatsApp n'autorise le texte libre que
//      dans les 24 h suivant le dernier message DU CLIENT.
//
// CE QUE COÛTE UNE ERREUR, ET POURQUOI ELLE NE SE VOIT PAS.
//
// Se tromper sur la première : le message d'un client d'Inès part chez un
// autre marchand. Personne ne le sait — les deux croient à un silence.
//
// Se tromper sur la seconde est pire, et c'est le piège de cette API : un
// texte libre envoyé hors fenêtre est ACCEPTÉ par Meta, qui répond 200, puis
// jeté par WhatsApp. L'appel réussit, le message n'arrive jamais, et rien
// dans nos journaux ne le dit. C'est la panne qu'on ne trouve qu'en
// demandant au client s'il a bien reçu.
//
// D'où le choix tenu ici : en cas de doute, la fenêtre est FERMÉE. On
// enverra un modèle payant à quelqu'un qu'on aurait pu joindre gratuitement
// — ça se voit sur la facture, et ça se corrige. L'inverse ne se voit pas.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

process.env.META_WHATSAPP_TOKEN = "jeton-systeme-permanent-XXXXXXXX";
process.env.META_WHATSAPP_PHONE_NUMBER_ID = "111222333444555";
process.env.META_WHATSAPP_NUMERO = "237600000000";

// Ce que la base contient, et ce qui est parti sur le réseau.
let CARNET = {};
const ENVOIS = [];

const Module = require("module");
const vraiRequire = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "./db" || nom === "../services/db") return {
        query: async (q, p = []) => {
            if (/SELECT \* FROM whatsapp_contacts/i.test(q)) {
                const c = CARNET[p[0]];
                return c ? [c] : [];
            }
            if (/INSERT INTO whatsapp_contacts/i.test(q) && /nom_client/.test(q)) {
                const [numero, code, nom] = p;
                const avant = CARNET[numero] || {};
                // LE FAUX POSTGRES OBÉIT À LA REQUÊTE, IL NE LA DEVINE PAS.
                //
                // Une première version appliquait le COALESCE de son côté, en
                // dur. Elle rendait donc le bon résultat même après qu'on ait
                // retiré le COALESCE du vrai SQL — le test disait oui à un
                // code qui, en production, aurait effacé la boutique du client
                // dès son deuxième message. On lit ce que la requête demande.
                const gardeSiVide = (colonne) =>
                    new RegExp(`${colonne}\\s*=\\s*COALESCE`, "i").test(q);
                CARNET[numero] = {
                    ...avant,
                    numero,
                    workspace_id: gardeSiVide("workspace_id")
                        ? (code || avant.workspace_id || null)
                        : (code ?? null),
                    nom_client: gardeSiVide("nom_client")
                        ? (nom || avant.nom_client || null)
                        : (nom || null),
                    dernier_entrant: new Date(),
                };
                return [CARNET[numero]];
            }
            if (/INSERT INTO whatsapp_contacts/i.test(q)) {
                const numero = p[0];
                CARNET[numero] = { ...(CARNET[numero] || {}), numero, dernier_sortant: new Date() };
                return [];
            }
            return [];
        },
    };
    if (nom === "axios") return {
        post: async (url, corps) => { ENVOIS.push({ url, corps }); return { data: {} }; },
        get: async () => ({ data: {} }),
    };
    return vraiRequire.apply(this, arguments);
};
delete require.cache[require.resolve(path.join(RACINE, "config.js"))];
delete require.cache[require.resolve(path.join(RACINE, "services", "whatsappFournisseurs.js"))];
delete require.cache[require.resolve(path.join(RACINE, "services", "whatsappSamii.js"))];
const samii = require(path.join(RACINE, "services", "whatsappSamii.js"));
Module.prototype.require = vraiRequire;

const CLIENT = "237655443322";

(async () => {
    // ══════════════════════════════════════════════════════════════════════
    // 1. LE LIEN PRÉ-REMPLI PORTE LE CODE DE LA BOUTIQUE
    //
    // C'est toute la mécanique de routage : sans code dans le premier
    // message, SAMII reçoit un message nu et ne peut que redemander.
    // ══════════════════════════════════════════════════════════════════════
    const lien = samii.lienContact("WS-ABC-123", "Le Coin Du Digital");
    verifier(lien.startsWith("https://wa.me/237600000000?text="),
        `le lien n'ouvre pas WhatsApp sur le numéro officiel : ${lien}`);
    const texteDuLien = decodeURIComponent(lien.split("text=")[1] || "");
    verifier(/\[WS-ABC-123\]/.test(texteDuLien),
        `le message pré-rempli ne porte pas le code de la boutique : « ${texteDuLien} »`);
    verifier(samii.codeDe(texteDuLien) === "WS-ABC-123",
        "le code écrit dans le lien n'est pas relu par celui qui reçoit — l'aller et le retour ne parlent pas la même langue");

    // Les crochets ne sont pas décoratifs : beaucoup de gens ajoutent un mot
    // avant d'envoyer. Sans délimiteur, il faudrait deviner où le code
    // commence dans une phrase libre.
    verifier(samii.codeDe("slt jai une question sur vos prix [ws-abc-123] merci") === "WS-ABC-123",
        "un code entouré de texte tapé par le client n'est plus reconnu — presque personne n'envoie le message tel quel");
    verifier(samii.codeDe("bonjour je veux acheter") === null,
        "un message sans code renvoie quand même une boutique — on router­ait au hasard");

    // ══════════════════════════════════════════════════════════════════════
    // 2. LE CARNET SE SOUVIENT DE LA BOUTIQUE
    //
    // Le code n'est que dans le PREMIER message. Sans mémoire, SAMII
    // redemanderait à chaque phrase.
    // ══════════════════════════════════════════════════════════════════════
    CARNET = {};
    const premier = await samii.noterEntrant({
        numero: "+237 655 44 33 22",
        texte: "Bonjour, je viens de Le Coin Du Digital [WS-ABC-123]",
        nom: "Marlyse",
    });
    verifier(premier?.workspace_id === "WS-ABC-123",
        "le premier message ne rattache pas le client à sa boutique");
    verifier(Boolean(CARNET[CLIENT]),
        "le numéro n'est pas rangé sous sa forme normalisée : le même client créera une ligne par format d'écriture et perdra sa fenêtre à chaque fois");

    const suivant = await samii.noterEntrant({ numero: CLIENT, texte: "et vous livrez à Yaoundé ?" });
    verifier(suivant?.workspace_id === "WS-ABC-123",
        "le deuxième message SANS code fait perdre la boutique — SAMII redemandera à chaque phrase");
    verifier(suivant?.nom_client === "Marlyse",
        "le nom du client est écrasé par un message qui n'en portait pas");

    // ══════════════════════════════════════════════════════════════════════
    // 3. LA FENÊTRE DES 24 HEURES
    // ══════════════════════════════════════════════════════════════════════
    verifier(await samii.fenetreOuverte(CLIENT) === true,
        "le client vient d'écrire et la fenêtre est déclarée fermée — SAMII enverra un modèle payant pour répondre à une question");

    CARNET[CLIENT].dernier_entrant = new Date(Date.now() - 25 * 3600 * 1000);
    verifier(await samii.fenetreOuverte(CLIENT) === false,
        "un client silencieux depuis 25 h est cru joignable en texte libre — le message sera jeté par WhatsApp sans erreur");

    verifier(await samii.fenetreOuverte("237000000000") === false,
        "un numéro jamais vu est déclaré joignable en texte libre — c'est le cas le plus fréquent, et le message n'arrive jamais");

    // ══════════════════════════════════════════════════════════════════════
    // 4. LE CHOIX TEXTE / MODÈLE SE FAIT TOUT SEUL
    //
    // C'est la règle qui ne doit exister qu'à un endroit. Laissée à
    // l'appelant, elle serait juste aux trente premiers et oubliée au
    // trente et unième.
    // ══════════════════════════════════════════════════════════════════════

    // Fenêtre ouverte → texte libre, gratuit.
    CARNET[CLIENT].dernier_entrant = new Date();
    ENVOIS.length = 0;
    const r1 = await samii.ecrire({ to: CLIENT, texte: "Oui, on livre à Yaoundé sous 48 h." });
    verifier(r1.success && r1.voie === "texte",
        `fenêtre ouverte : SAMII n'a pas répondu en texte libre (voie=${r1.voie})`);
    verifier(ENVOIS[0]?.corps?.type === "text",
        "fenêtre ouverte et pourtant un modèle est envoyé — on paie pour une réponse qui était gratuite");

    // Fenêtre fermée → modèle approuvé.
    CARNET[CLIENT].dernier_entrant = new Date(Date.now() - 25 * 3600 * 1000);
    ENVOIS.length = 0;
    const r2 = await samii.ecrire({
        to: CLIENT,
        texte: "Ta commande est confirmée.",
        modele: { nom: "commande_confirmee", variables: ["Marlyse", "CMD-42"] },
    });
    verifier(r2.success && r2.voie === "modele",
        `fenêtre fermée : SAMII n'est pas passé par un modèle (voie=${r2.voie})`);
    const envoi = ENVOIS[0]?.corps;
    verifier(envoi?.type === "template" && envoi?.template?.name === "commande_confirmee",
        "le modèle n'est pas appelé par son nom — Meta ne peut pas savoir quel texte approuvé envoyer");
    verifier(envoi?.template?.language?.code === "fr",
        "le modèle part en anglais par défaut : les clients de Douala reçoivent un message qu'ils ne comprennent pas");
    const params = envoi?.template?.components?.find((c) => c.type === "body")?.parameters || [];
    verifier(params.length === 2 && params[0].text === "Marlyse",
        "les variables du modèle ne sont pas transmises dans l'ordre — Meta refuse l'envoi entier");

    // Fenêtre fermée SANS modèle → on refuse, on n'essaie pas.
    ENVOIS.length = 0;
    const r3 = await samii.ecrire({ to: CLIENT, texte: "Petit rappel amical." });
    verifier(r3.success === false,
        "hors fenêtre et sans modèle, l'envoi est déclaré réussi : Meta répond 200, WhatsApp jette le message, et personne ne l'apprend");
    verifier(!ENVOIS.length,
        "un texte libre est quand même parti hors fenêtre — il ne sera jamais lu");
    verifier(/fen[êe]tre/i.test(r3.error || ""),
        `l'erreur ne dit pas que c'est la fenêtre des 24 h qui bloque : « ${r3.error} »`);

    // ══════════════════════════════════════════════════════════════════════
    // 5. AUCUN NUMÉRO D'EXPÉDITEUR ÉCRIT EN DUR
    //
    // La config portait « || "1304094159450033" ». Une valeur de repli sur
    // un identifiant d'expéditeur, c'est SAMII qui écrit depuis un numéro
    // que personne n'a choisi le jour où la variable manque — et l'envoi
    // RÉUSSIT, donc rien ne le signale.
    // ══════════════════════════════════════════════════════════════════════
    {
        const avant = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
        delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
        delete require.cache[require.resolve(path.join(RACINE, "config.js"))];
        delete require.cache[require.resolve(path.join(RACINE, "services", "whatsappSamii.js"))];
        const nu = require(path.join(RACINE, "services", "whatsappSamii.js"));
        verifier(nu.estConfigure() === false,
            "sans META_WHATSAPP_PHONE_NUMBER_ID, le canal se déclare quand même configuré — SAMII écrira depuis un numéro écrit dans le code");
        const r = await nu.ecrire({ to: CLIENT, texte: "test" });
        verifier(r.success === false && /configur/i.test(r.error || ""),
            "sans numéro, l'envoi ne dit pas clairement que le canal n'est pas configuré");

        process.env.META_WHATSAPP_PHONE_NUMBER_ID = avant;
        delete require.cache[require.resolve(path.join(RACINE, "config.js"))];
        delete require.cache[require.resolve(path.join(RACINE, "services", "whatsappSamii.js"))];
    }

    // ══════════════════════════════════════════════════════════════════════
    // 6. UN MARCHAND RESTÉ SUR GREEN API REÇOIT QUAND MÊME
    //
    // « On va laisser le choix aux gens. » Green API ne connaît pas les
    // modèles — il n'a pas de fenêtre non plus, c'est un vrai téléphone. Le
    // même appel doit donc y envoyer le texte en clair, sinon un marchand
    // qui n'a pas migré cesse de recevoir quoi que ce soit, en silence.
    // ══════════════════════════════════════════════════════════════════════
    {
        delete require.cache[require.resolve(path.join(RACINE, "services", "whatsappFournisseurs.js"))];
        Module.prototype.require = function (nom) {
            if (nom === "axios") return {
                post: async (url, corps) => { ENVOIS.push({ url, corps }); return { data: {} }; },
                get: async () => ({ data: {} }),
            };
            return vraiRequire.apply(this, arguments);
        };
        const f = require(path.join(RACINE, "services", "whatsappFournisseurs.js"));
        Module.prototype.require = vraiRequire;

        ENVOIS.length = 0;
        const r = await f.envoyerModele(
            { fournisseur: "green", apiId: "1101", apiToken: "tok" },
            { to: CLIENT, nom: "commande_confirmee", replide: "Ta commande est confirmée." },
        );
        verifier(r.success === true,
            "un marchand resté sur Green API ne reçoit plus rien quand le code passe par un modèle");
        verifier(/green-api\.com/.test(ENVOIS[0]?.url || ""),
            "l'envoi de repli ne part pas par Green API");
        verifier(ENVOIS[0]?.corps?.message === "Ta commande est confirmée.",
            "le texte de repli n'est pas celui du modèle — le client reçoit autre chose que ce qui était prévu");

        ENVOIS.length = 0;
        const sansRepli = await f.envoyerModele(
            { fournisseur: "green", apiId: "1101", apiToken: "tok" },
            { to: CLIENT, nom: "commande_confirmee" },
        );
        verifier(sansRepli.success === false && !ENVOIS.length,
            "sans texte de repli, Green API reçoit un appel de modèle qu'il ne comprend pas — l'envoi est perdu sans erreur");
    }

    // ══════════════════════════════════════════════════════════════════════
    // 7. LE CATALOGUE DES MODÈLES
    //
    // Le texte des modèles vit chez Meta ; nous n'envoyons qu'un nom et des
    // valeurs ORDONNÉES. Une erreur d'ordre ne se voit nulle part : Meta
    // accepte n'importe quel texte dans n'importe quelle variable, et le
    // client reçoit « Bonjour 15 000 FCFA, votre commande Marlyse est
    // confirmée ». Aucune erreur, aucun journal — juste un marchand humilié
    // devant son client.
    //
    // Le catalogue fixe donc l'ordre à UN endroit, et
    // scripts/test-whatsapp.js le confronte à ce que Meta déclare vraiment.
    // ══════════════════════════════════════════════════════════════════════
    {
        const catalogue = require(path.join(RACINE, "config", "modeles-whatsapp.js"));

        const p = catalogue.pour("commande.expediee", ["Marlyse", "CMD-42", "3 sept"]);
        verifier(p?.nom === "livraison_estime",
            "l'événement « commande expédiée » ne trouve plus son modèle — le suivi ne partira jamais hors fenêtre");
        verifier(p?.langue === "fr",
            "le modèle est demandé dans une autre langue que celle approuvée : Meta refuse l'envoi");
        verifier(JSON.stringify(p?.variables) === JSON.stringify(["Marlyse", "CMD-42", "3 sept"]),
            "les valeurs ne partent pas dans l'ordre déclaré — le client lira la date à la place de son nom");

        // Le repli est calculé PAR le catalogue, pas par l'appelant : le même
        // message ne doit pas exister en deux versions qui divergent.
        verifier(/Marlyse/.test(p?.repli || "") && /CMD-42/.test(p?.repli || ""),
            "le texte de repli ne reprend pas les valeurs : les marchands sur Green API reçoivent un message à trous");

        // ── UN MODÈLE QUI N'EXISTE PLUS N'EST PAS BRANCHÉ ────────────────
        //
        // `commande_confirmee` a été créé chez Meta le 1er septembre à 04:55
        // puis supprimé à 04:56. Le laisser dans la table des événements
        // ferait échouer chaque confirmation avec une erreur que personne ne
        // lit. Non branché, pour() rend null et l'appelant écrit en texte
        // libre — ce qui arrive vraiment, dans la fenêtre de 24 h.
        verifier(catalogue.pour("commande.confirmee", ["Marlyse"]) === null,
            "« commande.confirmee » pointe vers un modèle que Meta ne connaît pas : chaque confirmation échouera en silence");
        verifier(Boolean(catalogue.MANQUANTS?.commande_confirmee),
            "le modèle manquant n'est plus documenté : on oubliera qu'il faut le recréer, et personne ne saura pourquoi les confirmations ne partent pas");

        // rejoinds_samii n'a AUCUNE variable chez Meta. En envoyer une fait
        // rejeter l'appel : Meta refuse un composant « body » dont il n'a pas
        // besoin. C'est une des trois erreurs que le script a débusquées.
        // ── CE QUE META NOUS A RÉPONDU LE 1er SEPTEMBRE ──────────────────
        //
        // Ces nombres ne sont pas un choix : ce sont les comptes que Meta a
        // déclarés quand scripts/test-whatsapp.js les a lus. Ils sont fixés
        // ici pour qu'un retour en arrière — quelqu'un qui « corrige » 3 en
        // 2 parce que le nom du modèle ne suggère que deux valeurs — fasse
        // échouer la suite au lieu de partir en production.
        //
        // Ce contrôle ne remplace PAS le script : si le modèle change chez
        // Meta, seul le script le verra. Il empêche seulement de défaire une
        // correction qui a coûté un aller-retour.
        for (const [cle, attendu] of [
            ["livraison_estime", 3],
            ["commande_livree", 2],
            ["echec_de_la_livraison", 3],
            ["rejoinds_samii", 0],
        ]) {
            const n = catalogue.MODELES[cle]?.variables?.length;
            verifier(n === attendu,
                `« ${cle} » déclare ${n} variable(s), Meta en attendait ${attendu} au dernier contrôle — `
                + `les valeurs partiraient décalées et le client lirait une phrase absurde signée du marchand`);
        }

        const invit = catalogue.pour("invitation", ["Marlyse"]);
        verifier(invit && invit.variables.length === 0,
            `l'invitation part avec ${invit?.variables.length} variable(s) alors que Meta n'en attend aucune — l'envoi sera rejeté`);

        // Un événement inconnu ne doit pas fabriquer un nom de modèle : mieux
        // vaut rendre null et laisser l'appelant écrire en texte libre.
        verifier(catalogue.pour("evenement.inexistant", []) === null,
            "un événement inconnu renvoie quand même un modèle — on appellera chez Meta un nom qui n'existe pas");

        // Chaque modèle du catalogue doit être complet : sans nom, l'appel
        // part vide ; sans liste de variables, on ne sait plus combien en
        // envoyer.
        for (const [cle, m] of Object.entries(catalogue.MODELES)) {
            verifier(typeof m.nom === "string" && m.nom.length > 0,
                `le modèle « ${cle} » n'a pas de nom`);
            verifier(Array.isArray(m.variables),
                `le modèle « ${cle} » ne déclare pas l'ordre de ses variables`);
            verifier(typeof m.repli === "function",
                `le modèle « ${cle} » n'a pas de texte de repli — un marchand sur Green API ne recevra rien`);
        }

        // Tout événement branché doit pointer vers un modèle qui existe.
        for (const [evenement, cle] of Object.entries(catalogue.POUR)) {
            verifier(Boolean(catalogue.MODELES[cle]),
                `l'événement « ${evenement} » pointe vers « ${cle} », qui n'est pas dans le catalogue`);
        }
    }

    if (echecs.length) {
        console.error(`❌ WhatsApp SAMII : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ WhatsApp SAMII : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ WhatsApp SAMII : la suite n'a pas pu s'exécuter —", err.stack);
    process.exit(1);
});
