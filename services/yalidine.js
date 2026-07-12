const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");

async function send({ to, message }) {
    console.log(`🚚 Yalidine → ${to} : ${message}`);
    return { success: true };
}

async function track(trackingNumber) {
    try {
        const res = await axios.get(
            `https://api.yalidine.app/v1/parcels/${trackingNumber}`,
            { headers: { "X-API-ID": CONFIG.YALIDINE?.API_ID, "X-API-TOKEN": CONFIG.YALIDINE?.API_TOKEN } }
        );
        return { success: true, data: res.data };
    } catch (err) {
        console.error("❌ Yalidine :", err.message);
        return { success: false, error: err.message };
    }
}

async function receive(event) {
    await orchestrator.process({
        type   : "yalidine.update",
        shop   : event.shop || "",
        payload: event,
    });
}

module.exports = { send, receive, track };
