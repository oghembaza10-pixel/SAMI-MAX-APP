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

// Trois clés déclarées comme sur Render : la principale, puis deux secours.
process.env.GEMINI_API_KEY   = "cle-principale";
process.env.GEMINI_API_KEY_2 = "cle-secours-2";
process.env.GEMINI_API_KEY_3 = "cle-secours-3";

// Ce que l'API a répondu, et à quelle clé. On fabrique les erreurs à la
// main : ce sont les FORMES d'erreur qui comptent, pas le réseau.
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
    verifier(CONFIG.GEMINI.API_KEYS.length === 3,
        `${CONFIG.GEMINI.API_KEYS.length} clé(s) détectée(s) au lieu de 3 — une clé posée sous un nom que le code ne lit pas ne sert à rien`);
    verifier(CONFIG.GEMINI.API_KEYS[0] === "cle-principale",
        "la clé principale n'est plus essayée en premier — le gratuit doit s'épuiser AVANT qu'on passe sur la suivante");

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

        verifier(APPELS.includes("cle-secours-2"),
            `${description} : SAMII n'essaie PAS la clé de secours — elle est posée sur Render et ne sert jamais`);
        verifier(APPELS[0] === "cle-principale",
            `${description} : la clé principale n'a pas été essayée en premier`);
    }

    // ── 3. Une erreur qui n'est PAS un quota ne brûle pas les clés ───────
    //
    // Une clé révoquée, un modèle mal orthographié, un corps de requête
    // invalide : rejouer sur les autres clés ne corrigerait rien et ferait
    // trois appels ratés au lieu d'un. Pire, ça masquerait la vraie cause
    // derrière une erreur de quota qui n'existe pas.
    APPELS.length = 0;
    reponses = [erreur({ status: 400, data: { error: { code: 400, message: "API key not valid" } } })];
    try { await gemini.chat({ message: "bonjour", useTools: false }); } catch { /* attendu */ }
    verifier(!APPELS.includes("cle-secours-2"),
        "une erreur qui n'est pas un quota (clé invalide, requête malformée) fait quand même tourner toutes les clés");

    // ── 4. Toutes les clés sont essayées avant d'abandonner ─────────────
    APPELS.length = 0;
    reponses = [
        erreur({ status: 429 }),
        erreur({ status: 429 }),
        { data: { candidates: [{ content: { parts: [{ text: "ok" }] } }] } },
    ];
    try { await gemini.chat({ message: "bonjour", useTools: false }); } catch { /* peu importe */ }
    verifier(APPELS.includes("cle-secours-3"),
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
