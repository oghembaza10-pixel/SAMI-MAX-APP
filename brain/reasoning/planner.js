// ======================================================
// PLANNER
// ======================================================

class Planner {

    async create(context, message) {

        return {

            objective: message,

            priority: "normal",

            steps: [

                "understand",

                "search",

                "analyse",

                "decide",

                "execute",

                "verify"

            ]

        };

    }

}

module.exports = new Planner();
