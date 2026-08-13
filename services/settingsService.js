// services/settingsService.js
// Réglages de boutique (statut actif/inactif, palier d'abonnement) — écrivait
// auparavant dans une table Airtable "BOUTIQUES" séparée de la vraie source
// (workspaces, Postgres). Réutilise les services déjà en place plutôt que de
// dupliquer les requêtes SQL.
const workspaceService = require("./workspaceService");
const abonnementService = require("./abonnementService");

async function createDefault(shop) {
    console.log(`⚙️ Settings créés : ${shop}`);
    await workspaceService.update(shop, { statut: "actif" });
    await abonnementService.retrograderVersFree(shop);
}

async function deactivate(shop) {
    console.log(`⚙️ Settings désactivés : ${shop}`);
    await workspaceService.update(shop, { statut: "inactif" });
}

async function downgrade(shop) {
    console.log(`⚙️ Downgrade : ${shop}`);
    await abonnementService.retrograderVersFree(shop);
}

module.exports = { createDefault, deactivate, downgrade };
