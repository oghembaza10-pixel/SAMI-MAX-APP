// ==========================================================================
// SAMII OS — TRACKING — Adaptateur Yalidine
// Utilise la clé perso du marchand si connectée, sinon la clé globale OG Empire.
// ==========================================================================
const axios = require("axios");
const CONFIG = require("../../config");
const connectorService = require("../connectorService");

async function getCredentials(workspaceId) {
    try {
        if (workspaceId) {
            const connecteurs = await connectorService.getByWorkspace(workspaceId);
            const perso = connecteurs.find(c => c.type === "yalidine" && c.actif);
            if (perso?.config?.apiId && perso?.config?.apiToken) {
                return {
                    apiId: perso.config.apiId,
                    apiToken: perso.config.apiToken,
                    source: "perso",
                };
            }
        }
    } catch (err) {
        console.warn("⚠️ Tracking Yalidine (clé perso) :", err.message);
    }

    return {
        apiId: CONFIG.YALIDINE?.API_ID,
        apiToken: CONFIG.YALIDINE?.API_TOKEN,
        source: "global",
    };
}

async function checkStatus(trackingNumber, workspaceId) {
    try {
        const creds = await getCredentials(workspaceId);

        if (!creds.apiId || !creds.apiToken) {
            return { success: false, error: "Aucune clé Yalidine configurée (ni perso, ni globale)." };
        }

        const res = await axios.get(
            `https://api.yalidine.app/v1/parcels/${trackingNumber}`,
            { headers: { "X-API-ID": creds.apiId, "X-API-TOKEN": creds.apiToken } }
        );

        const data = res.data || {};
        return {
            success: true,
            statut: data.last_status || data.status || "inconnu",
            derniereMiseAJour: data.date_status || data.updated_at || null,
            source: creds.source,
            details: data,
        };
    } catch (err) {
        console.error("❌ Tracking Yalidine :", err.message);
        return { success: false, error: err.message };
    }
}

module.exports = { checkStatus };
