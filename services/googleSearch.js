// ==========================================================================
// SAMII OS — RECHERCHE GOOGLE CIBLÉE (Custom Search API)
// Moteur de recherche personnalisé du fondateur, restreint à TikTok/Meta/
// LinkedIn — vient compléter la recherche web générale (Gemini grounding,
// déjà utilisée par Radar Opportunités / Œil Concurrentiel / Radar Prospects)
// avec des résultats plus précis sur ces plateformes précises.
// ==========================================================================
const axios = require("axios");
const CONFIG = require("../config");

const SEARCH_URL = "https://www.googleapis.com/customsearch/v1";

// Renvoie toujours un tableau (vide si non configuré ou en erreur) — jamais
// d'exception : cette recherche vient seulement enrichir un prompt IA,
// jamais bloquer la fonctionnalité qui l'appelle.
async function search(query, num = 5) {
    if (!CONFIG.GOOGLE?.API_KEY || !CONFIG.GOOGLE?.SEARCH_CX || !query) return [];
    try {
        const res = await axios.get(SEARCH_URL, {
            params: {
                key: CONFIG.GOOGLE.API_KEY,
                cx: CONFIG.GOOGLE.SEARCH_CX,
                q: query,
                num: Math.min(num, 10),
            },
        });
        return (res.data.items || []).map(item => ({
            title: item.title || "",
            link: item.link || "",
            snippet: item.snippet || "",
        }));
    } catch (err) {
        console.error("❌ googleSearch.search :", err.response?.data?.error?.message || err.message);
        return [];
    }
}

module.exports = { search };
