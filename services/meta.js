// ==========================================================================
// OG TECHNOLOGY — SERVICE META (Facebook / Instagram / Ads) — MULTI-COMPTES
// ==========================================================================
const axios = require("axios");
const GRAPH_VERSION = "v25.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

function checkCreds(creds) {
    if (!creds?.accessToken) throw new Error("accessToken Meta manquant pour ce workspace.");
    if (!creds?.adAccountId) throw new Error("adAccountId Meta manquant pour ce workspace.");
}

// Diagnostic direct : liste les permissions réellement accordées par
// l'utilisateur sur le token actuel (granted/declined), équivalent au
// test-meta.js qu'on lançait avant en terminal — sauf qu'ici ça tourne
// avec le vrai token déjà enregistré, sans rien copier-coller.
async function getPermissions(accessToken) {
    const res = await axios.get(`${BASE_URL}/me/permissions`, {
        params: { access_token: accessToken },
    });
    return res.data.data || [];
}

async function getPages(creds) {
    const res = await axios.get(`${BASE_URL}/me/accounts`, {
        params: { access_token: creds.accessToken },
    });
    return res.data.data;
}

async function getAdAccountInfo(creds) {
    checkCreds(creds);
    const res = await axios.get(`${BASE_URL}/${creds.adAccountId}`, {
        params: {
            fields: "name,account_status,currency,amount_spent,balance",
            access_token: creds.accessToken,
        },
    });
    return res.data;
}

async function createCampaign(creds, name, objective = "OUTCOME_TRAFFIC") {
    checkCreds(creds);
    const res = await axios.post(`${BASE_URL}/${creds.adAccountId}/campaigns`, null, {
        params: {
            name,
            objective,
            status: "PAUSED",
            special_ad_categories: JSON.stringify([]),
            is_adset_budget_sharing_enabled: false,
            access_token: creds.accessToken,
        },
    });
    return res.data;
}

async function createAdSet(creds, campaignId, params) {
    checkCreds(creds);
    const {
        name,
        dailyBudgetCents,
        targeting,
        startTime,
        endTime,
        optimizationGoal = "LINK_CLICKS",
        billingEvent = "IMPRESSIONS",
    } = params;

    const res = await axios.post(`${BASE_URL}/${creds.adAccountId}/adsets`, null, {
        params: {
            name,
            campaign_id: campaignId,
            daily_budget: dailyBudgetCents,
            billing_event: billingEvent,
            optimization_goal: optimizationGoal,
            bid_strategy: "LOWEST_COST_WITHOUT_CAP",
            targeting: JSON.stringify(targeting),
            start_time: startTime,
            end_time: endTime,
            status: "PAUSED",
            access_token: creds.accessToken,
        },
    });
    return res.data;
}

async function createAdCreative(creds, params) {
    checkCreds(creds);
    if (!creds.pageId) throw new Error("pageId Meta manquant pour ce workspace.");
    const { imageUrl, message, headline, link } = params;

    const res = await axios.post(`${BASE_URL}/${creds.adAccountId}/adcreatives`, null, {
        params: {
            name: `Créa - ${headline}`,
            object_story_spec: JSON.stringify({
                page_id: creds.pageId,
                link_data: { picture: imageUrl, message, name: headline, link },
            }),
            access_token: creds.accessToken,
        },
    });
    return res.data;
}

async function createAd(creds, adSetId, creativeId, name) {
    checkCreds(creds);
    const res = await axios.post(`${BASE_URL}/${creds.adAccountId}/ads`, null, {
        params: {
            name,
            adset_id: adSetId,
            creative: JSON.stringify({ creative_id: creativeId }),
            status: "PAUSED",
            access_token: creds.accessToken,
        },
    });
    return res.data;
}

async function setStatus(creds, objectId, status) {
    checkCreds(creds);
    const res = await axios.post(`${BASE_URL}/${objectId}`, null, {
        params: { status, access_token: creds.accessToken },
    });
    return res.data;
}

async function getInsights(creds, objectId) {
    checkCreds(creds);
    const res = await axios.get(`${BASE_URL}/${objectId}/insights`, {
        params: {
            fields: "impressions,clicks,spend,ctr,cpc,reach",
            access_token: creds.accessToken,
        },
    });
    return res.data.data[0] || null;
}

// ── UNE VIDÉO N'EST PAS UNE PHOTO, ET MÊME LE CHAMP CHANGE ────────────────
//
// Relevé en production le 3 septembre :
//
//     facebook — meta : Invalid parameter
//
// Un post en texte seul était passé une heure plus tôt ; celui avec une
// vidéo a échoué. La cause : le média voyageait sous le nom `imageUrl`
// depuis le tout début de la chaîne, et arrivait ici en `/{page}/photos`
// avec `url=…mp4`. Meta refuse — et « Invalid parameter » ne dit pas
// lequel.
//
// Chez Meta, ce ne sont pas seulement deux points d'entrée différents,
// c'est aussi deux noms de paramètres : `url` + `message` pour une photo,
// `file_url` + `description` pour une vidéo. Trois différences dans un
// appel qui se ressemble — d'où l'intérêt de les écrire côte à côte ici
// plutôt que de laisser un appelant les deviner.
async function publishPagePost(creds, { message, imageUrl, videoUrl, scheduledTime }) {
    if (!creds.pageId) throw new Error("pageId Meta manquant pour ce workspace.");
    if (!creds.accessToken) throw new Error("accessToken Meta manquant pour ce workspace.");

    const params = { access_token: creds.accessToken };
    let endpoint;

    if (videoUrl) {
        endpoint = "videos";
        params.file_url = videoUrl;
        params.description = message;       // et non `message`
    } else if (imageUrl) {
        endpoint = "photos";
        params.url = imageUrl;
        params.message = message;
    } else {
        endpoint = "feed";
        params.message = message;
    }

    if (scheduledTime) {
        params.published = false;
        params.scheduled_publish_time = Math.floor(new Date(scheduledTime).getTime() / 1000);
    }

    const res = await axios.post(`${BASE_URL}/${creds.pageId}/${endpoint}`, null, { params });
    return res.data;
}

