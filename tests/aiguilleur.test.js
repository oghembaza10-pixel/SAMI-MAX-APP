// ==========================================================================
// SAMII OS — L'AIGUILLEUR : un secours ne rouvre jamais ce qu'on a fermé
// ==========================================================================
//
// CE QUE CETTE SUITE SURVEILLE.
//
// Le chantier 7 tient en une phrase : le moteur qui répond n'est plus subi,
// il est choisi — et ce qu'il a le droit de PORTER dépend de LUI, pas
// seulement du niveau de l'utilisateur.
//
// Le défaut d'avant était invisible et coûteux. `chat()` calculait les
// outils pour Gemini, puis, si Gemini tombait, envoyait le MÊME jeu d'outils
// à Groq / OpenRouter / DeepSeek. Trois conséquences, toutes réelles :
//
//   • `consulter_gmail` partait chez Groq. Groq l'appelait. Et le résultat
//     lui était ensuite refusé (politique Limited Use de Google). Le tour
//     finissait sur « je ne peux pas le reformuler » : une impasse servie
//     comme une capacité.
//   • `envoyer_facture` partait chez un modèle dont le code dit lui-même
//     qu'il est « moins discipliné que Gemini sur le function calling ». Un
//     argument inventé, et c'est une vraie facture, sous le nom du
//     marchand, chez un vrai client.
//   • Une image jointe partait chez des moteurs aveugles.
//
// ON NE TESTE DONC PAS « LE FICHIER EXISTE ». On fait tomber Gemini pour de
// bon, on regarde le corps HTTP réellement envoyé au relais, et on compte
// ce qu'il contient.
//
// ── CE QUI EST RÉELLEMENT EXERCÉ, ET CE QUI NE L'EST PAS ─────────────────
//
// RÉEL   : la sélection, l'ordre de la chaîne, l'intersection des outils, le
//          corps HTTP construit, le nombre d'appels, la bascule sur panne.
// SIMULÉ : les moteurs eux-mêmes. Il n'y a aucune clé Gemini, Groq,
//          OpenRouter ni DeepSeek dans cet environnement. La qualité des
//          réponses d'un modèle donné n'est donc PAS mesurée ici — seule
//          l'est la décision de l'appeler et ce qu'on lui confie.
//
// Lancer :  npm test
// ==========================================================================

// Les clés AVANT tout require : config.js les lit au CHARGEMENT. Posées
// après, `CONFIG.GROQ.API_KEY` serait vide, `postGroq` refuserait avant même
// de construire un corps, et la suite mesurerait un relais absent au lieu
// de mesurer ce qu'on lui confie. C'est exactement le piège qui avait faussé
// flux-qg.test.js au premier essai.
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "cle-essai-aiguilleur";
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "cle-essai-groq";
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "cle-essai-openrouter";
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "cle-essai-deepseek";

const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const MOTEURS = require(path.join(RACINE, "config", "moteurs.js"));
const NIVEAUX = require(path.join(RACINE, "config", "niveaux.js"));

