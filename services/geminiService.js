// ==========================================================================
// SAMII OS — GEMINI SERVICE (avec Function Calling — SAMII peut AGIR)
// ==========================================================================
const axios = require("axios");
const CONFIG = require("../config");
const SAMII_PROMPT = require("../brain/prompts/index");
const MODEL = "gemini-3.6-flash";
const KEYS  = CONFIG.GEMINI.API_KEYS.length > 0 ? CONFIG.GEMINI.API_KEYS : [CONFIG.GEMINI.API_KEY];

function urlFor(key) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
}

// Essaie chaque clé Gemini disponible tour à tour : dès qu'une clé répond
// 429 (quota dépassé), bascule sur la suivante. Une autre erreur (400, réseau...)
// remonte immédiatement — inutile d'essayer les autres clés, ce ne serait pas un
// problème de quota.
async function postWithRotation(body) {
    let lastErr;
    for (let i = 0; i < KEYS.length; i++) {
        try {
            return await axios.post(urlFor(KEYS[i]), body);
        } catch (err) {
            lastErr = err;
            const isQuotaError = err.response?.data?.error?.code === 429;
            if (!isQuotaError) throw err;
            if (i < KEYS.length - 1) console.warn(`⏳ Clé Gemini #${i + 1} en quota dépassé, bascule sur la clé #${i + 2}...`);
        }
    }
    throw lastErr;
}

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
            {
                name: "prendre_rendez_vous",
                description: "Enregistre une demande de rendez-vous pour le client, uniquement une fois que le motif, la date/heure souhaitée et son numéro de téléphone sont clairement connus dans la conversation.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        motif: { type: "STRING", description: "Le motif du rendez-vous." },
                        date_rdv: { type: "STRING", description: "La date et l'heure souhaitées, telles que données par le client." },
                        telephone: { type: "STRING", description: "Le numéro de téléphone du client." },
                    },
                    required: ["motif", "date_rdv", "telephone"],
                },
            },
            {
                name: "passer_commande",
                description: "Enregistre une commande pour le client, uniquement une fois que le produit (choisi EXACTEMENT parmi le catalogue réel fourni dans le contexte — jamais inventé), l'adresse de livraison et le numéro de téléphone sont connus.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        produit: { type: "STRING", description: "Le nom exact du produit choisi, tel qu'il apparaît dans le catalogue fourni dans le contexte." },
                        telephone: { type: "STRING", description: "Le numéro de téléphone du client." },
                        adresse: { type: "STRING", description: "L'adresse de livraison du client." },
                    },
                    required: ["produit", "telephone", "adresse"],
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
        const prompt = await SAMII_PROMPT(message, context);

        // Pièce jointe (photo ou document) — envoyée en inlineData avec le
        // message courant uniquement. L'historique ne rejoue jamais les
        // fichiers déjà analysés (coût + les API multimodales ne les
        // gardent pas non plus en mémoire d'une requête à l'autre).
        const userParts = [{ text: prompt }];
        if (context.piece?.base64 && context.piece?.mimeType) {
            userParts.push({ inlineData: { mimeType: context.piece.mimeType, data: context.piece.base64 } });
        }

        const body = {
            contents: [
                ...history.map(h => ({ role: h.role, parts: [{ text: h.message }] })),
                { role: "user", parts: userParts },
            ],
        };
        if (useTools) body.tools = TOOLS;
        const response = await postWithRotation(body);
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
        const prompt = await SAMII_PROMPT(message, context);
        const body = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
        };
        const response = await postWithRotation(body);
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
        const prompt = await SAMII_PROMPT(message, context);
        const body = {
            contents: [
                { role: "user", parts: [{ text: prompt }] },
                { role: "model", parts: [{ functionCall: { name: functionName, args: functionArgs } }] },
                { role: "user", parts: [{ functionResponse: { name: functionName, response: functionResult } }] },
            ],
            tools: TOOLS,
        };
        const response = await postWithRotation(body);
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
        const response = await postWithRotation(body);
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
