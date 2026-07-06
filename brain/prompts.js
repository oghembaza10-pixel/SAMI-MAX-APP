// ======================================================
// SAMII OS
// PROMPT BUILDER
// ======================================================

const personality = require("./personality");
const rules = require("./rules");
const knowledge = require("./knowledge");
const memory = require("./memory");
const context = require("./context");

function buildPrompt(userMessage) {

    return `

${personality}

${rules}

${knowledge}

${memory}

${context}

-------------------------------------------------------
MISSION ACTUELLE
-------------------------------------------------------

Analyse la situation.

Réfléchis.

Utilise uniquement les informations fiables.

Si tu doutes, indique ton niveau de confiance.

Réponds dans la langue de l'utilisateur.

Ne fais jamais de longues réponses inutilement.

-------------------------------------------------------
MESSAGE UTILISATEUR
-------------------------------------------------------

${userMessage}

`;

}

module.exports = buildPrompt;
