// ==========================================================================
// SAMII OS — LES TROIS FAÇONS D'ÊTRE SUR WHATSAPP
//
// POURQUOI CE FICHIER EXISTE. Jusqu'ici, SAMII ne savait parler à WhatsApp
// que par Green API. C'était suffisant pour un marchand qui démarre, et
// bloquant pour tous les autres : une entreprise qui a déjà un compte
// WhatsApp Business approuvé et un fournisseur officiel (360dialog, Twilio,
// Meta en direct) ne va pas changer d'infrastructure pour nous. Elle veut
// qu'on se pose AU-DESSUS de la sienne. C'est exactement ce que ce fichier
// permet — et c'est ce qui fait la différence entre « encore un fournisseur
// WhatsApp » et « la couche qui fait tourner l'entreprise ».
//
// TROIS TRANSPORTS, UN SEUL CONTRAT.
//
//   green      Green API. Une instance par numéro, un couple id + token.
//              Le chemin de démarrage : pas de vérification Meta à attendre.
//
//   cloud      L'API Cloud de Meta en direct. L'entreprise possède son WABA
//              et un token permanent d'utilisateur système.
//
//   360dialog  Fournisseur officiel Meta (BSP). Même corps de requête que
//              Cloud — c'est la même API en dessous —, seuls l'URL et l'en-tête
//              d'authentification changent : une clé D360-API-KEY qui identifie
//              déjà le numéro, d'où l'absence d'identifiant dans l'URL.
//
// CE QUI COMPTE ICI. `cloud` et `360dialog` partagent le même format de corps
// ET le même format de webhook entrant. Tout le reste du code n'a donc que
// deux cas à connaître — Green, et la famille Cloud — pas trois.
//
// COMPATIBILITÉ. Un connecteur enregistré avant ce fichier n'a pas de champ
// `fournisseur` : il est lu comme du Green API. Aucun marchand déjà branché ne
// doit rien refaire.
// ==========================================================================
const axios = require("axios");

const GRAPH = "https://graph.facebook.com/v23.0";
const D360 = "https://waba-v2.360dialog.io";

const FOURNISSEURS = {
    green: {
        id: "green",
        nom: "Green API",
        // Ce que le marchand doit coller dans le formulaire.
        champs: ["apiId", "apiToken"],
        formatWebhook: "green",
    },
    cloud: {
        id: "cloud",
        nom: "Meta Cloud API",
        champs: ["phoneNumberId", "token"],
        formatWebhook: "cloud",
    },
    "360dialog": {
        id: "360dialog",
        nom: "360dialog",
        champs: ["apiKey"],
        formatWebhook: "cloud",
    },
};

// Lit le fournisseur d'une config de connecteur. Sans champ explicite, c'est
// un connecteur d'avant ce fichier : Green API (voir COMPATIBILITÉ ci-dessus).
function fournisseurDe(config = {}) {
    const f = config.fournisseur;
    return FOURNISSEURS[f] ? f : "green";
}

// Vrai si ce fournisseur parle le format d'API et de webhook de Meta.
function estFamilleCloud(config = {}) {
    return FOURNISSEURS[fournisseurDe(config)].formatWebhook === "cloud";
}

// Une config est utilisable si tous les champs de son fournisseur sont remplis.
function estComplete(config = {}) {
    const f = FOURNISSEURS[fournisseurDe(config)];
    return f.champs.every((c) => !!String(config[c] || "").trim());
}

