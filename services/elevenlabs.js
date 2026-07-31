// ==========================================================================
// SAMII OS — ELEVENLABS — Voix IA pour SAMII (désactivé tant que pas de clé)
// ==========================================================================
const axios = require("axios");
const CONFIG = require("../config");

// Voix par défaut recommandée pour un ton calme et professionnel (à ajuster
// une fois la clé active, en écoutant les voix disponibles sur ElevenLabs).
const DEFAULT_VOICE_ID = CONFIG.ELEVENLABS?.VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const API_URL = (voiceId) => `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

function isEnabled() {
    return !!CONFIG.ELEVENLABS?.API_KEY;
}

/**
 * Génère un fichier audio (MP3, en base64) à partir d'un texte.
 * Retourne { success: false } proprement si la clé n'est pas encore configurée,
 * pour que l'appelant puisse basculer sur la voix native du navigateur.
 */
async function textToSpeech(text, voiceId = DEFAULT_VOICE_ID) {
    if (!isEnabled()) {
        return { success: false, error: "ElevenLabs non configuré (clé API absente)." };
    }
    if (!text || !text.trim()) {
        return { success: false, error: "Texte vide." };
    }

    try {
        const response = await axios.post(
            API_URL(voiceId),
            {
                text: text.trim(),
                model_id: "eleven_multilingual_v2", // supporte français/arabe/anglais
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                },
            },
            {
                headers: {
                    "xi-api-key": CONFIG.ELEVENLABS.API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                responseType: "arraybuffer",
            }
        );

        const audioBase64 = Buffer.from(response.data).toString("base64");
        return {
            success: true,
            audio: `data:audio/mpeg;base64,${audioBase64}`,
        };
    } catch (err) {
        console.error("❌ ElevenLabs :", err.response?.data || err.message);
        return { success: false, error: "Erreur génération vocale." };
    }
}

module.exports = { isEnabled, textToSpeech };
