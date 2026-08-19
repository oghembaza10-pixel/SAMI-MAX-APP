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

// ── RELAIS OPENROUTER : si Gemini est en panne ou en quota épuisé sur toutes
// ses clés, SAMII continue de répondre aux clients et de confirmer/créer
// leurs commandes via un modèle différent plutôt que de rester silencieux.
// Volontairement un fournisseur DIFFÉRENT de Gemini (pas une autre variante
// Google) pour une vraie redondance en cas de panne côté Google.
// Modèle GRATUIT (":free") — ce relais ne se déclenche que dans de rares
// pannes Gemini, un modèle gratuit avec support du function calling suffit
// largement et évite de payer pour un chemin de secours peu utilisé.
const OPENROUTER_MODEL = "openai/gpt-oss-20b:free";
const OPENROUTER_URL   = "https://openrouter.ai/api/v1/chat/completions";

async function postOpenRouter(body) {
    if (!CONFIG.OPENROUTER?.API_KEY) throw new Error("Clé OpenRouter absente (relais indisponible).");
    return await axios.post(OPENROUTER_URL, body, {
        headers: {
            "Authorization": `Bearer ${CONFIG.OPENROUTER.API_KEY}`,
            "Content-Type": "application/json",
        },
    });
}

// ── RELAIS GROQ : essayé AVANT OpenRouter quand Gemini est en panne — API
// gratuite, ultra rapide, compatible format OpenAI (mêmes helpers que le
// relais OpenRouter ci-dessus), donc un fournisseur de plus dans la chaîne
// de secours pour qu'un client ne reste jamais sans réponse.
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL    = "https://api.groq.com/openai/v1/chat/completions";

async function postGroq(body) {
    if (!CONFIG.GROQ?.API_KEY) throw new Error("Clé Groq absente (relais indisponible).");
    return await axios.post(GROQ_URL, body, {
        headers: {
            "Authorization": `Bearer ${CONFIG.GROQ.API_KEY}`,
            "Content-Type": "application/json",
        },
    });
}

// ── RELAIS DEEPSEEK : dernier recours, essayé seulement si Gemini ET Groq
// ET OpenRouter ont tous échoué (quotas gratuits tous épuisés en même
// temps — cas rare mais possible si le trafic grossit). Payant mais très
// économique, ça absorbe le débordement sans jamais laisser un client sans
// réponse. Format compatible OpenAI, mêmes helpers que Groq/OpenRouter.
const DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_URL   = "https://api.deepseek.com/chat/completions";

async function postDeepSeek(body) {
    if (!CONFIG.DEEPSEEK?.API_KEY) throw new Error("Clé DeepSeek absente (relais indisponible).");
    return await axios.post(DEEPSEEK_URL, body, {
        headers: {
            "Authorization": `Bearer ${CONFIG.DEEPSEEK.API_KEY}`,
            "Content-Type": "application/json",
        },
    });
}

// Convertit les déclarations d'outils au format Gemini (utilisées plus bas)
// vers le format OpenAI/OpenRouter — une seule source de vérité (TOOLS),
// jamais deux définitions à maintenir en double.
function toOpenAiTools(geminiTools) {
    return geminiTools[0].functionDeclarations.map(fn => ({
        type: "function",
        function: {
            name: fn.name,
            description: fn.description,
            parameters: {
                type: "object",
                properties: Object.fromEntries(
                    Object.entries(fn.parameters.properties).map(([key, val]) => [
                        key, { type: (val.type || "STRING").toLowerCase(), description: val.description },
                    ])
                ),
                required: fn.parameters.required || [],
            },
        },
    }));
}

// Logique partagée entre les relais Groq et OpenRouter : les deux exposent
// une API compatible format OpenAI (chat completions + tool_calls), seuls
// le endpoint/modèle/nom de provider changent.
async function chatViaOpenAiCompatible({ provider, model, poster, message, context = {}, useTools = false, history = [] }) {
    const prompt = await SAMII_PROMPT(message, context);
    const messages = [
        ...history.map(h => ({ role: h.role === "model" ? "assistant" : "user", content: h.message })),
        { role: "user", content: prompt },
    ];
    const body = { model, messages };
    body.tools = toOpenAiTools(buildToolsPayload(useTools, context));

    const response = await poster(body);
    const choice = response.data.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];

    if (toolCall) {
        let args = {};
        try { args = JSON.parse(toolCall.function.arguments || "{}"); } catch { /* ignore */ }
        return {
            type: "function_call",
            provider,
            name: toolCall.function.name,
            args,
            toolCallId: toolCall.id,
            assistantMessage: choice.message,
        };
    }
    return {
        type: "text",
        provider,
        text: choice?.message?.content || "SAMII n'a pas su répondre, réessaie autrement.",
    };
}

