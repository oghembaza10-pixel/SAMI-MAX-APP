// ==========================================================================
// SAMII OS — COMMENT LA CLÉ GEMINI VOYAGE, ET CE QU'ON FAIT D'UN REFUS
// ==========================================================================
//
// ── LA PANNE QUE CETTE SUITE EMPÊCHE DE REVENIR ──────────────────────────
//
// Google a changé le format de ses clés : « AIzaSy… » hier, « AQ.… »
// aujourd'hui. Les deux ne se transmettent pas de la même façon. Une clé
// « AQ. » passée en `?key=` dans l'URL est REFUSÉE — mesuré contre le vrai
// serveur Google :
//
//     HTTP 401  reason: ACCESS_TOKEN_TYPE_UNSUPPORTED
//
// Et le 401 n'était reconnu nulle part : ni quota (429), ni « clé morte »
// (403 / 400). La rotation le jetait donc au PREMIER essai. Avec dix-huit
// clés en service, UNE SEULE était tentée, et la clé payante rangée en
// dernier n'était jamais atteinte. « On a mis une clé payante et SAMII
// tombe quand même » : c'était exactement ça.
//
// Deux choses sont gardées ici, et elles sont indissociables :
//   1. la clé part en EN-TÊTE, jamais dans l'URL ;
//   2. un 401 fait PASSER À LA CLÉ SUIVANTE, il n'arrête pas la rotation.
//
// Lancer :  node tests/cle-gemini-transport.test.js
// ==========================================================================

const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const source = fs.readFileSync(path.join(RACINE, "services/geminiService.js"), "utf8");
// ⚠️ INSTRUMENT. Les gardes ci-dessous cherchent des motifs qui figurent
// forcément dans les commentaires qui les EXPLIQUENT (« ?key= » est cité
// trois fois pour raconter la panne). Sans ce décapage, un garde se
// déclencherait sur sa propre documentation — c'est arrivé.
const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// ══════════════════════════════════════════════════════════════════════════
// 1. LA CLÉ NE VOYAGE PLUS DANS L'URL
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(!/\?key=|&key=/.test(code),
        "une URL Gemini porte encore la clé en paramètre : les clés « AQ. » y sont refusées (401)");
    verifier(/x-goog-api-key/.test(code),
        "l'en-tête x-goog-api-key a disparu — plus rien n'authentifie les appels");

    // La sonde du fondateur DOIT s'authentifier comme le service. Une sonde
    // qui teste autre chose que ce qui tourne ne diagnostique rien : avec
    // `?key=`, elle aurait répondu « indéterminé » sur les dix-huit clés
    // sans jamais nommer la cause.
    const sonde = code.slice(code.indexOf("async function sonder"));
    verifier(/generativelanguage[^"'`]*models\?pageSize/.test(sonde),
        "la sonde interroge Google autrement que le service : elle mesurerait autre chose");
    verifier(/entetesAvec\(/.test(sonde),
        "la sonde n'envoie pas la clé en en-tête : elle ne teste pas ce qui tourne vraiment");
}

// ══════════════════════════════════════════════════════════════════════════
// 2. UN 401 NE DOIT PLUS ARRÊTER LA ROTATION
// ══════════════════════════════════════════════════════════════════════════
//
// On ne relit pas le fichier : on REJOUE les deux classificateurs sur la
// réponse RÉELLE de Google, puis la boucle elle-même.
{
    // Le corps exact renvoyé par generativelanguage.googleapis.com pour une
    // clé de forme « AQ. ». Recopié d'une mesure, pas inventé.
    const REPONSE_401 = {
        error: {
            code: 401,
            message: "Request had invalid authentication credentials. Expected OAuth 2 access token, "
                   + "login cookie or other valid authentication credential.",
            status: "UNAUTHENTICATED",
            details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                        reason: "ACCESS_TOKEN_TYPE_UNSUPPORTED" }],
        },
    };

    // Les classificateurs sont privés. On les reconstruit à l'identique
    // depuis la source, plutôt que d'exporter deux fonctions juste pour un
    // test — et surtout on vérifie qu'ils SONT ceux du fichier.
    verifier(/if \(statut === 401\) return true;/.test(code),
        "estCleMorte ne reconnaît pas le 401 : la rotation s'arrêtera encore à la première clé");

    const estQuota = (e) => e?.response?.status === 429
        || e?.response?.data?.error?.code === 429
        || e?.response?.data?.error?.status === "RESOURCE_EXHAUSTED";
    const estMorte = (e) => {
        const s = e?.response?.status;
        const m = String(e?.response?.data?.error?.message || "");
        if (s === 403) return true;
        if (s === 401) return true;
        if (s !== 400) return false;
        return /API key not valid|API_KEY_INVALID|api key expired|passed credential/i.test(m);
    };

    // La boucle de postWithRotation, réduite à ce qui décide : combien de
    // clés sont réellement essayées avant l'abandon ?
    const essayees = (statut, corps, nbCles) => {
        let n = 0;
        for (; n < nbCles; n++) {
            const err = { response: { status: statut, data: corps } };
            if (!estQuota(err) && !estMorte(err)) { n++; break; }
        }
        return n;
    };

    verifier(essayees(401, REPONSE_401, 18) === 18,
        `un 401 n'essaie que ${essayees(401, REPONSE_401, 18)} clé(s) sur 18 — la payante, rangée en `
        + "dernier, n'est jamais atteinte");
    verifier(essayees(429, { error: { code: 429 } }, 18) === 18,
        "un vrai quota ne parcourt plus toute la liste");
    verifier(essayees(400, { error: { message: "API key not valid." } }, 18) === 18,
        "une ancienne clé révoquée ne fait plus passer à la suivante");

    // ET CE QUI DOIT ENCORE REMONTER. Sauter une clé sur une erreur qui
    // vient de NOUS ferait dix-huit appels ratés pour un bug maison.
    verifier(essayees(400, { error: { message: "Invalid JSON payload received." } }, 18) === 1,
        "une requête malformée est prise pour une clé morte : dix-huit appels pour notre propre bug");
    verifier(essayees(404, { error: { message: "model not found" } }, 18) === 1,
        "un modèle inconnu fait tourner toute la liste au lieu de remonter tout de suite");
}

