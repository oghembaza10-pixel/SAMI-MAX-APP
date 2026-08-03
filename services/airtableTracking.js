// ==========================================================================
// SAMII OS — Airtable Tracking Bridge (Zéro usine à gaz)
// ==========================================================================
const Airtable = require('airtable');

// Initialisation de la connexion Airtable avec tes variables d'environnement
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const TABLE_NAME = process.env.AIRTABLE_SHIPMENTS_TABLE || 'Shipments';

/**
 * Enregistre ou met à jour un colis et son numéro de suivi dans Airtable
 */
async function saveOrUpdateTracking({ orderId, trackingNumber, provider, status, destination, customerName }) {
    try {
        // Recherche si le colis existe déjà par son numéro de suivi ou orderId
        const records = await base(TABLE_NAME).select({
            filterByFormula: `{TrackingNumber} = '${trackingNumber}'`
        }).firstPage();

        if (records && records.length > 0) {
            // Mise à jour si existant
            const recordId = records[0].id;
            await base(TABLE_NAME).update(recordId, {
                "Status": status,
                "LastUpdated": new Date().toISOString()
            });
            console.log(`📦 Airtable : Tracking ${trackingNumber} mis à jour (${status})`);
            return { success: true, recordId };
        } else {
            // Création d'une nouvelle ligne de suivi
            const created = await base(TABLE_NAME).create({
                "OrderId": String(orderId),
                "TrackingNumber": trackingNumber,
                "Provider": provider,
                "Status": status,
                "Destination": destination || 'DZ',
                "Customer": customerName || 'Inconnu',
                "LastUpdated": new Date().toISOString()
            });
            console.log(`📦 Airtable : Nouveau suivi enregistré pour la commande #${orderId}`);
            return { success: true, recordId: created.id };
        }
    } catch (err) {
        console.error("❌ Erreur Airtable Tracking Service :", err.message);
        return { success: false, error: err.message };
    }
}

module.exports = { saveOrUpdateTracking };
