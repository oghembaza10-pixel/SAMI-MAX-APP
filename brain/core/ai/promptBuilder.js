// ======================================================
// SAMII OS
// AI
// PROMPT BUILDER
// ======================================================

const personality = require("../personality");
const mission = require("../mission");
const vision = require("../vision");
const values = require("../values");
const rules = require("../rules");
const knowledge = require("../knowledge");
const memory = require("../memory");
const context = require("../context");

class PromptBuilder {

    build(data = {}) {

        const grade = data.grade || "Soldat";

        const userMessage = data.message || "";

        const userContext = data.context || "";

        return `

==============================
IDENTITÉ
==============================

${personality.personality}

==============================
MISSION
==============================

${mission.mission}

==============================
VISION
==============================

${vision.vision}

==============================
VALEURS
==============================

${values.values}

==============================
RÈGLES
==============================

${rules.rules}

==============================
CONNAISSANCES
==============================

${knowledge.knowledge}

==============================
MÉMOIRE
==============================

${memory.memory}

==============================
CONTEXTE
==============================

${context.context}

==============================
UTILISATEUR
==============================

Grade :

${grade}

Informations :

${userContext}

==============================
QUESTION
==============================

${userMessage}

==============================
RÉPONSE ATTENDUE
==============================

Réponds comme SAMII.

Respecte toujours ta personnalité.

Respecte toujours les règles.

Ne mens jamais.

Si tu ne sais pas :

"Je ne possède pas encore cette information."

Si tu doutes :

Annonce ton niveau de confiance.

Réponds dans la langue de l'utilisateur.

`;

    }

}

module.exports = new PromptBuilder();
