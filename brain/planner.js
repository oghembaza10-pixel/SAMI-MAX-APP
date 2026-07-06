// ======================================================
// SAMII OS
// PLANNER
// ======================================================

class SamiiPlanner {

    async build(objective = {}, context = {}) {

        const plan = {

            goal: objective.goal || null,

            priority: "normal",

            steps: [],

            modules: [],

            actions: [],

            risks: [],

            opportunities: [],

            estimatedTime: null

        };

        // ---------------------------------
        // Objectif détecté
        // ---------------------------------

        if (objective.goal) {

            plan.steps.push("Analyser l'objectif.");

            plan.steps.push("Analyser les données du QG.");

            plan.steps.push("Identifier les ressources disponibles.");

            plan.steps.push("Construire une stratégie.");

            plan.steps.push("Proposer un plan d'exécution.");

        }

        // ---------------------------------
        // APIs disponibles
        // ---------------------------------

        if (context.shopify)
            plan.modules.push("SHOPIFY");

        if (context.meta)
            plan.modules.push("META");

        if (context.whatsapp)
            plan.modules.push("WHATSAPP");

        if (context.airtable)
            plan.modules.push("AIRTABLE");

        if (context.tiktok)
            plan.modules.push("TIKTOK");

        // ---------------------------------
        // Opportunités
        // ---------------------------------

        if (context.shopify && context.meta) {

            plan.opportunities.push(
                "Créer automatiquement une campagne publicitaire."
            );

        }

        return plan;

    }

}

module.exports = new SamiiPlanner();
