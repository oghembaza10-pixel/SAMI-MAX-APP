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

async function publishPagePost(creds, { message, imageUrl, scheduledTime }) {
    if (!creds.pageId) throw new Error("pageId Meta manquant pour ce workspace.");
    if (!creds.accessToken) throw new Error("accessToken Meta manquant pour ce workspace.");

    const params = { message, access_token: creds.accessToken };
    if (imageUrl) params.url = imageUrl;
    if (scheduledTime) {
        params.published = false;
        params.scheduled_publish_time = Math.floor(new Date(scheduledTime).getTime() / 1000);
    }

    const endpoint = imageUrl ? "photos" : "feed";
    const res = await axios.post(`${BASE_URL}/${creds.pageId}/${endpoint}`, null, { params });
    return res.data;
}

module.exports = {
    getPages,
    getAdAccountInfo,
    createCampaign,
    createAdSet,
    createAdCreative,
    createAd,
    setStatus,
    getInsights,
    publishPagePost,
};
