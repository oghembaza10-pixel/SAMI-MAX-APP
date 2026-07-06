// ======================================================
// SAMII OS
// REASONING ENGINE
// ======================================================

const planner = require("./planner");
const observer = require("./observer");
const validator = require("./validator");

class ReasoningEngine {

    async think(context, message) {

        const plan = await planner.create(context, message);

        const validation = validator.check(plan);

        return {

            valid: validation,

            plan,

            observation: observer.snapshot(context)

        };

    }

}

module.exports = new ReasoningEngine();
