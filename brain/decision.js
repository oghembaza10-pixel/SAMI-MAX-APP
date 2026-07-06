// ======================================================
// SAMII OS
// DECISION ENGINE
// ======================================================

class SamiiDecision {

    decide(request = {}) {

        const decision = {

            useMemory: true,

            useKnowledge: true,

            useTables: true,

            useGemini: true,

            useInternet: false,

            executeAction: false,

            askConfirmation: false,

            confidence: 100,

            reason: ""

        };

        // ------------------------------------------
        // Actions sensibles
        // ------------------------------------------

        if (request.action) {

            decision.executeAction = true;

            decision.askConfirmation = true;

            decision.reason = "Action détectée.";

        }

        // ------------------------------------------
        // Internet
        // ------------------------------------------

        if (request.needInternet) {

            decision.useInternet = true;

            decision.reason = "Recherche Internet nécessaire.";

        }

        // ------------------------------------------
        // Données du QG
        // ------------------------------------------

        if (request.needQG) {

            decision.useTables = true;

            decision.reason = "Consultation des Tables FI.";

        }

        // ------------------------------------------
        // Analyse uniquement
        // ------------------------------------------

        if (request.analysisOnly) {

            decision.executeAction = false;

            decision.askConfirmation = false;

            decision.reason = "Analyse uniquement.";

        }

        return decision;

    }

}

module.exports = new SamiiDecision();
