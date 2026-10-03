// ==========================================================================
// SAMII OS — QUI A VRAIMENT ENVOYÉ CE WEBHOOK ?
// ==========================================================================
//
// Un webhook est une URL publique : n'importe qui sur Internet peut lui
// poster ce qu'il veut. Sans preuve d'origine, « message reçu de Meta » veut
// seulement dire « quelqu'un a tapé notre adresse ».
//
// Mesuré le 2026-10-03 sur `POST /webhook/whatsapp` : une charge utile
// fabriquée, sans aucune signature, était acceptée et traitée comme un vrai
// message Meta — numéro d'expéditeur compris. Le journal le montrait :
//
//     📩 Webhook WhatsApp reçu — format Meta/360dialog
//        ↳ message entrant, numéro 999999999
//
// Or l'expéditeur du message décide à qui part la réponse : le gestionnaire
// appelle `samii.ecrire({ to: <expéditeur> })`. Autrement dit, faire envoyer
// un WhatsApp depuis le numéro officiel vers un numéro choisi par l'appelant,
// et pousser du texte dans le moteur de conversation (crédits IA, commandes).
//
// ── DEUX PREUVES, PARCE QU'IL Y A DEUX FOURNISSEURS ───────────────────────
//
// `signatureMeta`  — Meta Cloud et 360dialog signent le corps en HMAC-SHA256
//                    avec le secret de l'application. C'est une vraie preuve
//                    cryptographique : on recalcule et on compare.
//
// `jetonPartage`   — Green API ne signe rien. Son seul moyen est un en-tête
//                    `Authorization` qu'on lui fait porter. C'est plus faible
//                    qu'une signature (le jeton voyage à chaque appel), mais
//                    c'est ce que le fournisseur permet, et c'est infiniment
//                    mieux que rien.
//
// ── ON ÉCHOUE FERMÉ, Y COMPRIS QUAND LE SECRET MANQUE ─────────────────────
//
// Si le secret n'est pas configuré, on REFUSE. C'est délibéré et c'est la
// seule posture tenable : « pas de secret donc on laisse passer » est
// exactement la valeur de repli que ce dépôt s'interdit — l'appel réussit
// alors depuis n'importe où et rien ne le signale.
//
// Le coût de ce choix est nul aujourd'hui : relevé le 2026-10-03, les trois
// connecteurs WhatsApp de production n'ont aucun jeton d'émission utilisable
// (un en mode « impression », un en mode « depannage », le Meta Cloud avec un
// token vide). Aucun trafic légitime n'est donc perdu. Le jour où l'accès
// revient, poser le secret chez Meta rouvre la voie sans toucher au code.
//
// ── POURQUOI LE CORPS BRUT, ET PAS L'OBJET DÉJÀ ANALYSÉ ───────────────────
//
// Le HMAC porte sur les OCTETS tels qu'ils sont arrivés. `JSON.parse` puis
// `JSON.stringify` ne redonne pas la même chaîne (ordre des clés, espaces,
// échappements) : la signature ne tomberait jamais juste. C'est pour ça que
// `index.js` monte `/webhook` avec `express.raw()` AVANT `express.json()`.
// Le repli sur `JSON.stringify` ci-dessous ne sert qu'aux appels internes qui
// passent un objet (les tests) : en production le corps est toujours un
// Buffer.
// ==========================================================================
const crypto = require("crypto");

function corpsBrut(req) {
    return Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body || {}), "utf8");
}

// Comparaison à temps constant. Le contrôle de longueur n'est pas une
// optimisation : `timingSafeEqual` LÈVE une exception si les deux tampons
// n'ont pas la même taille, et une exception ici serait un 500 au lieu d'un
// refus propre.
function memeValeur(recu, attendu) {
    const a = Buffer.from(String(recu), "utf8");
    const b = Buffer.from(String(attendu), "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

// ── META CLOUD / 360DIALOG ────────────────────────────────────────────────
//
// Même algorithme et mêmes messages que le garde déjà en place dans
// `routes/webhook-meta.js`. Ce fichier ne le remplace pas : le chantier du
// 2026-10-03 était borné au webhook WhatsApp, et toucher un garde qui marche
// n'en faisait pas partie. Les deux devraient converger ici — c'est une
// décision à prendre à part, pas un effet de bord.
function signatureMeta(req, secret = process.env.META_APP_SECRET || "") {
    if (!secret) return { ok: false, raison: "META_APP_SECRET n'est pas posée" };

    const entete = String(req.headers?.["x-hub-signature-256"] || "");
    if (!entete.startsWith("sha256=")) return { ok: false, raison: "en-tête de signature absent" };

    const attendue = "sha256=" + crypto.createHmac("sha256", secret)
        .update(corpsBrut(req)).digest("hex");

    if (!memeValeur(entete, attendue)) return { ok: false, raison: "signature invalide" };
    return { ok: true, par: "signature Meta" };
}

// ── GREEN API ─────────────────────────────────────────────────────────────
//
// Green API n'expose aucune signature. Il sait en revanche ajouter un en-tête
// `Authorization` à chaque livraison (son réglage « webhook token »). On
// compare ce jeton à `WHATSAPP_WEBHOOK_TOKEN`.
//
// La variable est FACULTATIVE : absente, cette voie est simplement fermée, et
// l'application démarre normalement. Elle n'a donc pas à être posée pour que
// SAMII tourne — seulement pour rouvrir l'entrée Green API.
function jetonPartage(req, attendu = process.env.WHATSAPP_WEBHOOK_TOKEN || "") {
    if (!attendu) return { ok: false, raison: "WHATSAPP_WEBHOOK_TOKEN n'est pas posée" };

    const entete = String(req.headers?.authorization || "");
    const recu = entete.startsWith("Bearer ") ? entete.slice(7) : entete;
    if (!recu) return { ok: false, raison: "en-tête Authorization absent" };

    if (!memeValeur(recu, attendu)) return { ok: false, raison: "jeton invalide" };
    return { ok: true, par: "jeton partagé" };
}

// ── LA PORTE DU WEBHOOK WHATSAPP ──────────────────────────────────────────
//
// ⚠️ ON AUTHENTIFIE AVANT DE REGARDER LA CHARGE UTILE, ET C'EST LE POINT
// IMPORTANT. La première version de cette fonction choisissait le
// vérificateur selon la FORME du message : `entry[]` → signature Meta,
// `typeWebhook` → jeton Green API. C'était une porte dérobée — il suffisait
// d'envoyer une charge en forme de Green API pour n'être jamais confronté au
// HMAC. On accepte donc l'une OU l'autre preuve, sans rien lire du corps :
// un appel sans aucune preuve est refusé, quelle que soit sa forme.
function whatsappAutorise(req) {
    const meta = signatureMeta(req);
    if (meta.ok) return meta;
    const jeton = jetonPartage(req);
    if (jeton.ok) return jeton;
    return { ok: false, raison: `${meta.raison} ; ${jeton.raison}` };
}

module.exports = { signatureMeta, jetonPartage, whatsappAutorise, corpsBrut };
