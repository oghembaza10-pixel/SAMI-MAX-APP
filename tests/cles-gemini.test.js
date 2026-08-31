// ==========================================================================
// SAMII OS — La clé de secours est-elle vraiment utilisée ?
//
// POURQUOI CE TEST EXISTE. « J'ai ajouté une clé Gemini pour que SAMII tombe
// plus en panne. Après que le gratuit tombe en panne, on passe dessus, comme
// ça SAMII tombe jamais en panne. »
//
// C'est exactement ce que fait la rotation de clés. Le problème, c'est qu'on
// ne s'en aperçoit JAMAIS si elle ne marche pas : le jour où la première clé
// s'épuise, SAMII se tait, et le silence ressemble à une panne réseau. La
// seule preuve qu'une clé de secours sert à quelque chose, c'est un test qui
// épuise la première et regarde si la seconde est appelée.
//
// LE TROU QU'ON BOUCHE ICI. Le contrôle de quota lisait le code d'erreur
// UNIQUEMENT dans le corps JSON (`data.error.code`). Un 429 émis par la
// façade de Google, un proxy ou une passerelle n'a pas ce corps — il n'a
// qu'un statut HTTP, parfois une page HTML. La condition tombait à faux,
// l'erreur remontait, et la rotation n'avait pas lieu. Les clés de secours
// n'étaient donc pas essayées précisément le jour de forte charge où elles
// existent pour servir.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// Des clés déclarées comme sur Render. Les valeurs sont assez longues pour
// ressembler à de vraies clés : le ramassage écarte les valeurs trop courtes
// pour ne pas confondre une clé avec un « true » ou un identifiant.
process.env.GEMINI_API_KEY   = "cle-principale-AIzaXXXXXXXXXXXXX";
process.env.GEMINI_API_KEY_2 = "cle-secours-2-AIzaXXXXXXXXXXXXXX";
process.env.GEMINI_API_KEY_3 = "cle-secours-3-AIzaXXXXXXXXXXXXXX";
// Celle qu'il a posée sous le nom qu'il voulait, tiret compris.
process.env["SAMII-API-Key"] = "cle-samii-AIzaXXXXXXXXXXXXXXXXX";
// Des noms qui ressemblent mais qui ne sont PAS des clés : ils ne doivent
// pas entrer dans la rotation, sinon SAMII passe son temps à essayer de
// parler à Gemini avec un secret de webhook.
process.env.GEMINI_WEBHOOK_SECRET = "secret-a-ne-pas-confondre-XXXXXX";
process.env.GOOGLE_OAUTH_CLIENT_KEY = "391218285322-e6r6XXXXXXXXXXXX";
process.env.SAMII_API_KEY_VIDE = "x";   // trop courte pour être une clé
// LA MÊME CLÉ SOUS DEUX NOMS. C'est le cas le plus probable en vrai : on
// renomme une variable sur Render et on oublie de supprimer l'ancienne, ou
// on recolle la même clé deux fois. Sans dédoublonnage, elle est essayée
// deux fois de suite — et le jour où elle sature, deux bascules sont
// perdues à ré-essayer la clé qui vient justement d'échouer.
process.env.GEMINI_API_KEY_9 = "cle-secours-3-AIzaXXXXXXXXXXXXXX";

// Ce que l'API a répondu, et à quelle clé. On fabrique les erreurs à la
// main : ce sont les FORMES d'erreur qui comptent, pas le réseau.
const PRINCIPALE = process.env.GEMINI_API_KEY;
const SECOURS_2  = process.env.GEMINI_API_KEY_2;
const SECOURS_3  = process.env.GEMINI_API_KEY_3;

const APPELS = [];
let reponses = [];

function erreur(forme) {
    const e = new Error("429");
    e.response = forme;
    return e;
}

const Module = require("module");
const vraiRequire = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "axios") return {
        post: async (url) => {
            const cle = String(url).split("key=")[1];
            APPELS.push(cle);
            const suite = reponses.shift();
            if (suite instanceof Error) throw suite;
            return suite ?? { data: { candidates: [{ content: { parts: [{ text: "ok" }] } }] } };
        },
    };
    return vraiRequire.apply(this, arguments);
};
delete require.cache[require.resolve(path.join(RACINE, "config.js"))];
delete require.cache[require.resolve(path.join(RACINE, "services", "geminiService.js"))];
const gemini = require(path.join(RACINE, "services", "geminiService.js"));
Module.prototype.require = vraiRequire;

const CONFIG = require(path.join(RACINE, "config.js"));

