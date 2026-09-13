// ==========================================================================
// SAMII OS — CHARGILY PAY (paiement en ligne réel — Edahabia / CIB)
// API vérifiée sur https://github.com/Chargily/chargily-pay-javascript
// (base URL, endpoint /checkouts, auth Bearer, signature HMAC-SHA256).
// ==========================================================================
const axios  = require("axios");
const crypto = require("crypto");
const CONFIG = require("../config");

const BASE_URL = CONFIG.CHARGILY.MODE === "live"
    ? "https://pay.chargily.net/api/v2"
    : "https://pay.chargily.net/test/api/v2";

function isEnabled() {
    return Boolean(CONFIG.CHARGILY.API_KEY);
}

function headers() {
    return {
        Authorization: `Bearer ${CONFIG.CHARGILY.API_KEY}`,
        "Content-Type": "application/json",
    };
}

// Crée une session de paiement pour un montant réel de commande (jamais un
// produit/prix pré-créé côté Chargily — nos montants changent à chaque
// commande, donc on utilise amount+currency plutôt que items/price_id).
async function createCheckout({ amount, currency = "dzd", successUrl, failureUrl, webhookUrl, description, metadata }) {
    if (!isEnabled()) return { success: false, error: "Chargily non configuré (clé API manquante)." };
    try {
        const { data } = await axios.post(`${BASE_URL}/checkouts`, {
            amount,
            currency,
            success_url: successUrl,
            failure_url: failureUrl,
            // webhook_url fait planter l'appel entier ("Unknown parameter") —
            // seul webhook_endpoint est un paramètre valide de l'API Chargily.
            webhook_endpoint: webhookUrl,
            description,
            metadata,
        }, { headers: headers() });
        return { success: true, checkoutId: data.id, checkoutUrl: data.checkout_url };
    } catch (err) {
        console.error("❌ Chargily createCheckout :", err.response?.data || err.message);
        return { success: false, error: err.response?.data?.message || err.message };
    }
}

// ── UNE PANNE N'EST PAS UNE RÉPONSE ──────────────────────────────────────
//
// Erreur TECHNIQUE : on n'a pas pu savoir. Réseau coupé, délai dépassé, API
// de Chargily en carafe, clé refusée. Elle se distingue par ce marqueur, et
// elle REMONTE — c'est la seule façon pour le webhook de répondre 500 et
// d'obtenir un rejeu.
class ErreurTechniqueChargily extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "ErreurTechniqueChargily";
        this.technique = true;
        this.cause = cause;
    }
}

// Un appel qui n'a pas abouti est-il une panne, ou une réponse ?
//
//   404  → Chargily a répondu, et sa réponse est « ce paiement n'existe
//          pas ». C'est un fait métier, pas une panne : rejouer le webhook
//          donnerait éternellement le même 404.
//   Tout le reste → on n'a PAS de réponse exploitable. 401 et 403 (clé
//          invalide ou révoquée), 429, 5xx, et l'absence pure de réponse
//          (ECONNREFUSED, ETIMEDOUT, ENOTFOUND, ECONNRESET, abandon).
//          Dans tous ces cas on ignore si le client a payé.
function estPanne(err) {
    const code = err?.response?.status;
    if (code === 404) return false;      // une réponse, pas une panne
    return true;                          // y compris : aucune réponse du tout
}

// Relit le statut réel d'un checkout directement chez Chargily — on ne fait
// jamais confiance au seul contenu du webhook pour marquer une commande payée.
//
// ── POURQUOI CETTE FONCTION NE RENVOIE PLUS null SUR UNE PANNE ───────────
//
// Elle avalait TOUTE erreur et renvoyait `null`. Ce `null` voulait donc dire
// deux choses incompatibles : « ce paiement n'est pas confirmé » et « je n'ai
// pas réussi à joindre Chargily ». Les appelants ne pouvaient pas les
// distinguer, et traitaient les deux comme le premier.
//
// Mesuré sur l'application qui tourne : quatre appels réseau en échec
// (« request blocked … pay.chargily.net ») et le webhook répondait quand même
// HTTP 200. Or 200 signifie « c'est traité » : Chargily ne rejoue jamais. Un
// paiement réellement encaissé pendant une panne réseau restait donc à
// jamais non crédité, sans erreur, sans trace, sans rattrapage possible.
//
// Désormais : une panne LÈVE. Le webhook la voit, répond 500, Chargily
// rejoue. Le rejeu est sans danger — chaque confirmateur ne prend que si le
// statut n'est pas déjà final.
async function getCheckout(checkoutId) {
    if (!isEnabled() || !checkoutId) return null;
    try {
        const { data } = await axios.get(`${BASE_URL}/checkouts/${checkoutId}`, {
            headers: headers(),
            // Sans délai maximum, une connexion qui reste ouverte sans jamais
            // répondre bloque le webhook indéfiniment — et Chargily, lui,
            // abandonne de son côté. On préfère échouer vite et être rejoué.
            timeout: 15000,
        });
        return data;
    } catch (err) {
        const detail = err.response?.data || err.message;
        if (estPanne(err)) {
            console.error(`❌ Chargily getCheckout (PANNE, on demandera un rejeu) : ${JSON.stringify(detail)}`);
            throw new ErreurTechniqueChargily(
                `Chargily injoignable pour le checkout ${checkoutId} : ${err.message}`, err);
        }
        // 404 : une vraie réponse. Rien à confirmer, rien à rejouer.
        console.warn(`⚠️ Chargily getCheckout : checkout ${checkoutId} introuvable (404).`);
        return null;
    }
}

// Vérifie la signature HMAC-SHA256 d'un webhook entrant (payload = Buffer brut,
// header "signature"), avec comparaison en temps constant.
function verifySignature(payload, signature) {
    if (!signature || !CONFIG.CHARGILY.API_KEY || !payload) return false;
    try {
        const computed = crypto.createHmac("sha256", CONFIG.CHARGILY.API_KEY).update(payload).digest("hex");
        const a = Buffer.from(computed, "utf8");
        const b = Buffer.from(signature, "utf8");
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

module.exports = {
    isEnabled, createCheckout, getCheckout, verifySignature,
    // Exportés pour que le webhook et les tests puissent nommer la panne au
    // lieu de la deviner sur le texte du message.
    ErreurTechniqueChargily, estPanne,
};
