// ======================================================
// SAMII OS
// AI
// CONFIDENCE ENGINE
// ======================================================

class ConfidenceEngine {

    calculate(data = {}) {

        let confidence = 100;

        // Réponse provenant uniquement du LLM
        if (data.source === "llm")
            confidence -= 20;

        // Mémoire disponible
        if (!data.memory)
            confidence -= 10;

        // Connaissances internes
        if (!data.knowledge)
            confidence -= 10;

        // API connectée
        if (!data.api)
            confidence -= 15;

        // Données temps réel
        if (!data.realtime)
            confidence -= 15;

        // Information officielle
        if (data.official)
            confidence += 10;

        // Limites
        confidence = Math.max(0, Math.min(100, confidence));

        return confidence;

    }

    buildMessage(confidence) {

        if (confidence >= 95)
            return "Confiance : 95-100%";

        if (confidence >= 80)
            return "Confiance élevée.";

        if (confidence >= 60)
            return "Je suis confiant à environ " + confidence + "%.";

        if (confidence >= 40)
            return "Je ne suis pas totalement certain. Je recommande une vérification.";

        return "Je ne possède pas suffisamment d'informations fiables. Je préfère me renseigner avant de répondre.";

    }

}

module.exports = new ConfidenceEngine();
