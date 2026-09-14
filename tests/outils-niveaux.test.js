// ==========================================================================
// SAMII OS — Quels outils SAMII porte-t-il vraiment, à chaque niveau ?
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE.
//
// `config/niveaux.js` DÉCLARE quels outils un niveau porte. Ce fichier-ci
// vérifie ce que la vraie fonction RENVOIE — ce n'est pas la même chose, et
// c'est justement l'écart entre les deux qui coûte de l'argent.
//
// Trois pannes possibles, toutes silencieuses :
//
//   1. UNE FUITE DE COMMERCE. Si un niveau élevé se voyait accorder
//      confirmer_commande, le fondateur pourrait confirmer la commande d'un
//      marchand depuis son propre chat. Rien ne planterait : une commande
//      changerait simplement de statut sans que son marchand l'ait demandé.
//
//   2. UNE RÉGRESSION DES CANAUX CLIENTS. Telegram, WhatsApp et Messenger ne
//      déclarent aucun niveau. Si l'ajout des niveaux leur retirait leurs
//      outils, les clients des marchands ne pourraient plus commander — et
//      le chat continuerait de répondre poliment, sans rien enregistrer.
//
//   3. UNE CHARGE VIDE. Un niveau sans outil qui enverrait quand même un
//      champ `tools: []` fait refuser l'appel ENTIER par l'API. Tous les
//      messages de ce niveau échoueraient.
//
// On appelle la VRAIE fonction, avec le VRAI tableau d'outils.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const N = require(path.join(RACINE, "config", "niveaux.js"));

// On charge geminiService pour de vrai. Il n'a besoin d'aucune clé tant
// qu'on n'appelle pas le réseau — et on ne l'appelle pas.
const gemini = require(path.join(RACINE, "services", "geminiService.js"));
const construire = gemini.__test_buildToolsPayload;

// Les noms rendus par la vraie fonction, pour un tour donné.
function nomsRendus(useTools, context) {
    const charge = construire(useTools, context);
    if (!charge) return null;                       // aucun outil : null, pas []
    return charge[0].functionDeclarations.map((fn) => fn.name).sort();
}

// ── 0. L'INSTRUMENT RÉPOND-IL ? ──────────────────────────────────────────
{
    verifier(typeof construire === "function",
        "geminiService n'expose plus buildToolsPayload aux tests — cette suite ne mesure rien");
}

// ── 1. LES CANAUX CLIENTS NE BOUGENT PAS ─────────────────────────────────
//
// LA GARDE ANTI-RÉGRESSION. Telegram, WhatsApp et Messenger appellent SAMII
// sans déclarer de niveau. Ils doivent recevoir exactement ce qu'ils
// recevaient avant que les niveaux existent.
{
    const clientSansNiveau = nomsRendus(true, { source: "telegram", audience: "client" });
    verifier(clientSansNiveau.length === 14,
        `une conversation client sans niveau reçoit ${clientSansNiveau.length} outils au lieu de 14 : ` +
        "les clients des marchands ne pourraient plus commander");
    for (const outil of N.FAMILLES.commerce) {
        verifier(clientSansNiveau.includes(outil),
            `une conversation client a perdu « ${outil} » : le client ne peut plus passer commande`);
    }

    // ⚠️ CE BLOC A ÉTÉ CORRIGÉ APRÈS UNE PREUVE HTTP, ET IL GARDE LA MÊME
    // EXIGENCE — il la dit seulement au bon endroit.
    //
    // Il vérifiait : « le chat du marchand sans niveau reçoit 9 outils »,
    // écrit `nomsRendus(false, { audience: "souverain" })`. Mais ce couple
    // (pas d'outils demandés, pas de niveau) ne désignait plus seulement le
    // chat du marchand : c'est aussi celui de SEIZE générations de texte —
    // extraction de mémoire, réponse à un commentaire public, résumé d'un
    // document versé dans la base de connaissances. Toutes recevaient les
    // neuf outils, `envoyer_email` et `envoyer_facture` compris.
    //
    // Ce que le marchand doit garder est inchangé, et vérifié ci-dessous.
    // Ce qui change, c'est qu'on le nomme : une CONVERSATION, pas un appel
    // anonyme. La marque est posée par brain/planner.js, en code.
    const marchandSansNiveau = nomsRendus(false, { audience: "souverain", tourDeConversation: true });
    verifier(marchandSansNiveau.length === 9,
        `le chat du marchand sans niveau reçoit ${marchandSansNiveau.length} outils au lieu de 9`);

    // Et le revers, qui est la raison d'être de la correction.
    const generation = nomsRendus(false, { source: "memoire" });
    verifier(generation === null,
        `une génération de texte (« lis ceci, rends-moi du texte ») reçoit ` +
        `${JSON.stringify(generation)} : ces tours-là lisent justement ce que des inconnus ` +
        "ont écrit, et ne doivent tenir aucun outil");
    for (const interdit of N.FAMILLES.commerce) {
        verifier(!marchandSansNiveau.includes(interdit),
            `le chat du marchand porte « ${interdit} » : il pourrait agir sur le carnet d'un client`);
    }

    // L'inscription conversationnelle garde le sien, et RIEN d'autre.
    const onboarding = nomsRendus(false, { source: "onboarding" });
    verifier(onboarding.length === 1 && onboarding[0] === "creer_workspace",
        `l'inscription reçoit ${JSON.stringify(onboarding)} au lieu du seul creer_workspace`);
}

