// ============================================================================
// SAMII OS — TELEGRAM COMMUNITY AGENT
// Smart community mode: answers when addressed, can be enabled by admins,
// remembers the recent group context, and welcomes new members.
// ============================================================================
const axios = require("axios");
const memory = require("../brain/memory");
const planner = require("../brain/planner");

let cachedBotUsername = null;

function key(chatId) {
    return `tg_group_${chatId}`;
}

function isGroup(message) {
    const type = message?.chat?.type;
    return type === "group" || type === "supergroup";
}

function cleanText(text = "") {
    return text.replace(/@\w+/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDirectlyAddressed(message, botUsername) {
    const text = String(message?.text || "");
    if (!text) return false;
    if (/^\/sami(?:@\w+)?(?:\s|$)/i.test(text)) return true;
    if (botUsername && new RegExp(`@${escapeRegExp(botUsername)}\\b`, "i").test(text)) return true;
    if (/@sami\b/i.test(text)) return true;
    if (message?.reply_to_message?.from?.is_bot) return true;
    return false;
}

async function api(base, method, payload) {
    try {
        const { data } = await axios.post(`${base}/${method}`, payload);
        return data?.result;
    } catch (err) {
        console.error(`❌ Telegram community ${method}:`, err.response?.data || err.message);
        return null;
    }
}

async function getBotUsername(base) {
    if (cachedBotUsername) return cachedBotUsername;
    const bot = await api(base, "getMe", {});
    cachedBotUsername = bot?.username || "";
    return cachedBotUsername;
}

async function isAdmin(base, chatId, userId) {
    if (!userId) return false;
    const member = await api(base, "getChatMember", { chat_id: chatId, user_id: userId });
    return ["creator", "administrator"].includes(member?.status);
}

async function send(base, chatId, text, replyTo) {
    return api(base, "sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        ...(replyTo ? { reply_to_message_id: replyTo } : {}),
    });
}

async function getState(chatId) {
    const state = await memory.get(key(chatId));
    return state || { lang: "fr", history: [], communityMode: "smart" };
}

async function setState(chatId, state) {
    await memory.set(key(chatId), state);
}

async function handleCommand(message, base) {
    const text = String(message.text || "");
    const match = text.match(/^\/sami(?:@\w+)?(?:\s+(.+))?$/i);
    if (!match) return false;

    const chatId = message.chat.id;
    const arg = (match[1] || "help").trim().toLowerCase();
    const admin = await isAdmin(base, chatId, message.from?.id);
    const state = await getState(chatId);

    if (["on", "off"].includes(arg) && !admin) {
        await send(base, chatId, "🔐 Cette commande est réservée aux administrateurs.", message.message_id);
        return true;
    }

    if (arg === "on") {
        state.communityMode = "on";
        await setState(chatId, state);
        await send(base, chatId, "🤖 *SAMII est actif dans cette communauté.*\n\nJe peux répondre aux questions et aider les membres. Je reste discret quand on ne m'appelle pas.", message.message_id);
        return true;
    }

    if (arg === "off") {
        state.communityMode = "smart";
        await setState(chatId, state);
        await send(base, chatId, "🫡 Mode discret activé. Mentionnez-moi ou répondez à un message de SAMII pour me parler.", message.message_id);
        return true;
    }

    if (arg === "status") {
        await send(base, chatId, `🤖 *SAMII Community*\n\nMode : *${state.communityMode === "on" ? "ACTIF" : "DISCRET"}*\nMémoire : *active*\nRéponse : mention, @SAMII ou réponse directe.`, message.message_id);
        return true;
    }

    await send(base, chatId, "🤖 *SAMII Community*\n\n• Mentionnez-moi pour poser une question\n• Répondez à mon message pour continuer\n• `/sami status` — état du bot\n• `/sami on` — activer les réponses automatiques (admin)\n• `/sami off` — revenir au mode discret (admin)", message.message_id);
    return true;
}

async function handleNewMembers(message, base) {
    const members = message.new_chat_members || [];
    if (!members.length) return false;

    const visible = members.filter(member => !member.is_bot).slice(0, 5);
    if (!visible.length) return false;

    const names = visible.map(member => member.first_name || "ami").join(", ");
    await send(base, message.chat.id, `👋 *Bienvenue ${names} !*\n\nVous êtes dans la communauté SAMII. Posez vos questions et découvrez comment automatiser votre activité. 🚀`, message.message_id);
    return true;
}

async function handleMessage(message, base, context = {}) {
    if (!isGroup(message)) return false;

    if (await handleNewMembers(message, base)) return true;
    if (await handleCommand(message, base)) return true;

    const text = String(message.text || "").trim();
    if (!text) return true;

    const state = await getState(message.chat.id);
    const botUsername = await getBotUsername(base);
    const direct = isDirectlyAddressed(message, botUsername);
    const active = state.communityMode === "on";

    if (!direct && !active) return true;

    const history = Array.isArray(state.history) ? state.history : [];
    const author = message.from?.first_name || message.from?.username || "Membre";
    const groupTitle = message.chat.title || "Communauté SAMII";

    const prompt = cleanText(text);
    if (!prompt) return true;

    const reply = await planner.ask(prompt, {
        source: "telegram-community",
        audience: "community",
        chatType: message.chat.type,
        chatId: message.chat.id,
        groupTitle,
        memberName: author,
        workspaceId: context.workspaceId || "",
        metier: context.metier || "",
        communityMode: state.communityMode,
        instructions: [
            "Tu es SAMII dans une communauté Telegram.",
            "Réponds naturellement, utilement et brièvement.",
            "Utilise le contexte récent de la communauté sans inventer de faits.",
            "Si une demande concerne un compte, une commande ou des données privées, demande à la personne de passer en conversation privée avec SAMII.",
            "Ne prétends jamais être administrateur humain.",
            "Ne bannis, supprime ou modère pas toi-même sans commande explicite et autorisation d'un administrateur."
        ].join("\n")
    }, history.slice(-30));

    await send(base, message.chat.id, reply, direct ? message.message_id : undefined);

    const nextHistory = [
        ...history,
        { role: "user", message: `${author}: ${prompt}` },
        { role: "model", message: reply }
    ].slice(-40);
    await setState(message.chat.id, { ...state, history: nextHistory });
    return true;
}

module.exports = { isGroup, handleMessage };
