/**
 * ============================================================
 * OG • Notification Engine V2
 * Porte de sortie unique — tous les canaux
 * ============================================================
 */

const db = require("../services/db");
const workspaceService = require("../services/workspaceService");

// ── HANDLERS ─────────────────────────────────────────
const handlers = {};

function register(channel, handler) {
    handlers[channel] = handler;
    console.log(`✅ NotificationEngine : canal "${channel}" enregistré`);
}

// ── RÉCUPÉRER LES COORDONNÉES DE LA BOUTIQUE ──────────
// Lisait auparavant une table Airtable "BOUTIQUES" avec des champs
// (telegram_chat_id, whatsapp_phone...) qui n'ont jamais existé côté
// Postgres — cette résolution automatique échouait donc toujours en
// silence. Le chatId Telegram du marchand est le seul de ces trois
// canaux réellement stocké aujourd'hui (table connecteurs, posé par
// /telegram start admin_<workspaceId>) ; whatsapp_phone n'a pas
// d'équivalent existant (la config WhatsApp du marchand ne contient que
// les identifiants Green API d'envoi, pas un numéro de notification) —
// mieux vaut renvoyer vide que d'inventer un champ fictif.
async function getCoords(shop) {
    try {
        const [connecteur, workspace] = await Promise.all([
            db.query(`SELECT config FROM connecteurs WHERE type = 'telegram' AND workspace_id = $1 AND actif = true LIMIT 1`, [shop]),
            workspaceService.getById(shop),
        ]);

        let telegramChatId = "";
        if (connecteur[0]?.config) {
            const config = typeof connecteur[0].config === "string" ? JSON.parse(connecteur[0].config) : connecteur[0].config;
            telegramChatId = config?.chatId || "";
        }

        return {
            telegram : telegramChatId,
            whatsapp : "",
            email    : workspace?.owner || "",
            canal    : "telegram",
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

        if (handlers[channel]) {
            await handlers[channel].send({ to, message, data });
        } else {
            console.warn(`⚠️ Aucun handler pour le canal : ${channel}`);
        }

        return { success: true };

    } catch (err) {
        console.error(`❌ NotificationEngine [${channel}] :`, err.message);
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
    // Si chatId vide → auto-résolution via getCoords (Postgres)
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
    getCoords,
};