// ── 2. CHAQUE NIVEAU REND CE QU'IL DÉCLARE ───────────────────────────────
{
    for (const id of N.ORDRE) {
        const attendus = N.outilsDe(id).sort();
        const rendus = nomsRendus(false, { audience: "souverain", niveau: id });

        if (!attendus.length) {
            verifier(rendus === null,
                `le niveau « ${id} » ne déclare aucun outil mais la fonction rend ${JSON.stringify(rendus)} — ` +
                "un champ tools vide fait refuser l'appel entier");
            continue;
        }
        verifier(rendus !== null, `le niveau « ${id} » déclare ${attendus.length} outils et n'en reçoit aucun`);
        verifier(JSON.stringify(rendus) === JSON.stringify(attendus),
            `« ${id} » déclare [${attendus.join(", ")}] et reçoit [${(rendus || []).join(", ")}]`);
    }
}

// ── 3. LE COMMERCE NE FUIT JAMAIS PAR LE NIVEAU ──────────────────────────
//
// Même au niveau le plus élevé, même en demandant explicitement : hors
// conversation client, les outils de commerce restent fermés.
{
    for (const id of N.ORDRE) {
        const rendus = nomsRendus(false, { audience: "souverain", niveau: id }) || [];
        for (const interdit of N.FAMILLES.commerce) {
            verifier(!rendus.includes(interdit),
                `au niveau « ${id} », le chat du marchand reçoit « ${interdit} » : réfléchir plus fort ` +
                "donnerait le droit de toucher au carnet de commandes d'un client");
        }
    }
}

// ── 4. DANS UNE CONVERSATION CLIENT, LE COMMERCE RESTE OUVERT ────────────
//
// L'inverse compte autant. Le commerce vient de l'audience, pas du niveau :
// même au niveau le plus léger, un client doit pouvoir commander.
{
    const rapideChezLeClient = nomsRendus(true, { audience: "client", niveau: "rapide" }) || [];
    for (const outil of N.FAMILLES.commerce) {
        verifier(rapideChezLeClient.includes(outil),
            `au niveau Rapide, une conversation client perd « ${outil} » : le niveau déciderait ` +
            "d'un droit au lieu d'un effort");
    }
    // …et ne gagne pas pour autant la boîte mail du marchand.
    verifier(!rapideChezLeClient.includes("consulter_gmail"),
        "une conversation client au niveau Rapide reçoit consulter_gmail : le client lirait la " +
        "boîte mail de son marchand");
}

// ── 5. UN NIVEAU INCONNU NE DÉBLOQUE RIEN ────────────────────────────────
//
// Une valeur inattendue ne doit ni ouvrir tous les outils, ni tout fermer :
// elle retombe sur le niveau par défaut, comme partout ailleurs.
{
    const bidon = nomsRendus(false, { audience: "souverain", niveau: "super-maitre-ultime" });
    const defaut = nomsRendus(false, { audience: "souverain", niveau: N.DEFAUT });
    verifier(JSON.stringify(bidon) === JSON.stringify(defaut),
        `un niveau inconnu rend ${JSON.stringify(bidon)} au lieu du niveau par défaut`);
}