// ══════════════════════════════════════════════════════════════════════════
// 1. LE REGISTRE DIT LA VÉRITÉ SUR CE QUI EXISTE
// ══════════════════════════════════════════════════════════════════════════
{
    // ── L'INVARIANT QUI PROTÈGE GEMINI ───────────────────────────────────
    //
    // LE PIÈGE. Le troisième filtre intersecte les outils avec les familles
    // du moteur. Si un outil déclaré dans TOOLS n'appartenait à AUCUNE
    // famille, il disparaîtrait — y compris chez Gemini, qui les porte
    // toutes. Le chat continuerait de répondre, simplement SAMII ne saurait
    // plus faire cette chose-là. Personne ne le verrait.
    //
    // Cette garde est donc plus importante qu'elle n'en a l'air : c'est elle
    // qui rend l'ajout d'un outil sûr. Oublier la famille casse le test au
    // lieu de casser SAMII en silence.
    const gemini = require(path.join(RACINE, "services", "geminiService.js"));
    const tousLesOutils = gemini.TOOLS[0].functionDeclarations.map((f) => f.name);
    const dansUneFamille = new Set(Object.values(NIVEAUX.FAMILLES).flat());

    const orphelins = tousLesOutils.filter((n) => !dansUneFamille.has(n));
    verifier(orphelins.length === 0,
        `outil(s) déclaré(s) dans TOOLS mais dans aucune famille : ${orphelins.join(", ")} — ` +
        "l'intersection par moteur les fera disparaître, y compris chez Gemini, sans rien dire");

    const fantomes = [...dansUneFamille].filter((n) => !tousLesOutils.includes(n));
    verifier(fantomes.length === 0,
        `famille(s) nommant un outil qui n'existe pas dans TOOLS : ${fantomes.join(", ")} — ` +
        "un niveau croirait accorder une capacité qui n'a jamais existé");

    // ── AUCUNE CAPACITÉ GEMINI N'A ÉTÉ RETIRÉE ───────────────────────────
    verifier(MOTEURS.outilsFiablesDe("gemini-flash").length === tousLesOutils.length,
        `Gemini ne porte plus que ${MOTEURS.outilsFiablesDe("gemini-flash").length} outils sur ` +
        `${tousLesOutils.length} : le chantier 7 aurait RETIRÉ une capacité au lieu d'en encadrer une`);

    // ── UN MOTEUR INCONNU NE PORTE RIEN (ÉCHEC FERMÉ) ────────────────────
    //
    // Le jour où un cinquième relais est branché et que quelqu'un oublie de
    // le déclarer, il doit répondre en texte — pas porter des outils sans
    // surveillance. L'oubli dégrade, il n'ouvre pas.
    verifier(MOTEURS.outilsFiablesDe("un-moteur-jamais-declare").length === 0,
        "un moteur non déclaré porte quand même des outils : un relais ajouté sans fiche " +
        "recevrait des outils que personne n'a jugés sûrs pour lui");
    verifier(MOTEURS.moteur("un-moteur-jamais-declare") === null,
        "le registre invente un moteur pour un identifiant inconnu au lieu de dire non");
}

// ══════════════════════════════════════════════════════════════════════════
// 2. `outilsFiables` EST BIEN DÉFINI PAR MOTEUR, ET IL DIFFÈRE
// ══════════════════════════════════════════════════════════════════════════
{
    for (const id of ["groq", "openrouter", "deepseek"]) {
        const m = MOTEURS.moteur(id);

        verifier(!m.outilsFiables.includes("ecriture"),
            `${id} porte la famille « écriture » : un argument inventé par ce moteur enverrait ` +
            "un vrai e-mail ou une vraie facture, sous le nom du marchand, à un vrai client");

        verifier(!m.outilsFiables.includes("lecture"),
            `${id} porte la famille « lecture » : ses outils Workspace mènent à une impasse — ` +
            `le résultat ne lui sera jamais transmis (donneesGoogle=${m.donneesGoogle})`);

        // ── CE QU'ON N'A PAS SUPPRIMÉ ────────────────────────────────────
        //
        // La raison d'être écrite du relais : « SAMII continue de répondre
        // aux clients et de confirmer/créer leurs commandes plutôt que de
        // rester silencieux ». Un client qui commande un samedi soir
        // pendant une panne Google doit toujours être servi.
        verifier(m.outilsFiables.includes("commerce"),
            `${id} ne porte plus la famille « commerce » : pendant une panne Gemini, une commande ` +
            "client ne serait plus confirmée — c'est précisément la capacité que le relais existe pour tenir");

        verifier(m.donneesGoogle === false,
            `${id} est déclaré comme pouvant recevoir des données Google Workspace : ` +
            "la politique Limited Use l'interdit");
        verifier(m.capacites.vision === false,
            `${id} est déclaré comme voyant les images — il ne les voit pas, et SAMII dirait ` +
            "« je vois sur ta photo… » sans rien avoir vu");
        verifier(m.capacites.recherche === false,
            `${id} est déclaré comme sachant faire du grounding web — il n'en a aucun équivalent, ` +
            "et SAMII rendrait des sources qui n'existent pas");
    }

    verifier(MOTEURS.recoitDonneesGoogle("gemini") === true,
        "Gemini n'a plus le droit de recevoir les données Workspace : la lecture de l'agenda et " +
        "de la boîte mail deviendrait impossible partout");
}

