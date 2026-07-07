const airtable = require("./client");
const config = require("../../config");

async function create(data) {
    return airtable.createRecord(config.AIRTABLE.TABLES.LIVRAISONS, data);
}

async function update(id, data) {
    return airtable.updateRecord(config.AIRTABLE.TABLES.LIVRAISONS, id, data);
}

async function remove(id) {
    return airtable.deleteRecord(config.AIRTABLE.TABLES.LIVRAISONS, id);
}

module.exports = { create, update, remove };
