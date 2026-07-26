// ======================================================
// SAMII OS — TELEGRAM WEBHOOK V6
// ======================================================

const express      = require("express");
const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");
const planner      = require("../brain/planner");
const memory       = require("../brain/memory");
const airtable     = require("../services/airtable");

const router = express.Router();
const TOKEN  = CONFIG.TELEGRAM.BOT_TOKEN;
const BASE   = `https://api.telegram.org/bot${TOKEN}`;

// ── HELPER REPLY ──────────────────────────────────────
async function reply(chatId, text) {
    try {
        await axios.post(`${BASE}/sendMessage`, {
            chat_id   : chatId,
            text,
            parse_mode: "Markdown",
        });
    } catch (err) {
        console.error("❌ Telegram reply :", err.response?.data || err.message);
    }
}

// ── TROUVE LE WORKSPACE_ID VIA CHAT_ID ───────────────
async function getWorkspaceByChatId(chatId) {
    try {
        const record = await airtable.findOne("CONNECTEURS",
            `AND({type}="telegram",{actif}=1,SEARCH("${chatId}",{config}))`
        );
        if (!record) return "";
        return record.fields?.workspace_id || "";
    } catch { return ""; }
}

// ── TROUVE LE CHAT_ID ADMIN VIA WORKSPACE ────────────
async function getAdminChatId(workspaceId) {
    try {
        if (!workspaceId) return null;
        const record = await airtable.findOne("CONNECTEURS",
            `AND({type}="telegram",{actif}=1,{workspace_id}="${workspaceId}")`
        );
        if (!record) return null;
        const config = JSON.parse((record.fields?.config || "{}").replace(/\\_/g, "_"));
        return config.chat_id || null;
    } catch { return null; }
}

// ── GÉNÈRE NUMÉRO COMMANDE ────────────────────────────
function genOrderId() {
    return `TG-${Date.now().toString().slice(-6)}`;
}

// ── FLUX COMMANDE ─────────────────────────────────────
async function handleOrderFlow(chatId, text, name) {
    const session = memory.get(chatId) || {};
    const step    = session.step;

    // Étape 1 — demander le produit
    if (!step) {
        memory.set(chatId, { step: "produit", name });
        await reply(chatId,
            `🛍️ *Parfait !*\n\nQuel produit souhaitez-vous commander ?\n_(Nom, taille, couleur...)_`
        );
        return true;
    }

    // Étape 2 — demander téléphone
    if (step === "produit") {
        memory.set(chatId, { step: "telephone", produit: text });
        await reply(chatId, `📞 Votre *numéro de téléphone* s'il vous plaît ?`);
        return true;
    }

    // Étape 3 — demander adresse
    if (step === "telephone") {
        memory.set(chatId, { step: "adresse", telephone: text });
        await reply(chatId, `📍 Votre *adresse de livraison* ?`);
        return true;
    }

    // Étape 4 — créer commande + notifier admin
    if (step === "adresse") {
        const orderId     = genOrderId();
        const s           = memory.get(chatId);
        const workspaceId = await getWorkspaceByChatId(chatId);
        const adminChatId = await getAdminChatId(workspaceId);

       await airtable.create("COMMANDES", {
    "ID Commande"  : orderId,
    "nom client"   : s.name      || "Inconnu",
    "Téléphone"    : s.telephone || "",
    "Adresse"      : text,
    "Produit"      : s.produit   || "",
    "Statut"       : "en attente",
    "Boutique"     : workspaceId,
    "Source"       : "telegram",
    "Date Commande": new Date().toISOString(),
    "montant"      : 0,
});

        await airtable.log("order.created.telegram", `#${orderId} — ${s.name}`, workspaceId);

        // Notification admin avec boutons
        if (adminChatId) {
            await axios.post(`${BASE}/sendMessage`, {
                chat_id     : adminChatId,
                parse_mode  : "Markdown",
                text        :
                    `🛎️ *Nouvelle commande !*\n\n` +
                    `🆔 *Numéro :* \`${orderId}\`\n` +
                    `👤 *Client :* ${s.name}\n` +
                    `📞 *Tél :* ${s.telephone}\n` +
                    `📦 *Produit :* ${s.produit}\n` +
                    `📍 *Adresse :* ${text}\n` +
                    `🏪 *Workspace :* ${workspaceId}`,
                reply_markup: {
                    inline_keyboard: [[
                        { text: "✅ Confirmer", callback_data: `confirm_${orderId}` },
                        { text: "❌ Annuler",   callback_data: `cancel_${orderId}`  },
                    ]],
                },
            });
        }

        memory.clear(chatId);

        // Confirmation client
        await reply(chatId,
            `✅ *Commande enregistrée !*\n\n` +
            `🆔 *Numéro :* \`${orderId}\`\n` +
            `👤 *Client :* ${s.name}\n` +
            `📦 *Produit :* ${s.produit}\n` +
            `📍 *Adresse :* ${text}\n` +
            `📞 *Tél :* ${s.telephone}\n\n` +
            `_Notre équipe vous contactera très prochainement. Merci !_ 🙏`
        );
        return true;
    }

    return false;
}