// ══════════════════════════════════════════════════════════════════════════
// 3. L'INTERSECTION À TROIS TERMES
// ══════════════════════════════════════════════════════════════════════════
//
//   outils du NIVEAU  ∩  outils de l'AUDIENCE  ∩  outilsFiables du MOTEUR
//
// Chacun peut refuser. On le mesure en APPELANT la fonction, pas en relisant
// le fichier : une intersection qui semble juste à la lecture peut très bien
// ne jamais s'exécuter.
{
    const gemini = require(path.join(RACINE, "services", "geminiService.js"));
    const noms = (payload) => (payload?.[0]?.functionDeclarations || []).map((f) => f.name);

    // Un niveau Pro (lecture + écriture), audience marchande (commerce).
    const ctx = { niveau: "pro" };

    const chezGemini = noms(gemini.__test_buildToolsPayload(true, ctx, "gemini"));
    verifier(chezGemini.includes("envoyer_facture") && chezGemini.includes("consulter_gmail")
        && chezGemini.includes("confirmer_commande"),
        `Gemini au niveau Pro ne porte plus ses trois familles (${chezGemini.length} outils) : ` +
        "le chantier aurait retiré une capacité existante");

    const chezGroq = noms(gemini.__test_buildToolsPayload(true, ctx, "groq"));
    verifier(!chezGroq.includes("envoyer_facture") && !chezGroq.includes("envoyer_email"),
        `LA BASCULE DE SECOURS ROUVRE L'ÉCRITURE : Groq reçoit ${chezGroq.join(", ")} — ` +
        "une panne Gemini suffirait à faire partir une facture décidée par un moteur qui invente ses arguments");
    verifier(!chezGroq.includes("consulter_gmail") && !chezGroq.includes("lister_fichiers_drive"),
        `Groq reçoit des outils Workspace (${chezGroq.join(", ")}) dont le résultat lui sera refusé : ` +
        "on lui tend une impasse");
    verifier(chezGroq.includes("confirmer_commande"),
        "Groq ne peut plus confirmer une commande : la capacité de secours a été supprimée");

    // ── LE NIVEAU RESTE SOUVERAIN SUR SES PROPRES FAMILLES ───────────────
    //
    // ⚠️ CE QUE CETTE VÉRIFICATION A APPRIS. Première version : elle exigeait
    // que « Rapide » ne porte AUCUN outil, avec `useTools: true`. Elle a
    // crié. Le code avait raison, pas le test.
    //
    // La règle réelle, écrite dans config/niveaux.js et antérieure au
    // chantier 7 : la famille « commerce » NE DÉPEND PAS DE L'EFFORT, elle
    // dépend de l'AUDIENCE. Un marchand qui parle à SAMII en mode Rapide
    // peut toujours faire confirmer une commande — c'est le métier, pas un
    // supplément de réflexion.
    //
    // Ce que le niveau commande, ce sont SES familles : lecture et écriture.
    // Rapide n'en porte aucune, et ça, aucun moteur ne peut le rouvrir.
    const rapideChezGemini = noms(gemini.__test_buildToolsPayload(true, { niveau: "rapide" }, "gemini"));
    verifier(rapideChezGemini.every((n) => NIVEAUX.FAMILLES.commerce.includes(n)),
        `le niveau Rapide porte autre chose que du commerce (${rapideChezGemini.join(", ")}) : ` +
        "le moteur aurait pris le pas sur le niveau, alors que les deux cadrans tournent indépendamment");
    verifier(gemini.__test_buildToolsPayload(false, { niveau: "rapide" }, "gemini") === null,
        "le niveau Rapide porte des outils hors audience marchande : un tour « rapide » " +
        "déclencherait un appel réseau et ne serait plus rapide");

    // L'audience reste souveraine : sans `useTools`, pas de commerce, même
    // chez un moteur qui ne sait porter que ça.
    const sansAudience = noms(gemini.__test_buildToolsPayload(false, ctx, "groq"));
    verifier(!sansAudience.includes("confirmer_commande"),
        "Groq porte « confirmer_commande » alors que l'audience ne l'autorise pas : le registre " +
        "des moteurs aurait ANNULÉ le garde-fou d'audience au lieu de s'ajouter à lui");

    // ── LE CHEMIN HISTORIQUE, SANS NIVEAU, EST FILTRÉ LUI AUSSI ──────────
    //
    // C'est LE chemin par lequel la fuite passait : `chatWithSearch` et les
    // appelants anciens n'ont pas de niveau dans leur contexte, et
    // recevaient donc `TOOLS` ou `SEARCH_TOOLS` en entier.
    const ancienChezGroq = noms(gemini.__test_buildToolsPayload(true, {}, "groq"));
    verifier(ancienChezGroq.length > 0 && ancienChezGroq.every((n) => NIVEAUX.FAMILLES.commerce.includes(n)),
        `le chemin sans niveau donne à Groq ${ancienChezGroq.join(", ")} — ` +
        "c'est par là que les outils d'écriture et Workspace repassaient");

    // ── ET CHEZ GEMINI, IL GARDE TOUT SAUF LES CHAÎNES D'AGENTS ──────────
    //
    // Un tour sans niveau est une conversation CLIENT (WhatsApp, Telegram,
    // page publique d'une boutique). Il doit garder tous ses outils
    // historiques — sinon les clients des marchands ne pourraient plus
    // commander — mais JAMAIS la famille « agents » : un client n'a rien à
    // faire dans les comptes sociaux du marchand.
    const ancienChezGemini = noms(gemini.__test_buildToolsPayload(true, {}, "gemini"));
    // Les familles qu'un client n'obtient JAMAIS. « agents » au chantier 8,
    // « code » au chantier 10 — la liste se lit dans le registre, elle n'est
    // pas recopiée, sinon la prochaine famille passerait sans bruit.
    const RESERVEES = [...NIVEAUX.FAMILLES.agents, ...NIVEAUX.FAMILLES.code];
    const horsAgents = gemini.TOOLS[0].functionDeclarations
        .filter((fn) => !RESERVEES.includes(fn.name));
    verifier(ancienChezGemini.length === horsAgents.length,
        `le chemin sans niveau porte ${ancienChezGemini.length} outils au lieu de ${horsAgents.length} : ` +
        "soit un outil client a disparu, soit une capacité réservée est offerte à un client");
    verifier(!ancienChezGemini.some((n) => RESERVEES.includes(n)),
        `un client de marchand se voit offrir une capacité réservée (${ancienChezGemini.join(", ")}) : ` +
        "il pourrait faire préparer une publication sur les comptes du marchand — ou, bien pire, " +
        "faire exécuter un programme sur notre machine");
}

