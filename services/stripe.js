const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");

let stripe;
try { stripe = require("stripe")(CONFIG.STRIPE?.SECRET_KEY); } catch(e) {}

async function send({ to, message }) {
    console.log(`💳 Stripe notification → ${to} : ${message}`);
    return { success: true };
}

async function createPayment({ amount, currency = "eur", description }) {
    try {
        const intent = await stripe.paymentIntents.create({
            amount     : Math.round(amount * 100),
            currency,
            description,
        });
        console.log(`✅ Stripe PaymentIntent : ${intent.id}`);
        return { success: true, intent };
    } catch (err) {
        console.error("❌ Stripe :", err.message);
        return { success: false, error: err.message };
    }
}

async function receive(event) {
    await orchestrator.process({
        type   : `stripe.${event.type}`,
        shop   : event.shop || "",
        payload: event.data,
    });
}

module.exports = { send, receive, createPayment };
