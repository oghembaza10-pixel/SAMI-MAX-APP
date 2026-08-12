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
            // Le nom exact du champ varie selon les sources de doc Chargily
            // (webhook_endpoint vs webhook_url) — on envoie les deux, l'API
            // ignore simplement le champ qu'elle ne reconnaît pas. Le webhook
            // global configuré dans le dashboard Chargily reste le filet de
            // sécurité principal si aucun des deux n'est pris en compte.
            webhook_endpoint: webhookUrl,
            webhook_url: webhookUrl,
            description,
            metadata,
        }, { headers: headers() });
        return { success: true, checkoutId: data.id, checkoutUrl: data.checkout_url };
    } catch (err) {
        console.error("❌ Chargily createCheckout :", err.response?.data || err.message);
        return { success: false, error: err.response?.data?.message || err.message };
    }
}

// Relit le statut réel d'un checkout directement chez Chargily — on ne fait
// jamais confiance au seul contenu du webhook pour marquer une commande payée.
async function getCheckout(checkoutId) {
    if (!isEnabled() || !checkoutId) return null;
    try {
        const { data } = await axios.get(`${BASE_URL}/checkouts/${checkoutId}`, { headers: headers() });
        return data;
    } catch (err) {
        console.error("❌ Chargily getCheckout :", err.response?.data || err.message);
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

module.exports = { isEnabled, createCheckout, getCheckout, verifySignature };
