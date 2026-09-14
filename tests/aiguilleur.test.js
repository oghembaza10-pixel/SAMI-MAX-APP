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

    // ⚠️ CE BLOC A ÉTÉ RÉÉCRIT AU CHANTIER « SÉPARATION DES CAPACITÉS ».
    //
    // Il mesurait deux contextes qui N'EXISTENT DANS AUCUNE ROUTE :
    //
    //   { niveau: "pro" } avec useTools: true  — un niveau de réflexion ET la
    //      famille commerce. Or un client de boutique n'a pas de niveau (il
    //      n'a pas de compte), et un marchand n'a jamais eu la famille
    //      commerce (elle agit sur le carnet d'un CLIENT). Le couple était
    //      une invention du test.
    //
    //   {} tout court — et il exigeait que ce chemin garde « tous ses outils
    //      historiques ». C'était vrai, et c'était le défaut : mesuré, un
    //      client de boutique repartait avec QUATORZE outils, dont
    //      consulter_gmail, envoyer_email et envoyer_facture — ceux du
    //      marchand. Le test protégeait la fuite.
    //
    // On mesure maintenant les DEUX POSTURES RÉELLES, séparément, comme
    // config/audiences.js les déclare.

    // ── LE MARCHAND / LE FONDATEUR, CHEZ LUI ─────────────────────────────
    const marchand = { niveau: "pro", audience: "souverain", tourDeConversation: true };

    const chezGemini = noms(gemini.__test_buildToolsPayload(false, marchand, "gemini"));
    verifier(chezGemini.includes("envoyer_facture") && chezGemini.includes("consulter_gmail"),
        `Gemini au niveau Pro ne porte plus lecture et écriture (${chezGemini.length} outils) : ` +
        "le chantier aurait retiré une capacité existante du marchand");
    verifier(!chezGemini.some((n) => NIVEAUX.FAMILLES.commerce.includes(n)),
        `le marchand porte des outils de commerce (${chezGemini.join(", ")}) : ceux-là agissent ` +
        "sur le carnet d'un CLIENT, et ce garde-fou existait avant ce chantier");

    const chezGroq = noms(gemini.__test_buildToolsPayload(false, marchand, "groq"));
    verifier(!chezGroq.includes("envoyer_facture") && !chezGroq.includes("envoyer_email"),
        `LA BASCULE DE SECOURS ROUVRE L'ÉCRITURE : Groq reçoit ${chezGroq.join(", ")} — ` +
        "une panne Gemini suffirait à faire partir une facture décidée par un moteur qui invente ses arguments");
    verifier(!chezGroq.includes("consulter_gmail") && !chezGroq.includes("lister_fichiers_drive"),
        `Groq reçoit des outils Workspace (${chezGroq.join(", ")}) dont le résultat lui sera refusé : ` +
        "on lui tend une impasse");

    // ── LE CLIENT D'UN MARCHAND ──────────────────────────────────────────
    //
    // Pas de niveau : il n'a pas de compte chez nous. La famille commerce, et
    // elle seule — c'est le produit, et c'est tout le produit.
    const client = { audience: "client", workspaceId: "ws1", tourDeConversation: true };

    const clientChezGemini = noms(gemini.__test_buildToolsPayload(true, client, "gemini"));
    verifier(clientChezGemini.length === NIVEAUX.FAMILLES.commerce.length
        && clientChezGemini.every((n) => NIVEAUX.FAMILLES.commerce.includes(n)),
        `un client reçoit ${clientChezGemini.join(", ")} au lieu de la seule famille commerce`);

    const clientChezGroq = noms(gemini.__test_buildToolsPayload(true, client, "groq"));
    verifier(clientChezGroq.includes("confirmer_commande"),
        "Groq ne peut plus confirmer une commande : la capacité de secours a été supprimée, " +
        "et la commande de Fatima ne serait pas confirmée pendant une panne Gemini");
    verifier(!clientChezGroq.includes("consulter_gmail"),
        `le relais rouvre les outils du marchand à un client (${clientChezGroq.join(", ")})`);

    // ── LE NIVEAU RESTE SOUVERAIN SUR SES PROPRES FAMILLES ───────────────
    //
    // Rapide ne porte ni lecture ni écriture, et aucun moteur ne peut le
    // rouvrir. (La famille commerce ne dépend pas du niveau : elle dépend de
    // l'audience — voir config/audiences.js.)
    verifier(gemini.__test_buildToolsPayload(false, { niveau: "rapide", audience: "souverain", tourDeConversation: true }, "gemini") === null,
        "le niveau Rapide porte des outils : un tour « rapide » déclencherait un appel réseau " +
        "et ne serait plus rapide");

    // ── LE MOTEUR S'AJOUTE AU GARDE-FOU, IL NE L'ANNULE PAS ──────────────
    verifier(!noms(gemini.__test_buildToolsPayload(false, marchand, "groq")).includes("confirmer_commande"),
        "Groq porte « confirmer_commande » pour un souverain : le registre des moteurs aurait " +
        "ANNULÉ le garde-fou d'audience au lieu de s'ajouter à lui");

    // ── ET L'AUDIENCE ABSENTE NE DONNE PLUS TOUT ─────────────────────────
    //
    // Mesuré avant correction : DIX-SEPT outils, `executer_code` compris.
    // Le calcul demandait « est-ce que ce n'est pas souverain ? », et
    // « absente » n'est pas « souverain ».
    verifier(gemini.__test_buildToolsPayload(true, { tourDeConversation: true, niveau: "maitre" }, "gemini") === null,
        "un contexte SANS audience reçoit encore des outils : un oubli dans une route donnerait " +
        "le maximum de pouvoir, en silence");
    // Les familles qu'un client n'obtient JAMAIS. La liste se lit dans le
    // registre, elle n'est pas recopiée : sinon la prochaine famille ajoutée
    // passerait sans bruit, comme « code » a failli le faire au chantier 10.
    const RESERVEES = [...NIVEAUX.FAMILLES.agents, ...NIVEAUX.FAMILLES.code,
        ...NIVEAUX.FAMILLES.lecture, ...NIVEAUX.FAMILLES.ecriture];
    verifier(!clientChezGemini.some((n) => RESERVEES.includes(n)),
        `un client de marchand se voit offrir une capacité réservée (${clientChezGemini.join(", ")}) : ` +
        "il pourrait lire la boîte mail du marchand, faire préparer une publication sur ses " +
        "comptes — ou, bien pire, faire exécuter un programme sur notre machine");
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
        // ⚠️ CE CONTEXTE DISAIT `audience: "marchand"`. Cette valeur n'existe
        // dans AUCUNE route du projet — les trois vraies sont « client »,
        // « community » et « souverain ». Elle tombait donc dans le
        // fourre-tout « ce n'est pas souverain », c'est-à-dire le traitement
        // client, et le test croyait mesurer un marchand.
        //
        // Ici : un marchand, chez lui, au niveau Pro. Le relais doit lui
        // refuser lecture et écriture — c'est ce que ce bloc vérifie.
        context: { niveau: "pro", audience: "souverain", tourDeConversation: true },
        useTools: false,
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
    // ── ET LA COMMANDE DE FATIMA, ELLE, PASSE TOUJOURS ──────────────────
    //
    // C'est une CLIENTE qui écrit à la boutique, pas le marchand : c'est donc
    // le tour client qu'il faut mesurer. Le commerce doit survivre à la
    // panne, sinon le produit s'arrête dès que Gemini tousse.
    envoyes.length = 0;
    await gemini.chat({
        message: "Confirme ma commande s'il te plaît",
        context: { audience: "client", workspaceId: "ws1", tourDeConversation: true },
        useTools: true,
        history: [],
    });
    const outilsClient = (envoyes[0]?.body?.tools || []).map((t) => t.function?.name);
    verifier(outilsClient.includes("confirmer_commande"),
        `le relais n'a pas reçu « confirmer_commande » (${outilsClient.join(", ")}) : la commande de ` +
        "Fatima ne serait pas confirmée pendant la panne");
    verifier(!outilsClient.includes("consulter_gmail") && !outilsClient.includes("envoyer_facture"),
        `le relais donne les outils du marchand à une cliente (${outilsClient.join(", ")})`);

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
