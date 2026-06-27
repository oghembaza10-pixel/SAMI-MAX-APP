const airtable = require("../airtable");
const config = require("../config");

async function ajouterAuQG(commande) {

    await airtable.createRecord(

        config.AIRTABLE.TABLES.QG,

        {

            "Type": "Commande",

            "Titre": commande.Client || "Nouvelle commande",

            "Description": `Commande ${commande["ID Commande"]}`,

            "Statut": "Nouveau",

            "Date": commande.Date

        }

    );

}

module.exports = {

    ajouterAuQG

};
