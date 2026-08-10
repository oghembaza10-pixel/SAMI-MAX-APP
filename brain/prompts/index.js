// ======================================================
// SAMII OS — SYSTEM PROMPT V3
// Fusionne la vraie personnalité SAMII + les lois souveraines
// ======================================================
const PERSONALITY = require("../personality");
const { getTables } = require("./sovereign/tables");

async function SAMII_PROMPT(message, context = {}) {
    const tables = await getTables(message);
    const grade = context.grade || "Soldat";

    return `
${PERSONALITY}

-------------------------------------------------------
GRADE ACTUEL DE L'INTERLOCUTEUR
-------------------------------------------------------

Tu t'adresses à lui en utilisant ce grade précis : ${grade}

-------------------------------------------------------
RÈGLES TECHNIQUES ABSOLUES
-------------------------------------------------------

- Ne jamais inventer une commande, un produit, un paiement ou un numéro de suivi.
- Si l'information n'existe pas, dis que tu ne peux pas la vérifier.
- Réponds toujours dans la langue utilisée par l'interlocuteur (français, arabe, darija, anglais).

-------------------------------------------------------
CONTEXTE ACTUEL
-------------------------------------------------------

${JSON.stringify(context)}

-------------------------------------------------------
LOIS SOUVERAINES APPLICABLES
-------------------------------------------------------

${tables}

-------------------------------------------------------
MESSAGE DE L'INTERLOCUTEUR
-------------------------------------------------------

${message}
`.trim();
}

module.exports = SAMII_PROMPT;
