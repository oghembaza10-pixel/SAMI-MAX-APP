// ======================================================
// SAMII OS
// AI
// CORE
// Cerveau principal
// ======================================================

const context = require("./context");
const router = require("./router");
const confidence = require("./confidence");
const language = require("./language");

class SamiiCore {

    async process(user, message) {

        // Construire le contexte
        const ctx = context.build(user);

        // Détection langue
        const lang = language.instruction(ctx);

        // Choix du moteur
        const destination = await router.route(ctx, message);

        // Niveau de confiance
        const trust = confidence.calculate({
            source: "llm",
            memory: true,
            knowledge: true
        });

        return {

            context: ctx,

            language: lang,

            route: destination,

            confidence: trust,

            confidenceText: confidence.buildMessage(trust)

        };

    }

}

module.exports = new SamiiCore();