// ── Envoi ────────────────────────────────────────────────────────────────
// Un seul point d'entrée, quel que soit le transport. Renvoie toujours
// { success, error? } : aucun appelant ne doit avoir à connaître le
// fournisseur pour envoyer un message.
async function envoyer(config, { to, message }) {
    if (!to || !message) return { success: false, error: "Destinataire ou message manquant." };
    if (!estComplete(config)) return { success: false, error: "WhatsApp non configuré pour cet espace." };

    const fournisseur = fournisseurDe(config);
    try {
        if (fournisseur === "green") {
            await axios.post(
                `https://api.green-api.com/waInstance${config.apiId}/sendMessage/${config.apiToken}`,
                { chatId: `${to}@c.us`, message },
                { timeout: 20000 },
            );
        } else if (fournisseur === "cloud") {
            await axios.post(
                `${GRAPH}/${config.phoneNumberId}/messages`,
                corpsTexte(to, message),
                { headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" }, timeout: 20000 },
            );
        } else {
            // 360dialog : la clé identifie déjà le numéro, pas d'id dans l'URL.
            await axios.post(
                `${D360}/messages`,
                corpsTexte(to, message),
                { headers: { "D360-API-KEY": config.apiKey, "Content-Type": "application/json" }, timeout: 20000 },
            );
        }
        return { success: true };
    } catch (err) {
        const detail = err.response?.data?.error?.message || err.response?.data?.message || err.message;
        console.error(`❌ WhatsApp (${fournisseur}) envoi :`, detail);
        return { success: false, error: detail };
    }
}

function corpsTexte(to, message) {
    // `to` sans "+" ni espaces : les deux API refusent le reste.
    return {
        messaging_product: "whatsapp",
        to: String(to).replace(/[^\d]/g, ""),
        type: "text",
        text: { body: message, preview_url: false },
    };
}

// ── Webhook : le dire au fournisseur ─────────────────────────────────────
// 360dialog accepte qu'on déclare l'URL par API : le marchand n'a alors rien
// à faire dans une console tierce, ce qui supprime l'étape où l'on perd le
// plus de monde. Chez Meta en direct, l'URL se déclare dans le tableau de bord
// développeur de l'entreprise et nous n'y avons aucun droit : on rend l'URL
// pour l'afficher, sans prétendre l'avoir configurée.
async function declarerWebhook(config, url) {
    if (fournisseurDe(config) !== "360dialog") {
        return { automatique: false, url };
    }
    try {
        await axios.post(
            `${D360}/v1/configs/webhook`,
            { url },
            { headers: { "D360-API-KEY": config.apiKey, "Content-Type": "application/json" }, timeout: 15000 },
        );
        return { automatique: true, url };
    } catch (err) {
        // Un échec ici n'empêche pas la connexion : l'envoi fonctionnera, et
        // l'URL sera affichée au marchand pour un réglage manuel. Bloquer la
        // connexion sur cette étape serait pire que la laisser incomplète.
        const detail = err.response?.data?.error?.message || err.response?.data?.message || err.message;
        console.warn("⚠️ 360dialog — déclaration du webhook impossible :", detail);
        return { automatique: false, url, erreur: detail };
    }
}

// ── Webhook : lire ce qui arrive ─────────────────────────────────────────
// Meta et 360dialog envoient la même enveloppe. On en extrait le strict
// nécessaire, dans la même forme que ce que produisait déjà Green API, pour
// que la suite du traitement (routes/webhook-whatsapp.js) reste unique.
//
// Les accusés de réception (statuses : delivered, read) passent par le même
// webhook et ne sont PAS des messages : sans ce filtre, chaque message envoyé
// déclencherait une réponse automatique à nous-mêmes.
function lireWebhookCloud(body) {
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    if (!value || !Array.isArray(value.messages) || !value.messages.length) return null;

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    return {
        phoneNumberId: value.metadata?.phone_number_id || "",
        numeroAffiche: value.metadata?.display_phone_number || "",
        sender: String(message.from || "").replace(/[^\d]/g, ""),
        senderName: contact?.profile?.name || "Client",
        type: message.type || "",
        texte: message.type === "text" ? (message.text?.body || "") : "",
        // Audio : on ne récupère que l'identifiant ici. Le téléchargement
        // demande un appel authentifié séparé (voir telechargerMedia).
        mediaId: (message.audio || message.voice || {}).id || "",
        mediaMime: (message.audio || message.voice || {}).mime_type || "",
    };
}

// Télécharge un média entrant. Deux temps chez Meta : on demande l'URL, puis
// on la lit avec le même jeton. 360dialog expose le média sur son propre
// domaine avec la clé D360. En cas d'échec on renvoie null : un vocal non
// transcrit doit dégrader la conversation, jamais la casser.
async function telechargerMedia(config, mediaId) {
    if (!mediaId) return null;
    const fournisseur = fournisseurDe(config);
    try {
        if (fournisseur === "cloud") {
            const meta = await axios.get(`${GRAPH}/${mediaId}`, {
                headers: { Authorization: `Bearer ${config.token}` }, timeout: 15000,
            });
            const url = meta.data?.url;
            if (!url) return null;
            const fichier = await axios.get(url, {
                headers: { Authorization: `Bearer ${config.token}` },
                responseType: "arraybuffer", timeout: 30000,
            });
            return Buffer.from(fichier.data);
        }
        if (fournisseur === "360dialog") {
            const fichier = await axios.get(`${D360}/${mediaId}`, {
                headers: { "D360-API-KEY": config.apiKey },
                responseType: "arraybuffer", timeout: 30000,
            });
            return Buffer.from(fichier.data);
        }
    } catch (err) {
        console.warn(`⚠️ WhatsApp (${fournisseur}) — média ${mediaId} non récupéré :`, err.response?.status || err.message);
    }
    return null;
}

module.exports = {
    FOURNISSEURS,
    fournisseurDe,
    estFamilleCloud,
    estComplete,
    envoyer,
    declarerWebhook,
    lireWebhookCloud,
    telechargerMedia,
};
