// ==========================================================================
// SAMII OS — TRANSCRIPTION VOCALE (Groq Whisper, gratuit)
// ==========================================================================
// Transcrit une note vocale (WhatsApp, Telegram, ou upload direct depuis le
// chat QG) en texte avant de la passer au planner — même chaîne de
// conversation que pour un message texte, pas besoin de savoir taper.
const axios = require("axios");
const CONFIG = require("../config");

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
// Variante "turbo" : quasi aussi précise, nettement moins chère/plus rapide
// que whisper-large-v3 — largement suffisant pour des messages vocaux courts.
const GROQ_MODEL = "whisper-large-v3-turbo";

// Envoie l'audio (déjà en mémoire, Buffer) à Groq. Renvoie une chaîne vide
// si la transcription échoue — l'appelant doit prévoir un repli plutôt que
// de planter.
async function transcribeBuffer(buffer, filename = "audio.webm") {
    if (!CONFIG.GROQ?.API_KEY) {
        console.warn("⚠️ Transcription : clé Groq absente.");
        return "";
    }
    try {
        const blob = new Blob([buffer]);
        const form = new FormData();
        form.append("file", blob, filename);
        form.append("model", GROQ_MODEL);

        const res = await axios.post(GROQ_TRANSCRIBE_URL, form, {
            headers: { "Authorization": `Bearer ${CONFIG.GROQ.API_KEY}` },
        });
        return (res.data.text || "").trim();
    } catch (err) {
        console.error("❌ Transcription Groq :", err.response?.data || err.message);
        return "";
    }
}

// Télécharge le fichier audio (URL WhatsApp/Telegram, expire vite) puis
// délègue à transcribeBuffer.
async function transcribeFromUrl(audioUrl, filename = "audio.ogg") {
    try {
        const audioRes = await axios.get(audioUrl, { responseType: "arraybuffer" });
        return await transcribeBuffer(Buffer.from(audioRes.data), filename);
    } catch (err) {
        console.error("❌ Transcription (téléchargement) :", err.response?.data || err.message);
        return "";
    }
}

module.exports = { transcribeFromUrl, transcribeBuffer };
