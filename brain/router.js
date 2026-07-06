// ======================================================
// SAMII OS
// ROUTER V1
// ======================================================

const personality = require("./personality");
const memory = require("./memory");
const knowledge = require("./knowledge");
const context = require("./context");
const rules = require("./rules");
const engine = require("./engine");

class SamiiRouter {

    async prepare(userMessage, user = {}) {

        const profile = personality.getPersonality();

        const memories = await memory.load(user.id);

        const userContext = await context.build(user);

        const knowledgeBase = await knowledge.load();

        const systemRules = rules.getRules();

        const result = await engine.execute(userMessage, {

            user,
            profile,
            memories,
            userContext,
            knowledgeBase,
            systemRules

        });

        return result;

    }

}

module.exports = new SamiiRouter();