// ── INSTAGRAM : UNE VIDÉO EST UN REEL, ET IL FAUT L'ATTENDRE ──────────────
//
// Deux différences avec une image, et la seconde est celle qu'on oublie :
//
//   1. le conteneur se déclare `media_type: REELS` avec `video_url`, pas
//      `image_url` ;
//   2. Instagram TÉLÉCHARGE et transcode la vidéo avant de la publier. Le
//      conteneur revient immédiatement, mais il n'est pas prêt. Publier
//      tout de suite échoue avec une erreur qui parle du conteneur, pas
//      de la vidéo. On attend donc que son `status_code` passe à FINISHED.
//
// L'attente est bornée : mieux vaut renoncer en le disant qu'occuper le
// publieur pendant que la file s'allonge derrière.
async function publishInstagramPost(creds, { imageUrl, videoUrl, caption }) {
    if (!creds?.igAccountId) throw new Error("Compte Instagram non connecté pour ce workspace.");
    if (!creds?.accessToken) throw new Error("Token Meta manquant pour ce workspace.");

    const params = { caption, access_token: creds.accessToken };
    if (videoUrl) { params.media_type = "REELS"; params.video_url = videoUrl; }
    else params.image_url = imageUrl;

    const containerRes = await axios.post(`${BASE_URL}/${creds.igAccountId}/media`, null, { params });
    const creationId = containerRes.data.id;

    if (videoUrl) await attendreConteneur(creds, creationId);

    const publishRes = await axios.post(`${BASE_URL}/${creds.igAccountId}/media_publish`, null, {
        params: { creation_id: creationId, access_token: creds.accessToken },
    });
    return publishRes.data;
}

// Jusqu'à ~90 s : au-delà, la vidéo est trop lourde ou Instagram est en
// difficulté, et dans les deux cas réessayer plus tard vaut mieux que
// bloquer la file.
async function attendreConteneur(creds, creationId, { essais = 18, pause = 5000 } = {}) {
    for (let i = 0; i < essais; i++) {
        const r = await axios.get(`${BASE_URL}/${creationId}`, {
            params: { fields: "status_code,status", access_token: creds.accessToken },
        });
        const etat = r.data?.status_code;
        if (etat === "FINISHED") return true;
        if (etat === "ERROR") throw new Error(`Instagram a rejeté la vidéo : ${r.data?.status || "sans détail"}`);
        await new Promise((r2) => setTimeout(r2, pause));
    }
    throw new Error(`la vidéo n'était toujours pas prête après ${Math.round(essais * pause / 1000)} s côté Instagram`);
}

async function sendMessage(pageAccessToken, recipientId, text) {
    if (!pageAccessToken) throw new Error("pageAccessToken Meta manquant pour répondre à ce contact.");
    const res = await axios.post(`${BASE_URL}/me/messages`, {
        recipient: { id: recipientId },
        message: { text },
    }, { params: { access_token: pageAccessToken } });
    return res.data;
}

// Répond à un commentaire public sous un post de Page — crée un
// sous-commentaire, visible par tout le monde (contrairement à sendMessage
// qui répond en privé). Même endpoint pour commenter un post ou répondre à
// un commentaire existant : POST /{comment-id}/comments.
async function replyToFacebookComment(pageAccessToken, commentId, message) {
    if (!pageAccessToken) throw new Error("pageAccessToken Meta manquant pour répondre à ce commentaire.");
    const res = await axios.post(`${BASE_URL}/${commentId}/comments`, null, {
        params: { message, access_token: pageAccessToken },
    });
    return res.data;
}

// Idem pour un commentaire Instagram (endpoint dédié /replies côté IG).
async function replyToInstagramComment(pageAccessToken, commentId, message) {
    if (!pageAccessToken) throw new Error("pageAccessToken Meta manquant pour répondre à ce commentaire.");
    const res = await axios.post(`${BASE_URL}/${commentId}/replies`, null, {
        params: { message, access_token: pageAccessToken },
    });
    return res.data;
}

module.exports = {
    getPermissions,
    getPages,
    getAdAccountInfo,
    createCampaign,
    createAdSet,
    createAdCreative,
    createAd,
    setStatus,
    getInsights,
    publishPagePost,
    publishInstagramPost,
    sendMessage,
    replyToFacebookComment,
    replyToInstagramComment,
};