// ── 6. LA CONVERSION VERS LES RELAIS SURVIT AU VIDE ──────────────────────
//
// Les relais (Groq, OpenRouter, DeepSeek) reçoivent les outils dans un autre
// format. La conversion lisait `[0].functionDeclarations` sans garde : sur un
// niveau sans outil, elle faisait tomber l'appel entier.
{
    const convertir = gemini.__test_toOpenAiTools;
    verifier(typeof convertir === "function", "toOpenAiTools n'est plus exposé aux tests");
    for (const vide of [null, undefined, [], [{ functionDeclarations: [] }]]) {
        let resultat, leve = false;
        try { resultat = convertir(vide); } catch { leve = true; }
        verifier(!leve && Array.isArray(resultat) && resultat.length === 0,
            `toOpenAiTools(${JSON.stringify(vide)}) ${leve ? "lève une erreur" : "rend " + JSON.stringify(resultat)} — ` +
            "tout message d'un niveau sans outil échouerait sur les relais");
    }
    const plein = convertir(construire(false, { audience: "souverain", tourDeConversation: true }));
    verifier(plein.length === 9, `la conversion rend ${plein.length} outils au lieu de 9`);
    verifier(plein.every((o) => o.type === "function" && o.function?.name),
        "la conversion vers le format des relais a perdu sa forme");
}

// ── 7. LA PROFONDEUR DE RÉFLEXION ────────────────────────────────────────
//
// Le champ `generationConfig` est traître : un champ que le modèle ne
// connaît pas fait échouer l'appel ENTIER avec un 400. Pas une dégradation,
// pas un avertissement — tous les messages de ce niveau tombent d'un coup.
{
    const config = gemini.__test_configDeGeneration;
    verifier(typeof config === "function", "configDeGeneration n'est plus exposé aux tests");

    // Sans niveau : aucun réglage envoyé, le modèle garde ses défauts. C'est
    // ce qui permet de livrer les niveaux sans que personne ne le remarque.
    verifier(config({}) === null, "un tour sans niveau envoie quand même des réglages");
    verifier(config({ source: "telegram" }) === null,
        "les canaux clients reçoivent des réglages qu'ils n'ont pas demandés");

    // Chaque niveau rend quelque chose d'utilisable, et rien d'inconnu.
    const ACCEPTES = ["temperature", "maxOutputTokens", "topP", "topK"];
    let precedent = 0;
    for (const id of N.ORDRE) {
        const c = config({ niveau: id });
        verifier(c && typeof c === "object", `le niveau « ${id} » ne rend aucun réglage`);
        for (const cle of Object.keys(c || {})) {
            verifier(ACCEPTES.includes(cle),
                `« ${id} » envoie le champ « ${cle} » : si l'API ne le connaît pas, TOUS les ` +
                "messages de ce niveau échouent avec un 400");
        }
        verifier(c.maxOutputTokens > precedent,
            `« ${id} » ne répond pas plus long que le niveau d'en dessous (${c.maxOutputTokens})`);
        precedent = c.maxOutputTokens;
    }

    // ── LA GARDE QUI COMPTE LE PLUS ──────────────────────────────────────
    //
    // Si quelqu'un ajoute un jour un champ exotique au registre, il ne doit
    // PAS partir vers l'API. On le vérifie en en ajoutant un pour de vrai.
    const registre = require(path.join(RACINE, "config", "niveaux.js"));
    const sauvegarde = { ...registre.NIVEAUX.pro.generationConfig };
    registre.NIVEAUX.pro.generationConfig.thinkingConfig = { thinkingBudget: 9999 };
    registre.NIVEAUX.pro.generationConfig.champInvente = true;
    const filtre = config({ niveau: "pro" });
    registre.NIVEAUX.pro.generationConfig = sauvegarde;

    verifier(!("thinkingConfig" in filtre) && !("champInvente" in filtre),
        `un champ non vérifié du registre est parti vers l'API : ${JSON.stringify(filtre)} — ` +
        "tous les messages de ce niveau échoueraient");
    verifier(filtre.temperature === 0.8,
        "le filtrage a emporté les champs légitimes avec les autres");
}

// ── VERDICT ──────────────────────────────────────────────────────────────
if (echecs.length) {
    console.log(`\n❌ outils par niveau : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    echecs.forEach((e) => console.log(`   • ${e}`));
    process.exit(1);
}
console.log(`✅ outils par niveau : ${verifs} vérifications passées`);