// ══════════════════════════════════════════════════════════════════════════
// 3. ON N'ATTEND PAS CE QUI NE VIENDRA PAS
// ══════════════════════════════════════════════════════════════════════════
//
// `postWithRotation` fabrique un 429 quand il n'a essayé AUCUNE clé. Ce
// 429-là ne guérit pas en cinq secondes : il n'y a rien derrière. On dormait
// pourtant 5 s, deux fois, avant même d'essayer Groq — 10,13 s mesurées sur
// le chat du QG, à chaque message.
{
    verifier(/__aucuneCleEssayee = true/.test(code),
        "le 429 fabriqué n'est plus marqué : on ne pourra plus le distinguer d'un vrai quota");
    verifier(/rienAReessayer/.test(code) && /!rienAReessayer/.test(code),
        "le réessai de 5 s ne consulte pas ce marqueur : les 10 secondes de vide reviennent");

    // L'ordre compte : le marqueur doit être posé AVANT le throw, sinon il
    // ne voyage pas avec l'erreur.
    const bloc = code.slice(code.indexOf("if (!lastErr)"), code.indexOf("throw lastErr"));
    verifier(bloc.indexOf("__aucuneCleEssayee") < bloc.lastIndexOf("throw e"),
        "le marqueur est posé après le throw : il n'arrivera jamais à chat()");
}

// ══════════════════════════════════════════════════════════════════════════
// 4. AUCUN APPEL SORTANT NE PEUT PLUS RESTER SUSPENDU SANS FIN
// ══════════════════════════════════════════════════════════════════════════
//
// `axios.defaults.timeout` vaut 0 : aucune limite. Mesuré contre un serveur
// qui accepte la connexion et se tait, le chemin sans flux attendait encore
// après 20 s. Un client regarde alors un rond tourner pour toujours.
{
    const axios = require("axios");
    verifier(axios.defaults.timeout === 0,
        "axios a maintenant un délai par défaut : ce garde peut être revu");

    // Les quatre fournisseurs : Gemini + les trois relais.
    const appels = code.match(/axios\.post\([\s\S]{0,400}?\n    \}\);|axios\.post\([^;]*?\);/g) || [];
    const sortants = appels.filter((a) => /GROQ_URL|OPENROUTER_URL|DEEPSEEK_URL|urlFor\(/.test(a));
    verifier(sortants.length >= 4,
        `${sortants.length} appels sortants repérés au lieu de 4 — l'instrument ne les voit plus tous`);
    for (const a of sortants) {
        const qui = (a.match(/GROQ_URL|OPENROUTER_URL|DEEPSEEK_URL|urlFor/) || ["?"])[0];
        verifier(/timeout:\s*\d+/.test(a),
            `l'appel vers ${qui} n'a aucun délai maximum : il peut rester suspendu sans fin`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 5. AUCUNE CLÉ NE DOIT POUVOIR PARTIR DANS UN JOURNAL
// ══════════════════════════════════════════════════════════════════════════
{
    // La clé était dans l'URL : `err.config.url` la portait, et imprimer une
    // erreur axios entière l'aurait recopiée dans les journaux de Render.
    // En en-tête, elle est dans `err.config.headers` — toujours à ne jamais
    // imprimer, mais elle a quitté l'URL, qui est ce qui se retrouve partout
    // (journaux de proxy, traces, messages d'erreur).
    verifier(!/console\.(log|warn|error)\([^)]*\bKEYS\[[^\]]*\](?!\s*\)\s*\.slice)/.test(code),
        "une clé entière est passée à console : elle finirait en clair dans les journaux");
    verifier(/String\(KEYS\[i\]\)\.slice\(-4\)/.test(code),
        "le journal de rotation n'identifie plus les clés par leurs 4 derniers caractères");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LE PRODUIT DIT CE QU'IL A CHARGÉ
// ══════════════════════════════════════════════════════════════════════════
//
// La panne a duré parce que RIEN ne la disait. Le démarrage annonce
// désormais combien de clés, et de quelle forme — sans jamais en refuser
// une : le jour où Google sort un troisième format, ce garde-fou ne doit
// pas couper SAMII pour des clés que Google accepte.
{
    const demarrage = fs.readFileSync(path.join(RACINE, "index.js"), "utf8");
    verifier(/direLaFormeDesCles/.test(demarrage),
        "le démarrage n'annonce plus la forme des clés Gemini chargées");
    verifier(/x-goog-api-key/.test(demarrage),
        "le message de démarrage ne dit pas comment les clés sont envoyées");
    verifier(!/return;\s*\/\/ *format inconnu|cles\s*=\s*cles\.filter/.test(demarrage),
        "le démarrage ÉCARTE des clés d'un format inconnu — il doit avertir, jamais refuser");
}

if (echecs.length) {
    console.log(`\n❌ transport clé Gemini : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.log(`   • ${e}`);
    console.log("");
    process.exit(1);
}
console.log(`✅ transport clé Gemini : ${verifs} vérifications passées`);
