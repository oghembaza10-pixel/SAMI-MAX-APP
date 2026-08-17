// ==========================================================================
// SAMII OS — SYNTHÈSE VOCALE (Groq Orpheus, gratuit)
// ==========================================================================
// Donne une voix à SAMII pour ses propres réponses (chat QG, Entraînement
// admin) — même clé Groq que la transcription (services/transcription.js).
// Deux modèles séparés chez Groq, pas de voix française dédiée : le texte
// en écriture arabe part sur le modèle arabe, tout le reste (français,
// darija en lettres latines, anglais) sur le modèle anglais — imparfait sur
// l'accent, mais fonctionnel et gratuit.
const axios = require("axios");
const CONFIG = require("../config");

const GROQ_SPEECH_URL = "https://api.groq.com/openai/v1/audio/speech";

const MODEL_ARABE = "canopylabs/orpheus-arabic-saudi";
const VOIX_ARABE = "Aisha";

const MODEL_LATIN = "canopylabs/orpheus-v1-english";
const VOIX_LATIN = "autumn";

function contientEcritureArabe(texte) {
    return /[؀-ۿ]/.test(texte);
}

// Renvoie un Buffer audio (wav) ou null si la synthèse échoue — l'appelant
// doit toujours prévoir un repli silencieux (texte seul).
async function synthesize(texte) {
    if (!CONFIG.GROQ?.API_KEY || !texte) return null;
    try {
        const arabe = contientEcritureArabe(texte);
        const res = await axios.post(GROQ_SPEECH_URL, {
            model: arabe ? MODEL_ARABE : MODEL_LATIN,
            voice: arabe ? VOIX_ARABE : VOIX_LATIN,
            input: texte.slice(0, 1000),
            response_format: "wav",
        }, {
            headers: { "Authorization": `Bearer ${CONFIG.GROQ.API_KEY}`, "Content-Type": "application/json" },
            responseType: "arraybuffer",
        });
        return Buffer.from(res.data);
    } catch (err) {
        console.error("❌ Synthèse vocale Groq :", err.response?.data?.toString?.() || err.message);
        return null;
    }
}

module.exports = { synthesize };
