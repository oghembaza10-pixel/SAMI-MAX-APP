// ==========================================================================
// SAMII OS — Suivi universel via 17TRACK (fallback pour tous transporteurs)
// ==========================================================================
const axios = require("axios");

const TRACK17_API_KEY = process.env.TRACK17_API_KEY || "";

async function checkStatus(trackingNumber, workspaceId) {
    if (!TRACK17_API_KEY) {
        return { success: false, error: "Clé 17TRACK non configurée." };
    }
    try {
        const res = await axios.post(
            "https://api.17track.net/track/v2.2/gettrackinfo",
            [{ number: trackingNumber }],
            { headers: { "17token": TRACK17_API_KEY, "Content-Type": "application/json" } }
        );
        const info = res.data?.data?.accepted?.[0];
        if (!info) return { success: false, error: "Numéro de suivi introuvable." };

        const evenements = info.track_info?.tracking?.providers?.[0]?.events || [];
        const dernier = evenements[0];

        return {
            success: true,
            statut: dernier?.description || "En transit",
            date: dernier?.time_iso || null,
            source: "17track",
        };
    } catch (err) {
        console.error("❌ 17TRACK :", err.message);
        return { success: false, error: err.message };
    }
}

async function registerTracking(trackingNumber, carrierCode) {
    if (!TRACK17_API_KEY) return { success: false };
    try {
        await axios.post(
            "https://api.17track.net/track/v2.2/register",
            [{ number: trackingNumber, carrier: carrierCode || undefined }],
            { headers: { "17token": TRACK17_API_KEY, "Content-Type": "application/json" } }
        );
        return { success: true };
    } catch (err) {
        console.error("❌ 17TRACK register :", err.message);
        return { success: false };
    }
}

module.exports = { checkStatus, registerTracking };