async function chatViaGroq(args) {
    return chatViaOpenAiCompatible({ provider: "groq", model: GROQ_MODEL, poster: postGroq, ...args });
}

async function chatViaOpenRouter(args) {
    return chatViaOpenAiCompatible({ provider: "openrouter", model: OPENROUTER_MODEL, poster: postOpenRouter, ...args });
}

async function chatViaDeepSeek(args) {
    return chatViaOpenAiCompatible({ provider: "deepseek", model: DEEPSEEK_MODEL, poster: postDeepSeek, ...args });
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
                name: "proposer_creneaux_rdv",
                description: "PRIORITAIRE dès que le motif du rendez-vous et le téléphone du client sont connus, mais qu'il n'a PAS encore donné de date précise — envoie un calendrier interactif (jours et créneaux horaires libres) pour que le client choisisse lui-même, au lieu de lui demander une date en texte. Si cette fonction renvoie une erreur (canal non compatible), utilise alors prendre_rendez_vous en demandant sa date/heure préférée en texte.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        motif: { type: "STRING", description: "Le motif du rendez-vous." },
                        telephone: { type: "STRING", description: "Le numéro de téléphone du client." },
                    },
                    required: ["motif", "telephone"],
                },
            },
            {
                name: "prendre_rendez_vous",
                description: "Repli uniquement : enregistre une demande de rendez-vous quand le client a lui-même donné une date/heure précise en texte, ou quand proposer_creneaux_rdv n'est pas utilisable sur ce canal.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        motif: { type: "STRING", description: "Le motif du rendez-vous." },
                        date_rdv: { type: "STRING", description: "La date et l'heure souhaitées, calculées par toi à partir de la date actuelle donnée dans le contexte et de ce que dit le client (ex: \"demain\", \"jeudi prochain\") — au format ISO strict AAAA-MM-JJTHH:MM:SS (ex: 2026-08-15T15:00:00). Jamais de texte libre, jamais la phrase du client telle quelle." },
                        telephone: { type: "STRING", description: "Le numéro de téléphone du client." },
                    },
                    required: ["motif", "date_rdv", "telephone"],
                },
            },
            {
                name: "rechercher_prospects",
                description: "Cherche sur le web de vraies entreprises ou boutiques publiques correspondant à un profil donné — pour trouver des clients ou marchands potentiels à contacter. Utilise cette fonction dès qu'on te demande de trouver des prospects, des clients, ou des marchands à qui proposer quelque chose (y compris pour OG Technology lui-même).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        cible: { type: "STRING", description: "Description du profil de prospect recherché (ex: \"petites boutiques de vêtements en ligne\", \"marchands sans assistant IA\")." },
                        marche: { type: "STRING", description: "Marché ou région ciblée (ex: \"Algérie\", \"France\")." },
                    },
                    required: ["cible", "marche"],
                },
            },
            {
                name: "consulter_gmail",
                description: "Consulte les derniers emails reçus dans la boîte Gmail du marchand connecté (sujet, expéditeur, extrait). Utilise cette fonction dès qu'on te demande ce qu'il y a dans le mail, les derniers messages reçus, etc.",
                parameters: { type: "OBJECT", properties: {} },
            },
            {
                name: "envoyer_email",
                description: "Envoie un email au nom du marchand connecté, depuis sa boîte Gmail. N'appelle cette fonction qu'une fois le destinataire, le sujet et le contenu clairement connus.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        to: { type: "STRING", description: "L'adresse email du destinataire." },
                        subject: { type: "STRING", description: "L'objet de l'email." },
                        body: { type: "STRING", description: "Le contenu de l'email." },
                    },
                    required: ["to", "subject", "body"],
                },
            },
            {
                name: "passer_commande",
                description: "Enregistre une commande pour UN SEUL produit (choisi EXACTEMENT parmi le catalogue réel fourni dans le contexte — jamais inventé, jamais deux produits dans le même appel), une fois que le produit, l'adresse de livraison et le numéro de téléphone sont connus. AVANT le tout premier appel sur cette commande, si un autre produit du catalogue complète naturellement celui choisi (ex: accessoire, produit du même univers), suggère-le UNE SEULE fois au client en une phrase courte, sans insister — n'appelle la fonction qu'après sa réponse. S'il accepte le produit complémentaire, appelle cette fonction UNE DEUXIÈME FOIS juste après, avec ce second produit (adresse/téléphone identiques), pour créer sa propre commande. Si aucun produit complémentaire pertinent n'existe, ou si le client a déjà répondu à la suggestion, appelle la fonction directement pour le produit initial.",
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

// Outils du marchand pour lui-même (jamais côté client) — toujours proposés
// dès que les outils d'action commerciale (commande, RDV...) sont désactivés
// pour le fondateur/marchand (audience "souverain", voir planner.js), seul
// cas où useTools vaut false. Recherche de prospects, lecture/envoi Gmail :
// aucun ne touche aux données commerciales d'un client, donc aucun ne
// présente le risque qui justifie ce garde-fou.
const SEARCH_TOOLS = [
    {
        functionDeclarations: TOOLS[0].functionDeclarations.filter(fn =>
            ["rechercher_prospects", "consulter_gmail", "envoyer_email"].includes(fn.name)
        ),
    },
];

// Outil dédié à l'onboarding conversationnel (création du QG) — volontairement
// tenu à l'écart de TOOLS/SEARCH_TOOLS : il ne doit jamais être proposé dans
// une conversation client ou une conversation générale avec le fondateur,
// seulement dans le contexte précis context.source === "onboarding" (voir
// buildToolsPayload ci-dessous et routes/workspace.js).
const ONBOARDING_TOOLS = [
    {
        functionDeclarations: [
            {
                name: "creer_workspace",
                description: "Crée le QG (workspace) du marchand, une seule fois que son activité (nom), son métier et son pays sont connus dans la conversation. N'appelle cette fonction qu'une seule fois.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        nom: { type: "STRING", description: "Le nom de l'activité/du workspace, tel que donné par l'utilisateur." },
                        metier: { type: "STRING", description: "Un des métiers suivants EXACTEMENT si l'activité correspond : ecommerce, restaurant, immobilier, livreur, sante, finance, education, technologie, agriculture, industrie, services, tourisme. Si aucun ne correspond vraiment, utilise 'autre'." },
                        metierCustom: { type: "STRING", description: "Si metier vaut 'autre', le métier précis tel que décrit par l'utilisateur (ex: Avocat, Coiffeur, Dentiste). Chaîne vide sinon." },
                        pays: { type: "STRING", description: "Code pays sur 2 lettres parmi : DZ, MA, TN, FR, BE, CA, SN, CI. Si un autre pays est mentionné, utilise 'OTHER'." },
                        description: { type: "STRING", description: "Courte description optionnelle de l'activité, si l'utilisateur en donne une spontanément. Chaîne vide sinon." },
                    },
                    required: ["nom", "metier", "pays"],
                },
            },
        ],
    },
];

