// ======================================================
// SAMII OS
// AI
// ROUTER
// ======================================================

const decision = require("./decision");

class AIRouter {

    async route(context, message) {

        const result = decision.decide(context, message);

        switch (result.action) {

            case "analyse":

                return {
                    module: "analysis",
                    action: "analyse"
                };

            case "commerce":

                return {
                    module: "commerce",
                    action: "commerce"
                };

            case "creative":

                return {
                    module: "creative",
                    action: "creative"
                };

            case "ads":

                return {
                    module: "ads",
                    action: "ads"
                };

            case "qg":

                return {
                    module: "qg",
                    action: "dashboard"
                };

            default:

                return {
                    module: "chat",
                    action: "reply"
                };

        }

    }

}

module.exports = new AIRouter();
