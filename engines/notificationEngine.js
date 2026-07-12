/**
 * ============================================================
 * OG • Notification Engine
 * Porte de sortie unique — tous les canaux
 * ============================================================
 */

const airtable = require("../services/airtable");

// ── HANDLERS ─────────────────────────────────────────
const handlers = {};

// Chargement dynamique — on ajoute sans toucher au moteur
function register(channel, handler) {
    handlers[channel] = handler;
    console.log(`✅ NotificationEngine : canal "${channel}" enregistré`);
}

// ── SEND ─────────────────────────────────────────────
async function send({ channel, to, message, data = {}, shop = "" }) {
    try {
        console.log(`📤 Notification → [${channel}] : ${message}`);

        // 1. Enregistre dans Airtable
        await airtable.notification(channel, message, shop);

        // 2. Envoie via le bon handler
        if (handlers[channel]) {
            await handlers[channel].send({ to, message, data });
        } else {
            console.warn(`⚠️ Aucun handler pour le canal : ${channel}`);
        }

        // 3. Log
        await airtable.log(`notification.${channel}`, message, shop);

        return { success: true };

    } catch (err) {
        console.error(`❌ NotificationEngine [${channel}] :`, err.message);
        await airtable.log(`error.notification.${channel}`, err.message, shop);
        return { success: false, error: err.message };
    }
}

// ── BROADCAST ────────────────────────────────────────
async function broadcast({ channels, recipients = {}, message, data = {}, shop = "" }) {
    const results = await Promise.allSettled(
        channels.map(channel =>
            send({
                channel,
                to     : recipients[channel] || "",
                message,
                data,
                shop,
            })
        )
    );
    return results;
}



// ── SHORTCUTS ────────────────────────────────────────
async function telegram(chatId, message, shop = "") {
    return await send({ channel: "telegram", to: chatId, message, shop });
}

async function whatsapp(phone, message, shop = "") {
    return await send({ channel: "whatsapp", to: phone, message, shop });
}

async function email(address, message, shop = "") {
    return await send({ channel: "email", to: address, message, shop });
}

async function meta(userId, message, shop = "") {
    return await send({ channel: "meta", to: userId, message, shop });
}

module.exports = {
    register,
    send,
    broadcast,
    telegram,
    whatsapp,
    email,
    meta,
};
