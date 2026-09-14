// ==========================================================================
// SAMII OS — LE FAILOVER : QUAND UN MOTEUR TOMBE, UN AUTRE RÉPOND
// ==========================================================================
//
// ── CE QUI EST ARRIVÉ EN PRODUCTION ──────────────────────────────────────
//
// Les quatre fournisseurs ont échoué le même jour, chacun pour une raison
// différente — et les quatre messages ci-dessous sont RECOPIÉS des journaux,
// pas inventés :
//
//   Gemini     : "This model is currently experiencing high demand."
//   Groq       : "The model `llama-3.3-70b-versatile` does not exist
//                 or you do not have access to it."
//   OpenRouter : "This model is unavailable for free. The paid version is
//                 available now - use this slug instead: openai/gpt-oss-20b"
//   DeepSeek   : "Clé DeepSeek absente (relais indisponible)."
//
// Deux modèles étaient morts — Groq a décommissionné le sien le 16 août
// 2026, OpenRouter a retiré la variante gratuite du sien le 22. Six jours
// d'écart. Rien ne l'a signalé, parce qu'un relais ne sert que les jours où
// le moteur principal tombe : ces jours-là, on croit que c'est lui le
// problème.
//
// ── CE QUE CETTE SUITE GARDE ─────────────────────────────────────────────
//
// Pas les noms de modèles — ils re-périmeront. Le MÉCANISME :
//   · une panne passagère fait basculer sur le suivant ;
//   · un modèle mort fait DEMANDER au fournisseur ce qu'il a ;
//   · une clé absente est écartée avant la boucle, pas essayée à chaque tour ;
//   · et quoi qu'il arrive, l'utilisateur reçoit UNE réponse, jamais un crash.
//
// Lancer :  node tests/failover.test.js
// ==========================================================================

const path = require("path");
const Module = require("module");

const RACINE = path.join(__dirname, "..");
let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ── LE FAUX RÉSEAU ───────────────────────────────────────────────────────
//
// On intercepte `axios` AVANT de charger le service : chaque appel sortant
// est routé vers un scénario. Aucune requête ne quitte la machine, et
// surtout : on peut reproduire une panne Groq sans avoir de clé Groq.
const APPELS = [];
let scenario = {};

function reponseErreur(statut, message) {
    const e = new Error(message);
    e.response = { status: statut, data: { error: { message } } };
    return e;
}
function reponseTexte(texte) {
    return { data: { choices: [{ message: { content: texte } }] } };
}

const fauxAxios = {
    async post(url, corps, config) {
        const qui = /generativelanguage/.test(url) ? "gemini"
            : /groq\.com/.test(url) ? "groq"
            : /openrouter/.test(url) ? "openrouter"
            : /deepseek/.test(url) ? "deepseek" : "?";
        APPELS.push({ qui, modele: corps?.model || null, type: "post" });
        const rep = scenario[qui];
        if (typeof rep === "function") return rep(corps);
        throw new Error(`scénario manquant pour ${qui}`);
    },
    async get(url, config) {
        const qui = /groq\.com/.test(url) ? "groq"
            : /openrouter/.test(url) ? "openrouter"
            : /deepseek/.test(url) ? "deepseek" : "?";
        APPELS.push({ qui, type: "models" });
        const cat = scenario[`${qui}:models`];
        if (typeof cat === "function") return cat();
        throw new Error("catalogue injoignable");
    },
    defaults: { timeout: 0 },
};

function chargerService(env = {}) {
    const vrai = Module.prototype.require;
    for (const [k, v] of Object.entries(env)) {
        if (v === null) delete process.env[k]; else process.env[k] = v;
    }
    Module.prototype.require = function (nom) {
        if (nom === "axios") return fauxAxios;
        return vrai.apply(this, arguments);
    };
    for (const m of ["config.js", "services/geminiService.js", "config/moteurs.js"]) {
        delete require.cache[require.resolve(path.join(RACINE, m))];
    }
    const service = require(path.join(RACINE, "services", "geminiService.js"));
    Module.prototype.require = vrai;
    return service;
}

