/**
 * ============================================================
 * OG • Auto-Post Engine — Sami publie seul, pour n'importe quel marchand
 * ============================================================
 * Contrairement à engines/pageEngine.js (réservé au compte officiel OG
 * Technology, fréquence fixe, texte seul), ce moteur est PAR WORKSPACE :
 * chaque marchand active/désactive, choisit ses canaux et sa fréquence
 * depuis /autopost (voir routes/autopost.js), et Sami génère un vrai
 * visuel (image via Runware pour Facebook/Instagram, vidéo via Runware
 * pour YouTube) à chaque publication, pas juste du texte.
 */
const crypto = require("crypto");
const axios = require("axios");
const db = require("../services/db");
const journalService = require("../services/journalService");
const gemini = require("../services/geminiService");
const meta = require("../services/meta");
const google = require("../services/google");
const connectorService = require("../services/connectorService");
const workspaceService = require("../services/workspaceService");
const CONFIG = require("../config");

const INTERVALLES_MS = {
    quotidien: 24 * 60 * 60 * 1000,
    "3x_semaine": Math.round((7 / 3) * 24 * 60 * 60 * 1000),
    hebdo: 7 * 24 * 60 * 60 * 1000,
};

function extractJson(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch {
        return null;
    }
}

function estDu(config) {
    const intervalle = INTERVALLES_MS[config.frequence] || INTERVALLES_MS.quotidien;
    if (!config.dernierPost) return true;
    return Date.now() - new Date(config.dernierPost).getTime() >= intervalle;
}

async function genererContenu(workspace, sujet) {
    const prompt = `Tu es SAMII, tu gères tout seul le compte réseaux sociaux de "${workspace.nom}" (secteur : ${workspace.metier || "non précisé"}).${sujet ? ` Consignes du marchand sur le ton/sujet à privilégier : ${sujet}` : ""}

Génère UN SEUL post, prêt à publier, qui donne envie de s'intéresser à cette activité (conseil utile, coulisses, mise en avant d'un produit/service, actualité du secteur — varie les angles). Jamais deux posts identiques.

Réponds UNIQUEMENT en JSON valide, sans texte autour, sans balises markdown :
{ "legende": "le texte du post, avec emojis pertinents, prêt à publier tel quel", "prompt_visuel": "description visuelle détaillée pour illustrer ce post (photo pro, scène concrète liée à l'activité), en anglais" }`;

    const result = await gemini.chat({
        message: prompt,
        context: { source: "autopost", workspaceId: workspace.id, audience: "souverain" },
        useTools: false,
    });
    const text = result.type === "text" ? result.text : "";
    return extractJson(text);
}

// Réutilise le même appel Runware que routes/griot.js — image pour
// Facebook/Instagram, vidéo pour YouTube (Runware facture à la génération,
// $0.14 minimum côté vidéo — voir services/griotCoutService.js pour Griot,
// l'auto-post n'a pas encore de suivi de coût dédié).
async function genererVisuelRunware(promptVisuel, type) {
    const runwareApiKey = CONFIG.RUNWARE?.API_KEY;
    if (!runwareApiKey || !promptVisuel) return null;
    try {
        const task = {
            taskType: type === "video" ? "videoInference" : "imageInference",
            taskUUID: crypto.randomUUID(),
            positivePrompt: promptVisuel,
            numberResults: 1,
            width: 1024,
            height: 1024,
        };
        const res = await axios.post("https://api.runware.ai/v1", [task], {
            headers: { Authorization: `Bearer ${runwareApiKey}` },
            timeout: 90000,
        });
        const item = res.data?.data?.[0];
        return item?.videoURL || item?.imageURL || null;
    } catch (err) {
        console.error("❌ autopostEngine.genererVisuelRunware :", err.response?.data || err.message);
        return null;
    }
}

async function publierFacebook(workspaceId, { legende, imageUrl }) {
    try {
        const connecteur = await connectorService.getOne(workspaceId, "facebook");
        if (!connecteur?.actif || !connecteur.config?.pageAccessToken) {
            return { success: false, error: "Facebook non connecté." };
        }
        await meta.publishPagePost(
            { pageId: connecteur.config.pageId, accessToken: connecteur.config.pageAccessToken },
            { message: legende, imageUrl }
        );
        return { success: true };
    } catch (err) {
        return { success: false, error: err.response?.data?.error?.message || err.message };
    }
}

async function publierInstagram(workspaceId, { legende, imageUrl }) {
    try {
        const connecteur = await connectorService.getOne(workspaceId, "instagram");
        if (!connecteur?.actif || !connecteur.config?.pageAccessToken) {
            return { success: false, error: "Instagram non connecté." };
        }
        await meta.publishInstagramPost(
            { igAccountId: connecteur.config.igAccountId, accessToken: connecteur.config.pageAccessToken },
            { imageUrl, caption: legende }
        );
        return { success: true };
    } catch (err) {
        return { success: false, error: err.response?.data?.error?.message || err.message };
    }
}

async function publierYoutube(workspaceId, { titre, description, videoUrl }) {
    try {
        const videoRes = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 90000 });
        const buffer = Buffer.from(videoRes.data);
        const mimeType = videoRes.headers["content-type"] || "video/mp4";
        return await google.uploadYoutubeVideo(workspaceId, { buffer, mimeType, title: titre, description });
    } catch (err) {
        return { success: false, error: err.response?.data?.error?.message || err.message };
    }
}

async function traiterWorkspace(w) {
    const config = w.auto_post_config || {};
    if (!config.actif || !estDu(config)) return;

    const canaux = config.canaux || [];
    if (!canaux.length) return;

    const pack = await genererContenu(w, config.sujet);
    if (!pack?.legende) return;

    const besoinImage = canaux.includes("facebook") || canaux.includes("instagram");
    const besoinVideo = canaux.includes("youtube");

    const [visuelImage, visuelVideo] = await Promise.all([
        besoinImage ? genererVisuelRunware(pack.prompt_visuel, "image") : Promise.resolve(null),
        besoinVideo ? genererVisuelRunware(pack.prompt_visuel, "video") : Promise.resolve(null),
    ]);

    const resultats = {};
    if (canaux.includes("facebook") && visuelImage) {
        resultats.facebook = await publierFacebook(w.id, { legende: pack.legende, imageUrl: visuelImage });
    }
    if (canaux.includes("instagram") && visuelImage) {
        resultats.instagram = await publierInstagram(w.id, { legende: pack.legende, imageUrl: visuelImage });
    }
    if (canaux.includes("youtube") && visuelVideo) {
        resultats.youtube = await publierYoutube(w.id, {
            titre: pack.legende.slice(0, 90),
            description: pack.legende,
            videoUrl: visuelVideo,
        });
    }

    await workspaceService.update(w.id, {
        auto_post_config: { ...config, dernierPost: new Date().toISOString() },
    });

    await journalService.log({ action: "autopost.publication", details: JSON.stringify(resultats), workspaceId: w.id });

    console.log(`📤 Auto-post (workspace ${w.id}) :`, resultats);
}

async function runCheck() {
    try {
        const rows = await db.query(
            `SELECT id, nom, metier, auto_post_config FROM workspaces WHERE auto_post_config->>'actif' = 'true'`
        );
        for (const w of rows) {
            try {
                await traiterWorkspace(w);
            } catch (err) {
                console.error(`❌ autopostEngine (workspace ${w.id}) :`, err.message);
            }
        }
    } catch (err) {
        console.error("❌ autopostEngine.runCheck :", err.message);
    }
}

module.exports = { runCheck };
