// ======================================================
// SAMII OS
// ENGINE V1
// ======================================================

const buildPrompt = require("./prompts");

class SamiiEngine {

    async execute(userMessage, options = {}) {

        const prompt = buildPrompt(userMessage);

        return {

            prompt,

            language: options.language || "auto",

            confidence: 100,

            needMemory: true,

            needKnowledge: true,

            needTables: true,

            needInternet: false,

            needAction: false,

            action: null

        };

    }

}

module.exports = new SamiiEngine();
