/**
 * ============================================================
 * OG • Gemini Service
 * ============================================================
 */

class GeminiService {

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
            provider: "Gemini",
            prompt,
            response: null
        };

    }

}

module.exports = new GeminiService();
