const identity     = require("./identity");
const mission      = require("./mission");
const sovereignty  = require("./sovereignty");
const laws         = require("./laws");
const protocols    = require("./protocols");
const reasoning    = require("./reasoning");
const execution    = require("./execution");
const communication= require("./communication");
const languages    = require("./languages");
const security     = require("./security");
const knowledge    = require("./knowledge");
const memory       = require("./memory");
const context      = require("./context");
const qg           = require("./qg");
const output       = require("./output");

module.exports = (message, ctx = {}) => `
${identity}
${mission}
${sovereignty}
${laws}
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
${output}

================================================================
QUESTION : ${message}
================================================================
`;
