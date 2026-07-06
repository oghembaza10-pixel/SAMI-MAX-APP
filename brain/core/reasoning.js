// ======================================================
// SAMII OS
// CORE
// REASONING ENGINE
// ======================================================

class SamiiReasoning {

    analyze(input = {}) {

        return {

            objective: this.detectObjective(input),

            urgency: this.detectUrgency(input),

            emotion: this.detectEmotion(input),

            complexity: this.detectComplexity(input),

            requiresAction: this.requiresAction(input),

            confidence: 100

        };

    }

    detectObjective(input) {

        const message = (input.message || "").toLowerCase();

        if (message.includes("vendre"))
            return "sales";

        if (message.includes("publicité"))
            return "marketing";

        if (message.includes("shopify"))
            return "shopify";

        if (message.includes("meta"))
            return "meta";

        if (message.includes("tiktok"))
            return "tiktok";

        if (message.includes("analyse"))
            return "analysis";

        return "conversation";

    }

    detectUrgency(input) {

        const msg = (input.message || "").toLowerCase();

        if (
            msg.includes("urgent") ||
            msg.includes("vite") ||
            msg.includes("immédiatement")
        ) {

            return "high";

        }

        return "normal";

    }

    detectEmotion(input) {

        return "neutral";

    }

    detectComplexity(input) {

        const words = (input.message || "").split(" ");

        if (words.length > 40)
            return "high";

        if (words.length > 15)
            return "medium";

        return "low";

    }

    requiresAction(input) {

        const msg = (input.message || "").toLowerCase();

        const actions = [

            "créer",

            "supprimer",

            "modifier",

            "publier",

            "envoyer",

            "lancer",

            "connecter"

        ];

        return actions.some(a => msg.includes(a));

    }

}

module.exports = new SamiiReasoning();
