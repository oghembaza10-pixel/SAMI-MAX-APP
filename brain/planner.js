// ======================================================
// SAMII OS — PLANNER V3 (exécute de vraies actions)
// ======================================================
const gemini = require("../services/geminiService");
const commerceEngine = require("../engines/commerceEngine");

class SamiiPlanner {
    async executeFunction(name, args) {
        switch (name) {
            case "confirmer_commande":
                return await commerceEngine.confirmTelegramOrder({ payload: { orderId: args.orderId } });

            case "annuler_commande":
                return await commerceEngine.cancelTelegramOrder({ payload: { orderId: args.orderId } });

            default:
                return { success: false, error: `Fonction inconnue : ${name}` };
        }
    }

    async ask(message, context = {}, history = []) {
        try {
            const useTools = context.allowActions !== false;
            const result = await gemini.chat({ message, context, useTools, history });

            if (result.type === "function_call") {
                console.log(`⚙️ SAMII exécute : ${result.name}`, result.args);
                const functionResult = await this.executeFunction(result.name, result.args);

                const finalReply = await gemini.chatWithFunctionResult({
                    message,
                    context,
                    functionName: result.name,
                    functionArgs: result.args,
                    functionResult,
                });
                return finalReply;
            }

            return result.text;

        } catch (err) {
            console.error("❌ Planner.ask :", err.message);
            return "SAMII est momentanément indisponible. Réessaie dans quelques instants.";
        }
    }

    async build(objective = {}, context = {}, history = []) {
        if (objective.goal) {
            const reply = await this.ask(objective.goal, context, history);
            return { success: true, reply };
        }
        return { success: false, reply: "Objectif manquant." };
    }
}

module.exports = new SamiiPlanner();
