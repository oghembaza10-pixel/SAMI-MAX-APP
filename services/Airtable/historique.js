const airtable = require("./client");
const config = require("../../config");

async function create(data) {
    return airtable.createRecord(config.AIRTABLE.TABLES.HISTORIQUE, data);
}

async function update(id, data) {
    return airtable.updateRecord(config.AIRTABLE.TABLES.HISTORIQUE, id, data);
}

async function remove(id, data) {
    return airtable.deleteRecord(config.AIRTABLE.TABLES.HISTORIQUE, id);
}

module.exports = { create, update, remove };
