// ======================================================
// SAMII OS — PLANNER V2
// ======================================================

const gemini = require("../services/geminiService");

class SamiiPlanner {

    // ── RÉPONSE GEMINI ────────────────────────────────────
    async ask(message, context = {}) {
        try {
            return await gemini.chat({ message, context });
        } catch (err) {
            console.error("❌ Planner.ask :", err.message);
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