// Des clés FICTIVES pour les trois relais : on teste le failover, pas
// l'authentification. Assez longues pour passer le contrôle de config.js.
const CLES = {
    GEMINI_API_KEY: "AQ.FICTIVE_pour_le_test_du_failover_AAA",
    GROQ_API_KEY: "gsk_FICTIVE_pour_le_test_failover_000000",
    OPENROUTER_API_KEY: "sk-or-FICTIVE_pour_le_test_failover_00",
    DEEPSEEK_API_KEY: "sk-FICTIVE_pour_le_test_failover_00000",
};

// Les messages EXACTS reçus en production.
const MSG = {
    geminiCharge: "This model is currently experiencing high demand.",
    groqMort: "The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.",
    orPayant: "This model is unavailable for free. The paid version is available now - "
            + "use this slug instead: openai/gpt-oss-20b",
};

const gemini = (texte) => () => ({ data: { candidates: [{ content: { parts: [{ text: texte }] } }] } });
const geminiSurcharge = () => {
    const e = new Error(MSG.geminiCharge);
    e.response = { status: 503, data: { error: { code: 503, status: "UNAVAILABLE", message: MSG.geminiCharge } } };
    throw e;
};

(async () => {

// ══════════════════════════════════════════════════════════════════════════
// TEST A — GEMINI DISPONIBLE → GEMINI RÉPOND
// ══════════════════════════════════════════════════════════════════════════
{
    const S = chargerService(CLES);
    APPELS.length = 0;
    scenario = { gemini: gemini("Réponse de Gemini") };
    const r = await S.chatLibre({ systemPrompt: "sp", message: "bonjour" });
    verifier(r.provider === "gemini", `A : le fournisseur est « ${r.provider} » au lieu de gemini`);
    verifier(r.text === "Réponse de Gemini", "A : le texte de Gemini n'est pas rendu");
    verifier(APPELS.filter((a) => a.type === "post").length === 1,
        `A : ${APPELS.filter((a) => a.type === "post").length} appels alors que Gemini a répondu du premier coup`);
}

// ══════════════════════════════════════════════════════════════════════════
// TEST B — GEMINI EN « HIGH DEMAND » → GROQ RÉPOND
// ══════════════════════════════════════════════════════════════════════════
//
// C'est le cas EXACT des journaux. Gemini dit « high demand » (503
// UNAVAILABLE) — une indisponibilité passagère, pas une clé morte. Le
// failover doit se déclencher, et Groq doit être appelé avec le modèle
// corrigé, pas avec celui que Groq a décommissionné.
{
    const S = chargerService(CLES);
    APPELS.length = 0;
    scenario = { gemini: geminiSurcharge, groq: () => reponseTexte("Réponse de Groq") };
    const r = await S.chatLibre({ systemPrompt: "sp", message: "bonjour" });
    verifier(r.provider === "groq", `B : le fournisseur est « ${r.provider} » au lieu de groq`);
    verifier(r.text === "Réponse de Groq", "B : Groq n'a pas répondu alors que Gemini était surchargé");

    const appelGroq = APPELS.find((a) => a.qui === "groq" && a.type === "post");
    verifier(!!appelGroq, "B : Groq n'a jamais été appelé");
    verifier(appelGroq && appelGroq.modele !== "llama-3.3-70b-versatile",
        "B : Groq est encore appelé avec « llama-3.3-70b-versatile », décommissionné le 16 août 2026");
    verifier(appelGroq && appelGroq.modele === require("../config/moteurs").moteur("groq").modele,
        "B : le modèle envoyé à Groq ne vient pas du registre");
}

// ══════════════════════════════════════════════════════════════════════════
// TEST C — GEMINI + GROQ TOMBENT → OPENROUTER RÉPOND
// ══════════════════════════════════════════════════════════════════════════
{
    const S = chargerService(CLES);
    APPELS.length = 0;
    scenario = {
        gemini: geminiSurcharge,
        groq: () => { throw reponseErreur(429, "Rate limit reached"); },
        openrouter: () => reponseTexte("Réponse d'OpenRouter"),
    };
    const r = await S.chatLibre({ systemPrompt: "sp", message: "bonjour" });
    verifier(r.provider === "openrouter", `C : le fournisseur est « ${r.provider} » au lieu d'openrouter`);
    const ordre = APPELS.filter((a) => a.type === "post").map((a) => a.qui);
    verifier(JSON.stringify(ordre) === JSON.stringify(["gemini", "groq", "openrouter"]),
        `C : l'ordre de secours est ${JSON.stringify(ordre)} au lieu de gemini → groq → openrouter`);
}

// ══════════════════════════════════════════════════════════════════════════
// TEST D — TOUT TOMBE → UNE RÉPONSE PROPRE, PAS UN CRASH
// ══════════════════════════════════════════════════════════════════════════
{
    const S = chargerService(CLES);
    APPELS.length = 0;
    const casse = () => { throw reponseErreur(503, "Service Unavailable"); };
    scenario = { gemini: geminiSurcharge, groq: casse, openrouter: casse, deepseek: casse };
    let r, aPlante = false;
    try { r = await S.chatLibre({ systemPrompt: "sp", message: "bonjour" }); }
    catch (e) { aPlante = true; }
    verifier(!aPlante, "D : la chaîne entière en panne fait LEVER — le serveur planterait au lieu de répondre");
    verifier(r && r.text === null && r.provider === null,
        "D : une panne totale ne rend pas la forme attendue { text: null, provider: null }");

    // Et sur le chemin du QG, la panne totale doit rendre une PHRASE marquée
    // `degrade` — pas un silence, et pas une réponse qu'un agent croirait vraie.
    const r2 = await S.chat({ message: "bonjour", context: {}, useTools: false, history: [] });
    verifier(r2 && r2.type === "text" && !!r2.text,
        "D : le QG ne rend aucune phrase quand tous les fournisseurs sont tombés");
    verifier(r2 && r2.degrade === true,
        "D : la réponse de panne n'est pas marquée `degrade` — un agent la prendrait pour une vraie réponse");
}

// ══════════════════════════════════════════════════════════════════════════
// TEST E — UN MODÈLE MORT FAIT DEMANDER AU FOURNISSEUR CE QU'IL A
// ══════════════════════════════════════════════════════════════════════════
//
// LE CŒUR DE CE CHANTIER. Groq répond « ce modèle n'existe pas ». Réessayer
// ne servira JAMAIS : c'est le nom qu'il faut changer. Le service doit donc
// interroger /models et retenter avec un modèle réellement servi — au lieu
// d'abandonner le relais pour toujours.
{
    const S = chargerService(CLES);
    APPELS.length = 0;
    const SECOURS = require("../config/moteurs").moteur("groq").modelesDeSecours[0];
    let essais = 0;
    scenario = {
        gemini: geminiSurcharge,
        groq: (corps) => {
            essais++;
            if (corps.model === SECOURS) return reponseTexte("Groq, avec le modèle de secours");
            throw reponseErreur(404, MSG.groqMort);
        },
        "groq:models": () => ({ data: { data: [{ id: SECOURS }, { id: "autre-chose" }] } }),
    };
    const r = await S.chatLibre({ systemPrompt: "sp", message: "bonjour" });
    verifier(r.provider === "groq",
        `E : le relais est abandonné au lieu de chercher un modèle vivant (fournisseur « ${r.provider} »)`);
    verifier(APPELS.some((a) => a.qui === "groq" && a.type === "models"),
        "E : /models n'est jamais interrogé — le système suppose éternellement que le modèle existe");
    verifier(essais === 2, `E : ${essais} appels à Groq au lieu de 2 (le mort, puis le vivant)`);

    // Et le modèle trouvé est RETENU : le tour suivant ne recommence pas.
    APPELS.length = 0;
    await S.chatLibre({ systemPrompt: "sp", message: "encore" });
    const deuxieme = APPELS.find((a) => a.qui === "groq" && a.type === "post");
    verifier(deuxieme && deuxieme.modele === SECOURS,
        "E : le modèle trouvé n'est pas retenu — chaque tour refait la découverte");
    verifier(!APPELS.some((a) => a.type === "models"),
        "E : /models est ré-interrogé à chaque tour au lieu d'être retenu");
}

// ══════════════════════════════════════════════════════════════════════════
// TEST F — LE SLUG QUE LE FOURNISSEUR PROPOSE LUI-MÊME EST SUIVI
// ══════════════════════════════════════════════════════════════════════════
//
// OpenRouter n'écrit pas seulement « ce modèle n'est plus gratuit » : il dit
// « use this slug instead: … ». C'est la source la plus fiable qui existe.
//
// ⚠️ PREMIÈRE VERSION DE CE TEST : FAUSSE. Le faux OpenRouter acceptait le
// modèle DÉJÀ configuré au registre — le premier appel réussissait donc, et
// la découverte n'était jamais exercée. Le test passait même en retirant
// complètement la lecture du slug. Ici, le fournisseur refuse le modèle du
// registre et n'accepte QUE celui qu'il a nommé : seule la suggestion peut
// faire réussir ce tour.
{
    const S = chargerService(CLES);
    APPELS.length = 0;
    const CONFIGURE = require("../config/moteurs").moteur("openrouter").modele;
    const SUGGERE = "openai/un-slug-que-seul-le-fournisseur-connait";
    scenario = {
        gemini: geminiSurcharge,
        groq: () => { throw reponseErreur(503, "down"); },
        openrouter: (corps) => {
            if (corps.model === SUGGERE) return reponseTexte("OpenRouter, slug suggéré");
            throw reponseErreur(404, "This model is unavailable for free. The paid version is "
                + `available now - use this slug instead: ${SUGGERE}`);
        },
        // Le catalogue le confirme — sans quoi on n'enverrait pas une
        // conversation à un modèle dont on ne sait rien.
        "openrouter:models": () => ({ data: { data: [{ id: SUGGERE }, { id: "autre" }] } }),
    };
    const r = await S.chatLibre({ systemPrompt: "sp", message: "bonjour" });
    verifier(r.provider === "openrouter" && /slug suggéré/.test(r.text || ""),
        "F : le slug que le fournisseur propose dans son message d'erreur n'est pas suivi");
    const essais = APPELS.filter((a) => a.qui === "openrouter" && a.type === "post");
    verifier(essais.length === 2 && essais[0].modele === CONFIGURE && essais[1].modele === SUGGERE,
        `F : la séquence des modèles est ${JSON.stringify(essais.map((e) => e.modele))} — on attend `
        + "le modèle du registre, puis celui que le fournisseur a nommé");
}

// ══════════════════════════════════════════════════════════════════════════
// TEST G — UN RELAIS SANS CLÉ N'EST PAS ESSAYÉ
// ══════════════════════════════════════════════════════════════════════════
//
// « Clé DeepSeek absente » apparaissait à CHAQUE tour de repli : un échec
// annoncé, répété, qui noyait les vraies erreurs juste à côté.
{
    const S = chargerService({ ...CLES, DEEPSEEK_API_KEY: null });
    APPELS.length = 0;
    scenario = {
        gemini: geminiSurcharge,
        groq: () => { throw reponseErreur(503, "down"); },
        openrouter: () => reponseTexte("OpenRouter répond"),
    };
    const journal = [];
    const vraiErr = console.error, vraiWarn = console.warn;
    console.error = (...a) => journal.push(a.map(String).join(" "));
    console.warn = (...a) => journal.push(a.map(String).join(" "));
    const r = await S.chatLibre({ systemPrompt: "sp", message: "bonjour" });
    console.error = vraiErr; console.warn = vraiWarn;
    verifier(r.provider === "openrouter", "G : la chaîne ne va pas au bout sans la clé DeepSeek");

    // ── ET MAINTENANT, EN ALLANT JUSQU'AU BOUT ──────────────────────────
    //
    // ⚠️ PREMIÈRE VERSION DE CE TEST : AVEUGLE. OpenRouter réussissait, donc
    // la chaîne s'arrêtait là et DeepSeek n'était JAMAIS atteint — avec ou
    // sans le filtre. Le test ne pouvait rien voir : il passait même en
    // désactivant complètement l'exclusion.
    //
    // Pour observer qu'un relais sans clé n'est pas essayé, il faut que la
    // chaîne arrive jusqu'à lui.
    const journal2 = [];
    console.error = (...a) => journal2.push(a.map(String).join(" "));
    console.warn = (...a) => journal2.push(a.map(String).join(" "));
    scenario = {
        gemini: geminiSurcharge,
        groq: () => { throw reponseErreur(503, "down"); },
        openrouter: () => { throw reponseErreur(503, "down aussi"); },
        // deepseek : AUCUN scénario. S'il est appelé, le faux axios lève
        // « scénario manquant » — une trace impossible à manquer.
    };
    APPELS.length = 0;
    await S.chatLibre({ systemPrompt: "sp", message: "encore" });
    console.error = vraiErr; console.warn = vraiWarn;
    verifier(!journal2.some((l) => /Clé DeepSeek absente/i.test(l)),
        "G : DeepSeek est ESSAYÉ sans clé jusqu'au bout de la chaîne — « Clé DeepSeek absente » "
        + "revient à chaque tour de repli et noie les vraies erreurs");
    verifier(!journal2.some((l) => /scénario manquant pour deepseek/i.test(l)),
        "G : une vraie requête est partie vers DeepSeek alors qu'il n'a aucune clé");
    // ⚠️ `APPELS` NE SUFFIT PAS ICI. `postDeepSeek` lève « Clé DeepSeek
    // absente » AVANT d'atteindre axios : un appel sans clé ne laisse aucune
    // trace dans la sonde réseau. Le test passait donc même en désactivant
    // complètement le filtre — il observait un endroit où rien ne se serait
    // vu de toute façon. On écoute donc ce que le service DIT.
    verifier(!APPELS.some((a) => a.qui === "deepseek"),
        "G : DeepSeek a reçu une vraie requête alors qu'il n'a aucune clé");
    verifier(!journal.some((l) => /Clé DeepSeek absente/i.test(l)),
        "G : DeepSeek est encore ESSAYÉ sans clé — l'échec annoncé revient à chaque tour de repli");
    verifier(journal.some((l) => /deepseek/i.test(l) && /aucune clé|écarté/i.test(l)) || true,
        "G : (informatif)");

    // ET IL NE BLOQUE PAS LES AUTRES : c'est l'exigence explicite.
    verifier(APPELS.some((a) => a.qui === "openrouter"),
        "G : l'absence de clé DeepSeek empêche les autres relais de servir");
}

// ══════════════════════════════════════════════════════════════════════════
// TEST H — ON NE BOUCLE PAS SUR UNE ERREUR DE CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════
//
// Une clé refusée (401) ne se répare pas en réessayant. Le relais passe la
// main UNE fois, sans rejouer, et le journal dit que c'est un humain qui
// doit agir.
{
    const S = chargerService(CLES);
    APPELS.length = 0;
    let appelsGroq = 0;
    scenario = {
        gemini: geminiSurcharge,
        groq: () => { appelsGroq++; throw reponseErreur(401, "Invalid API Key"); },
        openrouter: () => reponseTexte("OpenRouter répond"),
    };
    const r = await S.chatLibre({ systemPrompt: "sp", message: "bonjour" });
    verifier(r.provider === "openrouter", "H : une clé refusée sur Groq empêche la suite de la chaîne");
    verifier(appelsGroq === 1, `H : Groq est appelé ${appelsGroq} fois sur une clé refusée — réessayer ne la répare pas`);
    verifier(!APPELS.some((a) => a.qui === "groq" && a.type === "models"),
        "H : /models est interrogé sur une erreur de CLÉ — ce n'est pas un problème de modèle");
}

// ══════════════════════════════════════════════════════════════════════════
// TEST I — LE FLUX RETOMBE SUR LA CHAÎNE, EN UNE SEULE RÉPONSE
// ══════════════════════════════════════════════════════════════════════════
//
// « Ne transforme pas silencieusement un flux en plusieurs réponses
// utilisateur. » On compte donc les morceaux ET la valeur rendue.
{
    const S = chargerService(CLES);
    APPELS.length = 0;
    scenario = { gemini: geminiSurcharge, groq: () => reponseTexte("Réponse en repli du flux") };
    const morceaux = [];
    const r = await S.chatLibreFlux({ systemPrompt: "sp", message: "bonjour" },
        (m) => morceaux.push(m));
    verifier(r.provider === "groq", `I : le flux ne retombe pas sur la chaîne (fournisseur « ${r.provider} »)`);
    verifier(r.text === "Réponse en repli du flux", "I : le texte du relais n'arrive pas au visiteur");
    verifier(morceaux.length === 1 && morceaux[0] === r.text,
        `I : ${morceaux.length} morceaux émis pour une seule réponse — le flux se dédouble`);
}

// ══════════════════════════════════════════════════════════════════════════
// TEST J — UN FAILOVER RESTE UNE SEULE RÉPONSE UTILISATEUR
// ══════════════════════════════════════════════════════════════════════════
//
// La règle de facturation : Gemini échoue → Groq réussit = UN acte. Le
// débit se fait par TOUR (routes/api.js appelle `debiterTour` une fois,
// après la chaîne, clé sur `messageId`) — jamais par appel de fournisseur.
// On garde ici que `chat()` rend bien UNE réponse, quel que soit le nombre
// de fournisseurs traversés, et qu'elle ne porte PAS plusieurs actes.
{
    const S = chargerService(CLES);
    APPELS.length = 0;
    scenario = {
        gemini: geminiSurcharge,
        groq: () => { throw reponseErreur(503, "down"); },
        openrouter: () => reponseTexte("Une seule réponse"),
    };
    const r = await S.chat({ message: "bonjour", context: {}, useTools: false, history: [] });
    // ⚠️ ON NE COMPTE PAS « TROIS APPELS ». C'était la première version de ce
    // garde, et elle était fausse : `chat()` REJOUE Gemini deux fois sur une
    // surcharge, délibérément (« sans ce cas, chaque pic basculait
    // directement sur Groq, qui s'épuisait en quelques messages »). Cinq
    // appels sortants, donc — et c'est correct.
    //
    // Ce qui compte pour la FACTURATION n'est pas le nombre d'appels
    // techniques : c'est qu'il n'en sorte qu'UNE réponse utilisateur, et que
    // chaque fournisseur soit essayé dans l'ordre, une fois son tour venu.
    const sequence = APPELS.filter((a) => a.type === "post").map((a) => a.qui);
    const distincts = [...new Set(sequence)];
    verifier(JSON.stringify(distincts) === JSON.stringify(["gemini", "groq", "openrouter"]),
        `J : les fournisseurs traversés sont ${JSON.stringify(distincts)} au lieu de gemini → groq → openrouter`);
    verifier(sequence.filter((q) => q === "groq").length === 1,
        "J : Groq est appelé plusieurs fois pour un seul tour");
    verifier(sequence.filter((q) => q === "openrouter").length === 1,
        "J : OpenRouter est appelé plusieurs fois pour un seul tour");
    // Les réessais de Gemini restent BORNÉS : sans plafond, un pic de charge
    // ferait attendre le client indéfiniment avant même le premier relais.
    verifier(sequence.filter((q) => q === "gemini").length <= 3,
        `J : Gemini est rejoué ${sequence.filter((q) => q === "gemini").length} fois — le client attend avant le premier relais`);
    verifier(r && r.type === "text", "J : la traversée de trois fournisseurs ne rend pas une réponse texte");
    verifier(!Array.isArray(r.actes) || r.actes.length === 0,
        "J : le failover a produit des actes — ils seraient facturés en plus");
    verifier(typeof r.text === "string" && r.text.length > 0,
        "J : la réponse finale est vide alors qu'un relais a répondu");

    // La grille de crédits n'a pas bougé : un failover ne change pas un prix.
    const CREDITS = require("../config/credits");
    verifier(CREDITS.PRIX_MESSAGE_USD === 0.03,
        `J : le prix du message a changé (${CREDITS.PRIX_MESSAGE_USD}) — un chantier de failover ne touche pas aux tarifs`);
}

// ══════════════════════════════════════════════════════════════════════════
// TEST K — LA CLASSIFICATION ELLE-MÊME
// ══════════════════════════════════════════════════════════════════════════
//
// Les tests précédents observent le COMPORTEMENT, et deux familles peuvent
// produire le même comportement visible (une clé refusée et un 5xx font tous
// deux « passer au suivant »). Ce qui les sépare, c'est ce qu'on écrit dans
// le journal et ce qu'on rejoue — et c'est précisément ce qui manquait
// pendant que deux modèles morts tournaient en production.
//
// On appelle donc le classificateur directement, sur les messages RÉELS.
{
    const S = chargerService(CLES);
    const classer = S.__test_classerEchec;
    const err = (statut, message) => ({ response: { status: statut, data: { error: { message } } } });

    // Les deux messages de production qui disent « ce modèle n'existe plus ».
    verifier(classer(err(404, MSG.groqMort)) === "modele",
        "K : « does not exist or you do not have access to it » n'est pas reconnu comme un modèle mort");
    verifier(classer(err(404, MSG.orPayant)) === "modele",
        "K : « unavailable for free » n'est pas reconnu comme un modèle mort");
    verifier(classer(err(400, "The model `x` is not a valid model ID")) === "modele",
        "K : « is not a valid model » n'est pas reconnu comme un modèle mort");

    // ── LA LIGNE À NE PAS FRANCHIR ──────────────────────────────────────
    //
    // « This model is currently experiencing high demand » parle bien d'un
    // modèle. Mais il est là, il est juste occupé. Le classer « modèle mort »
    // ferait ABANDONNER Gemini au premier pic de charge — et Gemini est le
    // seul moteur qui voit les données Google, le seul qui streame, le seul
    // qui porte tous les outils. On le perdrait pour une minute d'affluence.
    verifier(classer(err(503, MSG.geminiCharge)) === "passager",
        "K : « high demand » est pris pour un modèle mort — Gemini serait abandonné au premier pic");
    verifier(classer(err(503, "The model is overloaded. Please try again later.")) === "passager",
        "K : « overloaded » est pris pour un modèle mort");

    // Ce qui demande un humain — surtout PAS un rejeu.
    verifier(classer(err(401, "Invalid API Key")) === "config",
        "K : une clé refusée (401) n'est pas classée « config » — on la rejouerait");
    verifier(classer(err(403, "Forbidden")) === "config",
        "K : un refus de permission (403) n'est pas classé « config »");
    verifier(classer({ message: "Clé DeepSeek absente (relais indisponible)." }) === "config",
        "K : une clé absente n'est pas classée « config »");

    // Ce pour quoi le failover existe.
    verifier(classer(err(429, "Rate limit reached")) === "passager",
        "K : un 429 n'est plus une bascule normale");
    verifier(classer(err(503, "Service Unavailable")) === "passager",
        "K : un 5xx n'est plus une bascule normale");
    verifier(classer(err(500, "Internal error")) === "passager", "K : un 500 n'est plus une bascule");
    verifier(classer({ message: "timeout of 60000ms exceeded" }) === "passager",
        "K : un temps dépassé n'est plus une bascule normale");
    verifier(classer({ message: "connect ECONNREFUSED 1.2.3.4:443" }) === "passager",
        "K : une coupure réseau n'est plus une bascule normale");

    // Et le slug suggéré est bien extrait du message, pas deviné.
    verifier(S.__test_slugSuggere(err(404, MSG.orPayant)) === "openai/gpt-oss-20b",
        "K : le slug proposé par OpenRouter n'est pas extrait de son message");
    verifier(S.__test_slugSuggere(err(503, "down")) === null,
        "K : un slug est inventé là où le fournisseur n'en propose aucun");
}

// ══════════════════════════════════════════════════════════════════════════
// TEST L — « GRATUIT » N'EST PAS UNE PROPRIÉTÉ DU MODÈLE
// ══════════════════════════════════════════════════════════════════════════
//
// `openai/gpt-oss-20b:free` a cessé d'être gratuit le 22 août 2026, et le
// suffixe a fait tomber tout le relais — pas parce que le modèle avait
// disparu, mais parce que la CONDITION avait changé.
//
// On ne fige pas un nom de modèle ici (il re-périmera) : on garde la leçon.
// Un relais dont la disponibilité dépend d'une offre commerciale est un
// relais qui tombera sans prévenir.
{
    const M = require("../config/moteurs");
    for (const id of M.ORDRE) {
        const m = M.moteur(id);
        if (!m || m.fournisseur === "gemini" || !m.modele) continue;
        verifier(!/:free$/.test(m.modele),
            `L : le relais « ${id} » vise « ${m.modele} » — un suffixe « :free » est une CONDITION `
            + "commerciale, pas un modèle : elle peut être retirée du jour au lendemain, et elle l'a été");
        verifier(Array.isArray(m.modelesDeSecours) && m.modelesDeSecours.length > 0,
            `L : le relais « ${id} » n'a aucun modèle de secours déclaré — le jour où le sien meurt, `
            + "la découverte n'aura rien à proposer");
        verifier(!m.modelesDeSecours.includes(m.modele),
            `L : « ${id} » liste son modèle courant parmi ses secours — on rejouerait le même`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// TEST M — UNE RÉPONSE VIDE N'EST PAS UNE RÉUSSITE
// ══════════════════════════════════════════════════════════════════════════
//
// Un relais peut répondre 200 avec un contenu vide (filtre de sécurité,
// troncature, modèle qui refuse). Sans garde, `chatLibre` rendait
// `{ text: undefined }` comme une réussite : le visiteur voyait une bulle
// vide, et le relais SUIVANT n'était jamais essayé alors qu'il aurait
// répondu.
{
    const S = chargerService(CLES);
    APPELS.length = 0;
    scenario = {
        gemini: geminiSurcharge,
        groq: () => ({ data: { choices: [{ message: { content: "" } }] } }),
        openrouter: () => reponseTexte("OpenRouter, lui, a du texte"),
    };
    const r = await S.chatLibre({ systemPrompt: "sp", message: "bonjour" });
    verifier(r.text === "OpenRouter, lui, a du texte",
        `M : une réponse VIDE de Groq est prise pour une réussite (texte rendu : ${JSON.stringify(r.text)}) — `
        + "le visiteur verrait une bulle vide alors qu'OpenRouter pouvait répondre");
    verifier(APPELS.some((a) => a.qui === "openrouter" && a.type === "post"),
        "M : le relais suivant n'est pas essayé après une réponse vide");
}

// ══════════════════════════════════════════════════════════════════════════
// TEST N — LE DERNIER RECOURS N'EST PAS UN CAS À PART
// ══════════════════════════════════════════════════════════════════════════
//
// `deepseek-chat` était mort depuis le 24 juillet 2026 — AVANT les deux
// autres — et personne ne l'a vu : la clé absente faisait échouer le relais
// bien avant qu'il atteigne le modèle. Une panne cachée par une autre panne.
//
// Le jour où la clé sera posée, ce sera en urgence, un jour où tout le reste
// est déjà tombé. Ce relais-là doit donc bénéficier de la MÊME découverte que
// les deux autres, sans quoi le dernier recours serait le seul à ne pas
// pouvoir se rattraper.
//
// On ne fige pas son nom de modèle ici : il re-périmera comme les autres.
// On garde qu'il sait se rattraper.
{
    const S = chargerService(CLES);
    APPELS.length = 0;
    const SECOURS = require("../config/moteurs").moteur("deepseek").modelesDeSecours[0];
    scenario = {
        gemini: geminiSurcharge,
        groq: () => { throw reponseErreur(503, "down"); },
        openrouter: () => { throw reponseErreur(503, "down"); },
        deepseek: (corps) => {
            if (corps.model === SECOURS) return reponseTexte("DeepSeek, en dernier recours");
            throw reponseErreur(404, "Model Not Exist");
        },
        "deepseek:models": () => ({ data: { data: [{ id: SECOURS }] } }),
    };
    const r = await S.chatLibre({ systemPrompt: "sp", message: "bonjour" });
    verifier(r.provider === "deepseek",
        `N : le dernier recours ne se rattrape pas sur un modèle mort (fournisseur « ${r.provider} »)`);
    verifier(APPELS.some((a) => a.qui === "deepseek" && a.type === "models"),
        "N : DeepSeek n'interroge pas /models — il serait le seul relais à ne pas pouvoir se rattraper");
}

if (echecs.length) {
    console.log(`\n❌ failover : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.log(`   • ${e}`);
    console.log("");
    process.exit(1);
}
console.log(`✅ failover : ${verifs} vérifications passées`);
})();
