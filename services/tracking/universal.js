// ==========================================================================
// SAMII OS — Suivi universel via 17TRACK (fallback sans clé perso marchand)
// ==========================================================================
const axios = require("axios");
const db = require("../db");

const TRACK17_API_KEY = process.env.TRACK17_API_KEY || "";

async function track(trackingNumber) {
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
        return { success: true, data: info };
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

module.exports = { track, registerTracking };
