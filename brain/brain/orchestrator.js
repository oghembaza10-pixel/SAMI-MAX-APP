// ======================================================
// SAMII OS
// ORCHESTRATOR
// ======================================================

const router = require("./router");
const decision = require("./decision");
const planner = require("./planner");
const actions = require("./actions");

class SamiiOrchestrator {

    async execute(userMessage, user = {}) {

        // 1. Préparer toutes les informations
        const data = await router.prepare(userMessage, user);

        // 2. Prendre une décision
        const choice = decision.decide(data);

        // 3. Construire un plan
        const plan = await planner.build({

            goal: userMessage

        }, data);

        // 4. Exécuter une action si nécessaire
        let actionResult = null;

        if (choice.executeAction && data.action) {

            actionResult = await actions.execute(

                data.action,

                data.payload || {}

            );

        }

        return {

            router: data,

            decision: choice,

            planner: plan,

            action: actionResult

        };

    }

}

module.exports = new SamiiOrchestrator();
