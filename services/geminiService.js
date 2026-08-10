// ==========================================================================
// SAMII OS — GEMINI SERVICE (avec Function Calling — SAMII peut AGIR)
// ==========================================================================
const axios = require("axios");
const CONFIG = require("../config");
const SAMII_PROMPT = require("../brain/prompts/index");
const MODEL = "gemini-2.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${CONFIG.GEMINI.API_KEY}`;

const TOOLS = [
    {
        functionDeclarations: [
            {
                name: "confirmer_commande",
                description: "Confirme une commande client existante quand le client ou le marchand le demande explicitement.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        orderId: { type: "STRING", description: "L'identifiant de la commande à confirmer (ex: TG-123456)." },
                    },
                    required: ["orderId"],
                },
            },
            {
                name: "annuler_commande",
                description: "Annule une commande client existante quand le client ou le marchand le demande explicitement.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        orderId: { type: "STRING", description: "L'identifiant de la commande à annuler." },
                    },
                    required: ["orderId"],
                },
            },
        ],
    },
];

async function send({ to, message }) {
    console.log(`🤖 Gemini → ${to} : ${message}`);
    return { success: true };
}

async function chat({ message, context = {}, useTools = false, history = [] }, retryCount = 0) {
    try {
        const body = {
            contents: [
                ...history.map(h => ({ role: h.role, parts: [{ text: h.message }] })),
                { role: "user", parts: [{ text: SAMII_PROMPT(message, context) }] },
            ],
        };
        if (useTools) body.tools = TOOLS;
        const response = await axios.post(API_URL, body);
        const candidate = response.data.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const functionCallPart = parts.find(p => p.functionCall);
        if (functionCallPart) {
            return {
                type: "function_call",
                name: functionCallPart.functionCall.name,
                args: functionCallPart.functionCall.args || {},
            };
        }
        const textPart = parts.find(p => p.text);
        return {
            type: "text",
            text: textPart?.text || "SAMII n'a pas su répondre, réessaie autrement.",
        };
    } catch (err) {
        const isQuotaError = err.response?.data?.error?.code === 429;
        if (isQuotaError && retryCount < 1) {
            console.warn("⏳ Quota Gemini atteint, nouvel essai dans 5s...");
            await new Promise(resolve => setTimeout(resolve, 5000));
            return chat({ message, context, useTools, history }, retryCount + 1);
        }
        console.error("❌ Gemini :", err.response?.data || err.message);
        return { type: "text", text: "SAMII réfléchit un peu plus longtemps que prévu, réessaie dans une minute." };
    }
}

async function chatWithSearch({ message, context = {} }) {
    try {
        const body = {
            contents: [{ role: "user", parts: [{ text: SAMII_PROMPT(message, context) }] }],
            tools: [{ google_search: {} }],
        };
        const response = await axios.post(API_URL, body);
        const candidate = response.data.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const textPart = parts.find(p => p.text);

        const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
        const sources = groundingChunks
            .map(c => c.web ? { title: c.web.title || c.web.uri, uri: c.web.uri } : null)
            .filter(Boolean);

        return {
            type: "text",
            text: textPart?.text || "SAMII n'a pas su répondre, réessaie autrement.",
            sources,
        };
    } catch (err) {
        console.error("❌ Gemini (search) :", err.response?.data || err.message);
        return { type: "text", text: "SAMII démarre actuellement. Réessaie dans quelques instants.", sources: [] };
    }
}

async function chatWithFunctionResult({ message, context = {}, functionName, functionArgs, functionResult }) {
    try {
        const body = {
            contents: [
                { role: "user", parts: [{ text: SAMII_PROMPT(message, context) }] },
                { role: "model", parts: [{ functionCall: { name: functionName, args: functionArgs } }] },
                { role: "function", parts: [{ functionResponse: { name: functionName, response: functionResult } }] },
            ],
            tools: TOOLS,
        };
        const response = await axios.post(API_URL, body);
        const parts = response.data.candidates?.[0]?.content?.parts || [];
        const textPart = parts.find(p => p.text);
        return textPart?.text || "C'est fait ✅";
    } catch (err) {
        console.error("❌ Gemini (function result) :", err.response?.data || err.message);
        return "C'est fait ✅";
    }
}

// Résumé de semaine (mémoire "gratuit") — texte compact que l'utilisateur peut
// recoller dans une nouvelle conversation pour repartir de là, pas de zéro.
async function summarize(transcript) {
    try {
        const body = {
            contents: [{
                role: "user",
                parts: [{
                    text: `Résume cet historique de conversation en un paragraphe dense (6-10 phrases), en gardant les faits, décisions et sujets importants évoqués. Ce résumé sera recollé par l'utilisateur au début d'une future conversation pour que SAMII reparte de là au lieu de zéro — écris-le donc à la première personne, comme si SAMII se le disait à lui-même :\n\n${transcript}`,
                }],
            }],
        };
        const response = await axios.post(API_URL, body);
        const parts = response.data.candidates?.[0]?.content?.parts || [];
        const textPart = parts.find(p => p.text);
        return textPart?.text || "";
    } catch (err) {
        console.error("❌ Gemini (summarize) :", err.response?.data || err.message);
        return "";
    }
}

async function receive(msg) {
    console.log("📥 Gemini receive :", msg);
}

module.exports = { send, chat, chatWithFunctionResult, chatWithSearch, summarize, receive, TOOLS };
