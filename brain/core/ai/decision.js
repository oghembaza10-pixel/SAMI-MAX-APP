// ======================================================
// SAMII OS
// AI
// DECISION ENGINE
// ======================================================

class DecisionEngine {

    decide(context, message) {

        const text = (message || "").toLowerCase();

        // ===========================
        // Conversation
        // ===========================

        if (
            text.includes("bonjour") ||
            text.includes("salut") ||
            text.includes("hello") ||
            text.includes("salam")
        ) {

            return {
                action: "chat"
            };

        }

        // ===========================
        // Analyse
        // ===========================

        if (
            text.includes("analyse") ||
            text.includes("audit") ||
            text.includes("diagnostic")
        ) {

            return {
                action: "analyse"
            };

        }

        // ===========================
        // Publicité
        // ===========================

        if (
            text.includes("facebook") ||
            text.includes("meta") ||
            text.includes("instagram") ||
            text.includes("tiktok") ||
            text.includes("google ads")
        ) {

            return {
                action: "ads"
            };

        }

        // ===========================
        // Visuels
        // ===========================

        if (
            text.includes("logo") ||
            text.includes("image") ||
            text.includes("créatif") ||
            text.includes("visuel") ||
            text.includes("publicité")
        ) {

            return {
                action: "creative"
            };

        }

        // ===========================
        // Boutique
        // ===========================

        if (
            text.includes("commande") ||
            text.includes("shopify") ||
            text.includes("vente") ||
            text.includes("client")
        ) {

            return {
                action: "commerce"
            };

        }

        // ===========================
        // QG
        // ===========================

        if (
            text.includes("qg") ||
            text.includes("module") ||
            text.includes("dashboard")
        ) {

            return {
                action: "qg"
            };

        }

        // ===========================
        // Défaut
        // ===========================

        return {

            action: "chat"

        };

    }

}

module.exports = new DecisionEngine();
