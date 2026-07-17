/**
 * ============================================================
 * OG • Notification Engine V2
 * Porte de sortie unique — tous les canaux
 * ============================================================
 */

const airtable = require("../services/airtable");

// ── HANDLERS ─────────────────────────────────────────
const handlers = {};

function register(channel, handler) {
    handlers[channel] = handler;
    console.log(`✅ NotificationEngine : canal "${channel}" enregistré`);
}

// ── RÉCUPÉRER LES COORDONNÉES DE LA BOUTIQUE ──────────
async function getCoords(shop) {
    try {
        const boutique = await airtable.getBoutique(shop);
        const fields   = boutique?.fields || {};
        return {
            telegram : fields.telegram_chat_id || "",
            whatsapp : fields.whatsapp_phone   || "",
            email    : fields.email            || "",
            canal    : fields.canal            || "telegram",
        };
    } catch (err) {
        console.error("❌ getCoords :", err.message);
        return { telegram: "", whatsapp: "", email: "", canal: "telegram" };
    }
}

// ── SEND ─────────────────────────────────────────────
async function send({ channel, to, message, data = {}, shop = "" }) {
    try {
        // Auto-résolution du destinataire si manquant
        if (shop && !to) {
            const coords = await getCoords(shop);
            if (!channel) channel = coords.canal;
            if (channel === "telegram")  to = coords.telegram;
            if (channel === "whatsapp")  to = coords.whatsapp;
            if (channel === "email")     to = coords.email;
        }

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
    // Auto-résolution si recipients vides
    let coords = { telegram: "", whatsapp: "", email: "" };
    if (shop) coords = await getCoords(shop);

    const results = await Promise.allSettled(
        channels.map(channel =>
            send({
                channel,
                to     : recipients[channel] || coords[channel] || "",
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
    // Si chatId vide → auto-résolution depuis Airtable
    if (!chatId && shop) {
        const coords = await getCoords(shop);
        chatId = coords.telegram;
    }
    return await send({ channel: "telegram", to: chatId, message, shop });
}

async function whatsapp(phone, message, shop = "") {
    if (!phone && shop) {
        const coords = await getCoords(shop);
        phone = coords.whatsapp;
    }
    return await send({ channel: "whatsapp", to: phone, message, shop });
}

async function email(address, message, shop = "") {
    if (!address && shop) {
        const coords = await getCoords(shop);
        address = coords.email;
    }
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