(async () => {
    // ── 1. Les trois clés sont bien vues ────────────────────────────────
    //
    // Le nom de la variable est TOUT : une clé posée sur Render sous un autre
    // nom (« API_KEY », « GEMINI_KEY », le nom qu'elle porte dans la console
    // Google...) n'est jamais lue, et la panne qu'on croyait avoir évitée
    // arrive quand même. C'est la première chose qui casse, et la plus
    // silencieuse.
    const TROUVEES = CONFIG.GEMINI.API_KEYS;
    for (const [valeur, nom] of [
        ["cle-principale-AIzaXXXXXXXXXXXXX", "GEMINI_API_KEY"],
        ["cle-secours-2-AIzaXXXXXXXXXXXXXX", "GEMINI_API_KEY_2"],
        ["cle-secours-3-AIzaXXXXXXXXXXXXXX", "GEMINI_API_KEY_3"],
        ["cle-samii-AIzaXXXXXXXXXXXXXXXXX", "SAMII-API-Key (le nom qu'il a choisi, tiret compris)"],
    ]) {
        verifier(TROUVEES.includes(valeur),
            `la clé posée sous « ${nom} » n'est pas ramassée — elle est sur Render et ne servira jamais, sans une seule ligne d'erreur pour le dire`);
    }

    // Ce qui n'est PAS une clé ne doit pas entrer : SAMII passerait son temps
    // à présenter un secret de webhook à Gemini et à récolter des 400.
    for (const [valeur, quoi] of [
        ["secret-a-ne-pas-confondre-XXXXXX", "un secret de webhook"],
        ["391218285322-e6r6XXXXXXXXXXXX", "un identifiant client OAuth"],
        ["x", "une valeur trop courte pour être une clé"],
    ]) {
        verifier(!TROUVEES.includes(valeur),
            `${quoi} est pris pour une clé Gemini et sera essayé à chaque bascule`);
    }

    verifier(TROUVEES[0] === "cle-principale-AIzaXXXXXXXXXXXXX",
        "la clé principale n'est plus essayée en premier — le gratuit doit s'épuiser AVANT qu'on passe sur la suivante");
    verifier(new Set(TROUVEES).size === TROUVEES.length,
        "la même clé apparaît deux fois : elle sera essayée deux fois de suite, et sa saturation comptera pour deux bascules perdues");

    // ── 2. Chaque forme de 429 déclenche la bascule ─────────────────────
    //
    // Les trois formes viennent de vraies réponses de Google. La troisième —
    // un 429 sans corps JSON exploitable — est celle qui ne basculait pas.
    const FORMES = [
        [{ status: 429, data: { error: { code: 429, status: "RESOURCE_EXHAUSTED" } } },
            "le 429 complet, avec code et statut dans le corps"],
        [{ status: 429, data: { error: { status: "RESOURCE_EXHAUSTED" } } },
            "un 429 qui annonce RESOURCE_EXHAUSTED sans répéter le code"],
        [{ status: 429, data: "<html>Too Many Requests</html>" },
            "un 429 rendu en HTML par une passerelle — sans corps JSON, c'est celui qui ne basculait pas"],
        [{ status: 429 }, "un 429 nu, sans aucun corps"],
    ];

    for (const [forme, description] of FORMES) {
        APPELS.length = 0;
        reponses = [erreur(forme)];   // la 1re clé sature, la 2e répondra
        try {
            await gemini.chat({ message: "bonjour", useTools: false });
        } catch { /* le service relaie ailleurs, ce n'est pas ce qu'on mesure */ }

        verifier(APPELS.includes(SECOURS_2),
            `${description} : SAMII n'essaie PAS la clé de secours — elle est posée sur Render et ne sert jamais`);
        verifier(APPELS[0] === PRINCIPALE,
            `${description} : la clé principale n'a pas été essayée en premier`);
    }

    // ── 3. UNE CLÉ MORTE SE SAUTE, ELLE N'ARRÊTE PAS TOUT ───────────────
    //
    // Neuf clés valides sur dix-sept en service : huit ont été révoquées ou
    // leur projet Google fermé. Elles répondent 400 « API key not valid ».
    //
    // La rotation ne bougeait QUE sur un quota : une clé morte coupait la
    // boucle et partait droit sur le relais. Une seule clé morte en tête de
    // liste suffisait donc à ce que Gemini ne soit JAMAIS utilisé — pas une
    // fois, quelles que soient les seize clés valides derrière.
    for (const [forme, description] of [
        [{ status: 400, data: { error: { code: 400, message: "API key not valid. Please pass a valid API key." } } },
            "une clé révoquée (400 API key not valid)"],
        [{ status: 400, data: { error: { code: 400, status: "INVALID_ARGUMENT", message: "API_KEY_INVALID" } } },
            "une clé refusée (API_KEY_INVALID)"],
        [{ status: 403, data: { error: { code: 403, message: "Requests to this API are blocked." } } },
            "une clé désactivée (403)"],
    ]) {
        APPELS.length = 0;
        reponses = [erreur(forme)];
        try { await gemini.chat({ message: "bonjour", useTools: false }); } catch { /* peu importe */ }
        verifier(APPELS.includes(SECOURS_2),
            `${description} en tête de liste arrête toute la rotation — Gemini n'est jamais utilisé, à aucune requête`);
    }

    // ── 4. Mais un 400 qui vient de NOUS remonte tout de suite ──────────
    //
    // Un corps de requête malformé, un modèle inconnu : rejouer sur dix-sept
    // clés ne corrigerait rien, ferait dix-sept appels ratés au lieu d'un, et
    // masquerait notre bug derrière un faux problème de clés.
    APPELS.length = 0;
    reponses = [erreur({ status: 400, data: { error: { code: 400, message: "Invalid JSON payload received." } } })];
    try { await gemini.chat({ message: "bonjour", useTools: false }); } catch { /* attendu */ }
    verifier(!APPELS.includes(SECOURS_2),
        "une requête malformée fait tourner toutes les clés : dix-sept appels ratés, et la vraie cause devient invisible");

    // ── 5. Toutes les clés sont essayées avant d'abandonner ─────────────
    APPELS.length = 0;
    reponses = [
        erreur({ status: 429 }),
        erreur({ status: 429 }),
        { data: { candidates: [{ content: { parts: [{ text: "ok" }] } }] } },
    ];
    try { await gemini.chat({ message: "bonjour", useTools: false }); } catch { /* peu importe */ }
    verifier(APPELS.includes(SECOURS_3),
        "quand les deux premières clés sont épuisées, la troisième n'est jamais atteinte — la chaîne s'arrête à deux");

    if (echecs.length) {
        console.error(`❌ clés Gemini : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ clés Gemini : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ clés Gemini : la suite n'a pas pu s'exécuter —", err.stack);
    process.exit(1);
});