// ══════════════════════════════════════════════════════════════════════════
// 4. LA CHAÎNE EST CHOISIE PAR L'INTENTION, PAS SEULEMENT PAR LA PANNE
// ══════════════════════════════════════════════════════════════════════════
{
    // ── UNE IMAGE : AUCUN RELAIS NE PEUT PRENDRE LA SUITE ────────────────
    const avecImage = MOTEURS.choisir({ niveau: "expert", besoins: { vision: true } });
    verifier(avecImage.chaine.every((id) => MOTEURS.moteur(id).fournisseur === "gemini"),
        `un tour avec image garde des relais aveugles dans sa chaîne : ${avecImage.chaine.join(" → ")} — ` +
        "SAMII dirait « je vois sur ta photo… » sans avoir rien vu");
    verifier(avecImage.ecartes.some((e) => e.id === "groq" && /vision/.test(e.raison)),
        "un relais est écarté sans que la raison soit rendue : on ne pourrait pas savoir pourquoi " +
        "un tour n'a pas eu de secours");

    // ── LA RECHERCHE WEB : idem ──────────────────────────────────────────
    const avecRecherche = MOTEURS.choisir({ niveau: "expert", besoins: { recherche: true } });
    verifier(avecRecherche.chaine.every((id) => MOTEURS.moteur(id).fournisseur === "gemini"),
        `un tour exigeant du grounding web garde des moteurs qui n'en ont pas : ` +
        `${avecRecherche.chaine.join(" → ")}`);

    // ── UNE FAMILLE EXIGÉE : LE CŒUR DU CHANTIER ─────────────────────────
    const ecriture = MOTEURS.choisir({ niveau: "pro", besoins: { famille: "ecriture" } });
    verifier(ecriture.chaine.every((id) => MOTEURS.moteur(id).fournisseur === "gemini"),
        `un tour qui doit ÉCRIRE garde des relais dans sa chaîne : ${ecriture.chaine.join(" → ")} — ` +
        "la bascule de secours réactiverait un outil volontairement retiré");

    const commerce = MOTEURS.choisir({ niveau: "expert", besoins: { famille: "commerce" } });
    verifier(commerce.chaine.includes("groq"),
        "un tour de confirmation de commande n'a plus aucun relais : pendant une panne Gemini, " +
        "le client ne serait plus servi");

    // ── L'ORDRE HISTORIQUE EST PRÉSERVÉ ──────────────────────────────────
    //
    // Gemini, puis Groq (gratuit, rapide), puis OpenRouter, puis DeepSeek
    // (payant) en dernier. Un registre qui réordonnerait ferait payer
    // DeepSeek avant d'avoir essayé le gratuit.
    const libre = MOTEURS.choisir({ niveau: "expert", besoins: {} });
    const relais = libre.chaine.filter((id) => MOTEURS.moteur(id).fournisseur !== "gemini");
    verifier(relais.join(",") === "groq,openrouter,deepseek",
        `l'ordre des relais a changé : ${relais.join(" → ")} — DeepSeek est payant et doit rester ` +
        "le dernier recours, après les gratuits");

    // Et le coût va bien en montant chez les relais.
    const couts = relais.map((id) => MOTEURS.moteur(id).cout);
    verifier(couts[0] === 0 && couts[couts.length - 1] > 0,
        `la chaîne de secours ne va plus du gratuit au payant (${couts.join(" → ")})`);
}

