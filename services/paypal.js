const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");

async function getToken() {
    const res = await axios.post(
        "https://api-m.sandbox.paypal.com/v1/oauth2/token",
        "grant_type=client_credentials",
        { auth: { username: CONFIG.PAYPAL?.CLIENT_ID, password: CONFIG.PAYPAL?.SECRET } }
    );
    return res.data.access_token;
}

async function send({ to, message }) {
    console.log(`💰 PayPal notification → ${to} : ${message}`);
    return { success: true };
}

async function createOrder({ amount, currency = "EUR" }) {
    try {
        const token = await getToken();
        const res   = await axios.post(
            "https://api-m.sandbox.paypal.com/v2/checkout/orders",
            { intent: "CAPTURE", purchase_units: [{ amount: { currency_code: currency, value: String(amount) } }] },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return { success: true, order: res.data };
    } catch (err) {
        console.error("❌ PayPal :", err.message);
        return { success: false, error: err.message };
    }
}

async function receive(event) {
    await orchestrator.process({
        type   : `paypal.${event.type}`,
        shop   : event.shop || "",
        payload: event,
    });
}

module.exports = { send, receive, createOrder };