function buildToolsPayload(useTools, context) {
    if (context?.source === "onboarding") return ONBOARDING_TOOLS;
    return useTools ? TOOLS : SEARCH_TOOLS;
}

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
        body.tools = buildToolsPayload(useTools, context);
        const response = await postWithRotation(body);
        const candidate = response.data.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const functionCallPart = parts.find(p => p.functionCall);
        if (functionCallPart) {
            return {
                type: "function_call",
                provider: "gemini",
                name: functionCallPart.functionCall.name,
                args: functionCallPart.functionCall.args || {},
                // Requis par gemini-3.6-flash pour renvoyer un functionCall dans
                // l'historique (voir chatWithFunctionResult) — sans ça, l'appel
                // suivant échoue en 400 "missing a thought_signature".
                thoughtSignature: functionCallPart.thoughtSignature || functionCallPart.thought_signature || null,
            };
        }
        const textPart = parts.find(p => p.text);
        return {
            type: "text",
            provider: "gemini",
            text: textPart?.text || "SAMII n'a pas su répondre, réessaie autrement.",
        };
    } catch (err) {
        const isQuotaError = err.response?.data?.error?.code === 429;
        // "UNAVAILABLE" = Google dit lui-même que c'est un pic de charge
        // temporaire ("usually temporary") — pas un problème de clé/quota.
        // Sans ce cas, chaque pic basculait directement sur Groq, qui se
        // retrouvait à absorber tout le trafic et s'épuisait en quelques
        // messages (prompt système volumineux = beaucoup de tokens par appel).
        const estSurcharge = err.response?.data?.error?.status === "UNAVAILABLE";
        if ((isQuotaError || estSurcharge) && retryCount < 2) {
            const delai = estSurcharge ? 2000 * (retryCount + 1) : 5000;
            console.warn(`⏳ Gemini ${estSurcharge ? "surchargé" : "quota atteint"}, nouvel essai dans ${delai / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delai));
            return chat({ message, context, useTools, history }, retryCount + 1);
        }
        console.error("❌ Gemini :", err.response?.data || err.message);
        // Gemini est en panne ou toutes les clés sont en quota épuisé — on
        // relaie vers un fournisseur différent plutôt que de laisser le
        // client sans réponse et sa commande/RDV non traité. Groq d'abord
        // (gratuit, très rapide), puis OpenRouter, puis DeepSeek (payant
        // mais très économique) en tout dernier recours.
        try {
            console.warn("🔀 Relais Groq (Gemini indisponible)...");
            return await chatViaGroq({ message, context, useTools, history });
        } catch (groqErr) {
            console.error("❌ Groq (relais) :", groqErr.response?.data || groqErr.message);
            try {
                console.warn("🔀 Relais OpenRouter (Groq indisponible aussi)...");
                return await chatViaOpenRouter({ message, context, useTools, history });
            } catch (fallbackErr) {
                console.error("❌ OpenRouter (relais) :", fallbackErr.response?.data || fallbackErr.message);
                try {
                    console.warn("🔀 Relais DeepSeek (OpenRouter indisponible aussi)...");
                    return await chatViaDeepSeek({ message, context, useTools, history });
                } catch (deepseekErr) {
                    console.error("❌ DeepSeek (relais) :", deepseekErr.response?.data || deepseekErr.message);
                    return { type: "text", provider: "gemini", text: "SAMII réfléchit un peu plus longtemps que prévu, réessaie dans une minute." };
                }
            }
        }
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

// Les 3 relais de secours partagent le même format OpenAI (chat completions
// + tool_calls) — une seule table à étendre si un nouveau relais s'ajoute.
const OPENAI_COMPATIBLE_PROVIDERS = {
    groq:       { poster: postGroq,       model: GROQ_MODEL },
    openrouter: { poster: postOpenRouter, model: OPENROUTER_MODEL },
    deepseek:   { poster: postDeepSeek,   model: DEEPSEEK_MODEL },
};

async function chatWithFunctionResult({ message, context = {}, functionName, functionArgs, functionResult, thoughtSignature, provider = "gemini", toolCallId, assistantMessage, history = [] }) {
    // Le tour a démarré sur un relais de secours (Gemini indisponible pour
    // ce tour) — on doit continuer sur le MÊME fournisseur : les formats
    // "suite d'appel de fonction" de Gemini et OpenAI sont structurellement
    // incompatibles (impossible de rejouer un functionCall Gemini en
    // tool_call OpenAI).
    if (OPENAI_COMPATIBLE_PROVIDERS[provider]) {
        const { poster, model } = OPENAI_COMPATIBLE_PROVIDERS[provider];
        try {
            const prompt = await SAMII_PROMPT(message, context);
            const messages = [
                ...history.map(h => ({ role: h.role === "model" ? "assistant" : "user", content: h.message })),
                { role: "user", content: prompt },
                assistantMessage,
                { role: "tool", tool_call_id: toolCallId, content: JSON.stringify(functionResult) },
            ];
            const response = await poster({ model, messages });
            const text = response.data.choices?.[0]?.message?.content;
            return text || "C'est fait ✅";
        } catch (err) {
            console.error(`❌ ${provider} (function result) :`, err.response?.data || err.message);
            return "C'est fait ✅";
        }
    }
    try {
        const prompt = await SAMII_PROMPT(message, context);
        const modelPart = { functionCall: { name: functionName, args: functionArgs } };
        if (thoughtSignature) modelPart.thoughtSignature = thoughtSignature;
        const body = {
            contents: [
                { role: "user", parts: [{ text: prompt }] },
                { role: "model", parts: [modelPart] },
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

module.exports = { send, chat, chatWithFunctionResult, chatWithSearch, chatViaOpenRouter, summarize, receive, TOOLS };
