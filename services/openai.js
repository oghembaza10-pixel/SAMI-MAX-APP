/**
 * ============================================================
 * OG • OpenAI Service
 * ============================================================
 */

class OpenAIService {

    constructor() {
        this.connected = false;
    }

    async connect(apiKey) {
        this.connected = true;
        return true;
    }

    async generate(prompt) {

        return {
            success: true,
            provider: "OpenAI",
            prompt,
            response: null
        };

    }

}

module.exports = new OpenAIService();
