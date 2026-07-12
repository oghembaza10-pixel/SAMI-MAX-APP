const identity      = require("./identity");
const mission       = require("./mission");
const sovereignty   = require("./sovereignty");
const protocols     = require("./protocols");
const reasoning     = require("./reasoning");
const execution     = require("./execution");
const communication = require("./communication");
const languages     = require("./languages");
const security      = require("./security");
const knowledge     = require("./knowledge");
const output        = require("./output");
const memory        = require("./memory");
const context       = require("./context");
const qg            = require("./qg");
const { getTables } = require("../sovereign/tables");

module.exports = (message, ctx = {}) => `
${identity}
${mission}
${sovereignty}
${protocols}
${reasoning}
${execution}
${communication}
${languages}
${security}
${knowledge}
${memory(ctx)}
${context(ctx)}
${qg}

================================================================
LOIS ACTIVES POUR CETTE QUESTION
================================================================
${getTables(message)}

${output}

================================================================
QUESTION : ${message}
================================================================
`;

