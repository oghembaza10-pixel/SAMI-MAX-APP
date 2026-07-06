// ======================================================
// SAMII OS
// AI
// LANGUAGE ENGINE
// ======================================================

class LanguageEngine {

    constructor() {

        this.languages = {

            fr: {
                name: "Français",
                locale: "fr-FR"
            },

            en: {
                name: "English",
                locale: "en-US"
            },

            ar: {
                name: "العربية",
                locale: "ar"
            }

        };

        this.dialects = {

            dz: {
                name: "Darija Algérienne",
                country: "Algérie"
            },

            ma: {
                name: "Darija Marocaine",
                country: "Maroc"
            },

            tn: {
                name: "Derja Tunisienne",
                country: "Tunisie"
            },

            ly: {
                name: "Libyen",
                country: "Libye"
            },

            eg: {
                name: "Égyptien",
                country: "Égypte"
            }

        };

    }

    detect(user = {}) {

        return {

            language: user.language || "fr",

            dialect: user.dialect || null

        };

    }

    instruction(user = {}) {

        const lang = this.detect(user);

        let prompt = "";

        switch (lang.language) {

            case "ar":

                prompt += "Réponds en arabe.";

                break;

            case "en":

                prompt += "Reply in English.";

                break;

            default:

                prompt += "Réponds en français.";

        }

        if (lang.dialect === "dz")
            prompt += " Utilise naturellement la darija algérienne si l'utilisateur l'utilise.";

        if (lang.dialect === "ma")
            prompt += " Utilise naturellement la darija marocaine si l'utilisateur l'utilise.";

        if (lang.dialect === "tn")
            prompt += " Utilise naturellement la derja tunisienne si l'utilisateur l'utilise.";

        if (lang.dialect === "ly")
            prompt += " Utilise naturellement le dialecte libyen si l'utilisateur l'utilise.";

        if (lang.dialect === "eg")
            prompt += " Utilise naturellement le dialecte égyptien si l'utilisateur l'utilise.";

        return prompt;

    }

}

module.exports = new LanguageEngine();
