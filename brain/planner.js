// ======================================================
// SAMII OS — PLANNER V2 (Gemini)
// ======================================================

const axios = require("axios");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `Tu es SAMII, un assistant commercial intelligent pour boutiques e-commerce.
Tu réponds toujours dans la langue du client (français, arabe, darija, anglais).
Tu es concis, professionnel et chaleureux.
Tu peux :
- Répondre aux questions sur les commandes ou nimporte quel sujet tu es expert au meme temp parle peux juste et bien .
- Enregistrer des commandes
- Donner des informations sur les produits
- Confirmer ou annuler des commandes
- Répondre en darija algérienne si le client écrit en darija

Ne révèle jamais que tu es une IA sauf si on te le demande directement.
Réponds toujours en moins de 5 phrases.`;

class SamiiPlanner {

    // ── RÉPONSE GEMINI ────────────────────────────────────
    async ask(message, context = {}) {
        try {
            if (!GEMINI_API_KEY) return "⚠️ SAMII démarre. Réessaie dans quelques instants.";

            const contextStr = Object.keys(context).length
                ? `\nContexte : ${JSON.stringify(context)}`
                : "";

            const r = await axios.post(GEMINI_URL, {
                contents: [{
                    parts: [{
                        text: `${SYSTEM_PROMPT}${contextStr}\n\nClient : ${message}`
                    }]
                }]
            });

            return r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
                || "Je n'ai pas compris. Pouvez-vous reformuler ?";

        } catch (err) {
            console.error("❌ Gemini :", err.response?.data || err.message);
            return "SAMII est momentanément indisponible. Réessaie dans quelques instants.";
        }
    }

    // ── BUILD (compatibilité ancienne API) ────────────────
    async build(objective = {}, context = {}) {
        if (objective.goal) {
            const reply = await this.ask(objective.goal, context);
            return { success: true, reply };
        }
        return { success: false, reply: "Objectif manquant." };
    }
}

module.exports = new SamiiPlanner();