// ── DÉTECTION INTENTION COMMANDE ──────────────────────
function isOrderIntent(text) {
    const t = text.toLowerCase();
    return t.match(/command|acheter|achat|veux commander|je veux|passer commande|order|طلب|نطلب|نشري/);
}

// ── DÉTECTION ANNULATION ──────────────────────────────
function isCancelIntent(text) {
    const t = text.toLowerCase();
    return t.match(/annul|cancel|stop|arrêt|لا|waqef/);
}

// ── WEBHOOK ───────────────────────────────────────────
router.post("/", async (req, res) => {
    res.sendStatus(200);

    try {
        const body = req.body;

        // ── CALLBACK QUERY (boutons) ──────────────────────
        if (body.callback_query) {
            const cb     = body.callback_query;
            const chatId = cb.message.chat.id;
            const data   = cb.data || "";

            await axios.post(`${BASE}/answerCallbackQuery`, {
                callback_query_id: cb.id,
                text             : "⚙️ SAMII traite...",
            });
           if (data.startsWith("cancel_")) {
                const orderId = data.replace("cancel_", "");
                await orchestrator.process({
                    type   : "order.cancelled.telegram",
                    shop   : "",
                    payload: { orderId, chatId },
                });
                await reply(chatId,
                    `❌ *Commande #${orderId} annulée.*\n\nSi c'est une erreur, répondez-nous 😊`
                );
                return;
            } 
            
            

            if (data.startsWith("cancel_")) {
                const orderId = data.replace("cancel_", "");
                await orchestrator.process({
                    type   : "order.cancelled",
                    shop   : "",
                    payload: { orderId, chatId },
                });
                await reply(chatId,
                    `❌ *Commande #${orderId} annulée.*\n\nSi c'est une erreur, répondez-nous 😊`
                );
                return;
            }

            await orchestrator.process({
                type   : "telegram.callback",
                shop   : "",
                payload: { chatId, data, cb },
            });
            return;
        }

        // ── MESSAGE TEXTE ─────────────────────────────────
        const message = body.message;
        if (!message) return;

        const chatId = message.chat.id;
        const text   = (message.text || "").trim();
        const name   = message.from?.first_name || "Client";

        console.log(`📨 Telegram [${name}] : ${text}`);

        // /start
        if (text === "/start") {
            memory.clear(chatId);
            await reply(chatId,
                `👑 *Bienvenue sur SAMII OS !*\n\n` +
                `✅ Chat ID : \`${chatId}\`\n\n` +
                `Je suis SAMII, votre assistant commercial. Comment puis-je vous aider ?`
            );
            return;
        }

        // /id
        if (text === "/id") {
            await reply(chatId, `🆔 Chat ID : \`${chatId}\``);
            return;
        }

        // Annulation flux en cours
        if (isCancelIntent(text) && memory.getStep(chatId)) {
            memory.clear(chatId);
            await reply(chatId, `❌ Commande annulée. Comment puis-je vous aider ?`);
            return;
        }

        // Flux commande en cours
        if (memory.getStep(chatId)) {
            await handleOrderFlow(chatId, text, name);
            return;
        }

        // Intention de commander
        if (isOrderIntent(text)) {
            await handleOrderFlow(chatId, text, name);
            return;
        }

        // Log CRM
        await orchestrator.process({
            type   : "telegram.message",
            shop   : "",
            payload: { chatId, text, message },
        });

        // Réponse Gemini
        const geminiReply = await planner.ask(text, { source: "telegram", chatId, name });
        await reply(chatId, geminiReply);

    } catch (err) {
        console.error("❌ Telegram webhook :", err.message);
    }
});

module.exports = router;
