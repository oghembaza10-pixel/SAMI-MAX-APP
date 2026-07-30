// ==========================================================================
// SAMII OS — TRACKING — Adaptateur Yalidine
// ==========================================================================
const yalidineService = require("../yalidine");

async function checkStatus(trackingNumber) {
    const result = await yalidineService.track(trackingNumber);

    if (!result.success) {
        return { success: false, error: result.error };
    }

    // Normalise la réponse Yalidine vers un format universel
    const data = result.data || {};
    return {
        success: true,
        statut: data.last_status || data.status || "inconnu",
        derniereMiseAJour: data.date_status || data.updated_at || null,
        details: data,
    };
}

module.exports = { checkStatus };
