/**
 * ============================================================
 * OG • Page Engine — SAMII gère seul les pages Facebook/Instagram
 * officielles d'OG Technology (miroir de engines/canalEngine.js pour
 * Telegram, même philosophie : SAMII choisit librement son sujet et son
 * angle, jamais de liste fermée qui tourne en boucle).
 * ============================================================
 * Contrairement au canal Telegram, Instagram exige TOUJOURS une image pour
 * publier (l'API ne permet pas un post texte seul) — on réutilise la
 * bannière SAMII déjà hébergée par l'app, la légende varie librement.
 */
const gemini = require("../services/geminiService");
const meta = require("../services/meta");
const connectorService = require("../services/connectorService");
const CONFIG = require("../config");

const THEMES = [
    "développement personnel / mindset entrepreneurial",
    "actualité et nouveautés en intelligence artificielle",
    "conseils e-commerce concrets",
    "publicité et marketing digital",
    "business en général, tous secteurs confondus",
];

function construirePrompt(reseau) {
    return `Tu es SAMII, et tu gères toi-même la page ${reseau === "instagram" ? "Instagram" : "Facebook"} officielle d'OG Technology (SAMII OS), destinée à un public d'entrepreneurs et de porteurs de projets, pas seulement en Algérie/Maroc mais plus largement francophone/arabophone.

Rédige UN SEUL post, prêt à publier tel quel — pas de JSON, pas de balises, pas de titre "Post :", juste le texte final (la légende).

Choisis TOI-MÊME le thème parmi ceux-ci (sans t'y limiter, tu peux aussi en inventer d'autres) : ${THEMES.join(" / ")}.
La majorité des posts doivent apporter une vraie valeur (conseil, réflexion, actu) — pas juste "inscris-toi" à chaque fois. Le lien vers SAMII (https://samii.souverain-store.com) peut apparaître naturellement quand c'est pertinent, jamais forcé à chaque post.
Écris principalement en arabe (arabe standard ou darija algérienne/marocaine selon ce qui sonne le plus naturel pour le sujet) — c'est la langue par défaut de la page. Tu peux mélanger quelques mots de français si c'est naturel (comme le fait vraiment un entrepreneur bilingue), mais le post doit rester majoritairement en arabe.
Ne répète jamais un post déjà écrit par le passé — sois créatif, chaque post doit sembler écrit par une vraie personne qui a réfléchi à ce sujet précis aujourd'hui.

Consignes :
- Ton direct, humain, jamais un communiqué de presse.
- Rends le post visuellement accrocheur : emojis pertinents (pas juste à la fin, répartis dans le texte), et quand le sujet s'y prête, une petite liste à puces (avec des emojis en puces, ex: ✅ 🔥 📌 ➡️) plutôt qu'un pavé de texte plat.
- Des sauts de ligne pour l'aération, jamais un mur de texte.
- Ne mens jamais et n'invente jamais une fonctionnalité qui n'existe pas.
- Reste sous 600 caractères.`;
}

async function genererPost(reseau) {
    const result = await gemini.chat({
        message: construirePrompt(reseau),
        context: { source: `page_${reseau}`, workspaceId: "", audience: "souverain" },
        useTools: false,
    });
    return result.type === "text" ? result.text.trim() : "";
}

// Dérive les creds nécessaires à partir de ce qui est réellement enregistré
// dans connecteurs — tolérant aux deux formats rencontrés (ancienne
// connexion incomplète "pages: [...]" + "accessToken", ou format actuel
// "pageId" + "pageAccessToken" produit par le flux OAuth /auth/meta).
function resolveFacebookCreds(config = {}) {
    return {
        pageId: config.pageId || config.pages?.[0]?.id || "",
        accessToken: config.pageAccessToken || config.accessToken || "",
    };
}

function resolveInstagramCreds(config = {}, pageAccessToken = "") {
    return {
        igAccountId: config.igAccountId || "",
        accessToken: config.pageAccessToken || pageAccessToken || config.accessToken || "",
    };
}

async function publierFacebook(texte) {
    if (!texte) return { success: false, error: "Texte vide." };
    try {
        const connecteur = await connectorService.getOne(CONFIG.META.OG_WORKSPACE_ID, "facebook");
        const creds = resolveFacebookCreds(connecteur?.config);
        if (!creds.pageId || !creds.accessToken) {
            return { success: false, error: "Page Facebook non connectée (pageId ou token manquant) — reconnecte Meta depuis le QG." };
        }
        await meta.publishPagePost(creds, { message: texte });
        return { success: true };
    } catch (err) {
        console.error("❌ Page Engine (Facebook) :", err.response?.data || err.message);
        return { success: false, error: err.response?.data?.error?.message || err.message };
    }
}

async function publierInstagram(texte) {
    if (!texte) return { success: false, error: "Texte vide." };
    try {
        const [fbConnecteur, igConnecteur] = await Promise.all([
            connectorService.getOne(CONFIG.META.OG_WORKSPACE_ID, "facebook"),
            connectorService.getOne(CONFIG.META.OG_WORKSPACE_ID, "instagram"),
        ]);
        const fbToken = resolveFacebookCreds(fbConnecteur?.config).accessToken;
        const creds = resolveInstagramCreds(igConnecteur?.config, fbToken);
        if (!creds.igAccountId || !creds.accessToken) {
            return { success: false, error: "Compte Instagram non connecté (igAccountId manquant) — reconnecte Meta depuis le QG pour le relier." };
        }
        const imageUrl = `${CONFIG.APP_URL}/banner-tech.png`;
        await meta.publishInstagramPost(creds, { imageUrl, caption: texte });
        return { success: true };
    } catch (err) {
        console.error("❌ Page Engine (Instagram) :", err.response?.data || err.message);
        return { success: false, error: err.response?.data?.error?.message || err.message };
    }
}

async function runFacebook() {
    const texte = await genererPost("facebook");
    const resultat = await publierFacebook(texte);
    console.log(resultat.success ? "✅ Page Engine : post Facebook publié." : `❌ Page Engine (Facebook) : ${resultat.error}`);
}

async function runInstagram() {
    const texte = await genererPost("instagram");
    const resultat = await publierInstagram(texte);
    console.log(resultat.success ? "✅ Page Engine : post Instagram publié." : `❌ Page Engine (Instagram) : ${resultat.error}`);
}

// Utilisés par les boutons admin "Publier maintenant" — génèrent ET
// publient immédiatement, renvoient le texte pour vérification humaine.
async function posterMaintenantFacebook() {
    const texte = await genererPost("facebook");
    if (!texte) return { success: false, error: "SAMII n'a pas généré de texte." };
    const resultat = await publierFacebook(texte);
    return { ...resultat, texte };
}

async function posterMaintenantInstagram() {
    const texte = await genererPost("instagram");
    if (!texte) return { success: false, error: "SAMII n'a pas généré de texte." };
    const resultat = await publierInstagram(texte);
    return { ...resultat, texte };
}

module.exports = {
    runFacebook, runInstagram,
    genererPost, publierFacebook, publierInstagram,
    posterMaintenantFacebook, posterMaintenantInstagram,
};
