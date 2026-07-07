const airtable = require("./client");
const config = require("../../config");

async function create(data) {
    return airtable.createRecord(config.AIRTABLE.TABLES.STOCK, data);
}

async function update(id, data) {
    return airtable.updateRecord(config.AIRTABLE.TABLES.STOCK, id, data);
}

async function remove(id) {
    return airtable.deleteRecord(config.AIRTABLE.TABLES.STOCK, id);
}

module.exports = { create, update, remove };