// ══════════════════════════════════════════════════════════════════════════
// 5. LE NIVEAU CHOISIT LE MOTEUR — ENFIN
// ══════════════════════════════════════════════════════════════════════════
//
// `config/niveaux.js` porte `moteur: "flash"` ou `"pro"` DEPUIS LE DÉBUT, et
// personne ne le lisait. Le niveau Maître tournait sur exactement la même
// machine que le niveau Rapide.
{
    for (const id of ["rapide", "expert"]) {
        const c = MOTEURS.choisir({ niveau: id, besoins: {} });
        verifier(c.prefere === "gemini-flash",
            `le niveau ${id} préfère ${c.prefere} au lieu de gemini-flash`);
    }

    for (const id of ["pro", "maitre"]) {
        const c = MOTEURS.choisir({ niveau: id, besoins: {} });
        verifier(c.prefere === "gemini-pro",
            `le niveau ${id} ne demande pas le moteur « pro » : le champ « moteur » de ` +
            "config/niveaux.js resterait lettre morte, et Maître tournerait comme Rapide");

        // ── ET IL REDESCEND, PARCE QU'AUCUN MODÈLE PRO N'EST VÉRIFIÉ ─────
        //
        // Aucun identifiant de modèle Gemini « pro » n'existe dans ce dépôt
        // et il n'y a pas de clé pour en obtenir un de l'API. En écrire un
        // de mémoire serait un 404 en production, sur le niveau le plus
        // cher, découvert par un client.
        verifier(c.chaine[0] === "gemini-flash",
            `le niveau ${id} part sur ${c.chaine[0]} alors qu'aucun modèle « pro » n'est vérifié : ` +
            "l'appel partirait vers un modèle qui n'existe peut-être pas");
        verifier(c.ecartes.some((e) => e.id === "gemini-pro"),
            "gemini-pro est écarté sans raison rendue : personne ne saurait qu'il manque un nom de modèle");
    }

    verifier(MOTEURS.MOTEURS["gemini-pro"].modele === null,
        "un identifiant de modèle Gemini « pro » a été écrit sans avoir été vérifié contre l'API — " +
        "c'est un 404 en production sur le niveau le plus cher");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LA PREUVE : ON FAIT TOMBER GEMINI ET ON REGARDE CE QUI PART
// ══════════════════════════════════════════════════════════════════════════
//
// Tout ce qui précède mesure des décisions. Ceci mesure le CORPS HTTP.
// On remplace axios, Gemini échoue pour de bon, et on lit ce que le relais
// reçoit réellement.
(async () => {
    const envoyes = [];
    let appelsGemini = 0;

    const axiosDouble = {
        post: async (url, body) => {
            const u = String(url);
            if (u.includes("generativelanguage.googleapis.com")) {
                appelsGemini++;
                const err = new Error("Gemini simulé en panne");
                err.response = { status: 503, data: { error: { status: "UNAVAILABLE" } } };
                throw err;
            }
            envoyes.push({ url: u, body });
            return { data: { choices: [{ message: { content: "Réponse du relais." } }] } };
        },
        get: async () => ({ data: {} }),
        create: () => axiosDouble,
        defaults: { headers: { common: {} } },
        interceptors: { request: { use: () => {} }, response: { use: () => {} } },
    };

    const Module = require("module");
    const vrai = Module.prototype.require;
    Module.prototype.require = function (nom) {
        if (nom === "axios") return axiosDouble;
        return vrai.apply(this, arguments);
    };
    delete require.cache[require.resolve(path.join(RACINE, "services", "geminiService.js"))];
    const gemini = require(path.join(RACINE, "services", "geminiService.js"));
    Module.prototype.require = vrai;

    // ── LE TOUR QUI FAISAIT FUIR LES OUTILS ──────────────────────────────
    //
    // Niveau Pro (lecture + écriture), audience marchande (commerce).
    // Avant le chantier 7, le relais recevait les quatorze outils.
    envoyes.length = 0;
    appelsGemini = 0;
    const reponse = await gemini.chat({
        message: "Envoie la facture à Fatima et confirme sa commande",
        context: { niveau: "pro", audience: "marchand" },
        useTools: true,
        history: [],
    });

    verifier(envoyes.length >= 1,
        "aucun relais n'a été appelé alors que Gemini est tombé : le secours ne fonctionne plus");

    const premier = envoyes[0];
    const outilsRecus = (premier?.body?.tools || []).map((t) => t.function?.name);

    verifier(!outilsRecus.includes("envoyer_facture"),
        `PREUVE DE LA FUITE : le relais a reçu ${outilsRecus.join(", ")} — « envoyer_facture » ` +
        "est parti chez un moteur qui n'a pas le droit de le tenir, à cause d'une simple panne Gemini");
    verifier(!outilsRecus.includes("envoyer_email"),
        `le relais a reçu « envoyer_email » (${outilsRecus.join(", ")})`);
    verifier(!outilsRecus.includes("consulter_gmail"),
        `le relais a reçu « consulter_gmail » (${outilsRecus.join(", ")}) — son résultat lui serait ` +
        "ensuite refusé : une impasse");
    verifier(outilsRecus.includes("confirmer_commande"),
        `le relais n'a pas reçu « confirmer_commande » (${outilsRecus.join(", ")}) : la commande de ` +
        "Fatima ne serait pas confirmée pendant la panne");

    verifier(reponse?.text === "Réponse du relais." || reponse?.type === "function_call",
        `la bascule n'a pas rendu la réponse du relais : ${JSON.stringify(reponse).slice(0, 120)}`);

    // ── L'AIGUILLEUR N'AJOUTE PAS D'APPEL D'IA ───────────────────────────
    //
    // Un routeur qui demanderait à un modèle « quel moteur dois-je
    // prendre ? » doublerait la facture de chaque message. Le choix est
    // synchrone, il ne coûte rien.
    verifier(envoyes.length === 1,
        `${envoyes.length} appels au relais pour un seul tour : le premier relais a répondu, ` +
        "les suivants n'avaient aucune raison d'être appelés");

    // ── LE NIVEAU RAPIDE : AUCUN OUTIL, MÊME EN SECOURS ──────────────────
    envoyes.length = 0;
    await gemini.chat({
        message: "Traduis bonjour en wolof",
        context: { niveau: "rapide", audience: "marchand" },
        useTools: false,
        history: [],
    });
    verifier(!envoyes[0]?.body?.tools,
        `le relais a reçu un champ « tools » pour un tour Rapide sans audience : ` +
        `${JSON.stringify(envoyes[0]?.body?.tools)}`);

    // ── LE GARDE WORKSPACE LIT LE REGISTRE ───────────────────────────────
    //
    // Il comparait `provider !== "gemini"`, une chaîne en dur. Il demande
    // maintenant au registre. On vérifie que le refus tient toujours.
    const refus = await gemini.chatWithFunctionResult({
        message: "et dans ma boîte mail ?",
        context: { niveau: "expert" },
        functionName: "consulter_gmail",
        functionArgs: {},
        functionResult: { messages: ["objet très privé"] },
        provider: "groq",
        toolCallId: "tc1",
        assistantMessage: { role: "assistant", content: null },
    });
    verifier(/ne peux pas le reformuler|ne peux pas la reformuler/.test(String(refus)),
        `le contenu d'une boîte mail a été transmis à Groq : « ${String(refus).slice(0, 90)} » — ` +
        "c'est une violation de la politique Limited Use de Google");
    const fuite = envoyes.some((e) => JSON.stringify(e.body).includes("objet très privé"));
    verifier(!fuite,
        "PREUVE DE FUITE : le contenu de la boîte mail apparaît dans un corps HTTP parti chez un tiers");

    // ── VERDICT ──────────────────────────────────────────────────────────
    if (echecs.length) {
        console.log(`\n❌ aiguilleur : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        echecs.forEach((e) => console.log(`   • ${e}`));
        process.exit(1);
    }
    console.log(`✅ aiguilleur : ${verifs} vérifications passées`);
    process.exit(0);
})().catch((err) => {
    console.error("❌ aiguilleur : la suite n'a pas pu être jouée —", err.message);
    console.error(err.stack);
    process.exit(1);
});
