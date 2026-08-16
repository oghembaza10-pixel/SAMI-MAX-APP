/**
 * ============================================================
 * OG • Canal Engine — SAMII gère seul le canal Telegram public
 * (pub/acquisition, distinct de la communauté qui répond aux membres)
 * ============================================================
 * Le bot partagé (CONFIG.TELEGRAM.BOT_TOKEN) doit être ADMIN du canal
 * (CONFIG.TELEGRAM.CHANNEL_USERNAME) avec le droit "Publier des messages",
 * sinon Telegram renvoie une erreur 403 à chaque tentative.
 */
const gemini = require("../services/geminiService");
const telegramService = require("../services/telegramService");
const CONFIG = require("../config");

// Pas de liste fermée d'angles ni de rotation mécanique : SAMII choisit
// lui-même son sujet et sa langue à chaque publication, librement, en
// s'appuyant sur ce qu'il connaît réellement de la plateforme (catalogue +
// guide, injectés par SAMII_PROMPT pour l'audience "souverain"). Ces
// catégories ne sont qu'une inspiration, pas des phrases à reprendre telles
// quelles — SAMII peut aussi en inventer d'autres.
const INSPIRATIONS = [
    "une fonctionnalité précise de la plateforme",
    "un témoignage/scénario type d'un marchand qui utilise SAMII",
    "un conseil pratique pour vendre en ligne en Algérie/Maroc",
    "une question qui engage la conversation",
    "une comparaison avant/après SAMII",
    "une astuce liée à l'Academy ou au parrainage",
    "un ton proche, presque une blague ou une observation du quotidien d'un marchand",
];

function construirePrompt() {
    return `Tu es SAMII, et tu gères toi-même le canal Telegram public officiel de la plateforme SAMII OS (destiné aux entrepreneurs et marchands d'Algérie, du Maroc et plus largement du monde arabophone/francophone qui veulent automatiser la gestion de leur activité).

Rédige UN SEUL post, prêt à publier tel quel dans ce canal — pas de JSON, pas de balises, pas de titre "Post :", juste le texte final du message.

Choisis TOI-MÊME le sujet et l'angle de ce post, librement — inspire-toi si tu veux d'une de ces pistes (sans t'y limiter, invente aussi les tiennes) : ${INSPIRATIONS.join(" / ")}.
Choisis aussi TOI-MÊME la langue/le ton : varie réellement d'une publication à l'autre entre français, arabe, darija algérienne, darija marocaine, ou un mélange naturel — jamais toujours la même formule.
Ne répète jamais un post que tu as déjà pu écrire par le passé — sois créatif et surprenant à chaque fois, ce canal doit donner l'impression d'être vivant, pas d'un robot qui tourne en boucle.

Consignes :
- Ton chaleureux et direct, comme un vrai post humain écrit par quelqu'un qui connaît vraiment la plateforme — jamais une traduction mot à mot entre langues.
- Quelques emojis avec modération, des sauts de ligne pour l'aération (format canal Telegram, pas un pavé de texte).
- Termine toujours par un appel à l'action clair vers l'inscription, en citant le lien https://samii.souverain-store.com
- Ne mens jamais et n'invente jamais une fonctionnalité qui n'existe pas.
- Reste sous 800 caractères.`;
}

async function genererPost() {
    const result = await gemini.chat({
        message: construirePrompt(),
        context: { source: "canal", workspaceId: "", audience: "souverain" },
        useTools: false,
    });
    return result.type === "text" ? result.text.trim() : "";
}

// Envoie au canal en réessayant sans parsing Markdown si le texte généré
// contient des astérisques/underscores non équilibrés (Telegram rejette
// alors l'appel avec "can't parse entities").
async function publier(texte) {
    if (!texte) return { success: false, error: "Texte vide." };
    const channel = CONFIG.TELEGRAM.CHANNEL_USERNAME;
    let resultat = await telegramService.send(channel, texte, null, "Markdown");
    if (!resultat.success) {
        console.warn("⚠️ Canal SAMII : échec en Markdown, nouvel essai en texte brut...");
        resultat = await telegramService.send(channel, texte, null, null);
    }
    return resultat;
}

async function runDaily() {
    try {
        const texte = await genererPost();
        if (!texte) {
            console.warn("⚠️ Canal SAMII : SAMII n'a pas généré de texte, publication annulée.");
            return;
        }
        const resultat = await publier(texte);
        if (resultat.success) {
            console.log(`✅ Canal SAMII : post publié sur ${CONFIG.TELEGRAM.CHANNEL_USERNAME}.`);
        } else {
            console.error(`❌ Canal SAMII : échec de publication —`, resultat.error);
        }
    } catch (err) {
        console.error("❌ Canal Engine runDaily :", err.message);
    }
}

// Utilisé par le bouton admin "Publier maintenant" — génère ET publie
// immédiatement, renvoie le texte publié pour vérification humaine.
async function posterMaintenant() {
    const texte = await genererPost();
    if (!texte) return { success: false, error: "SAMII n'a pas généré de texte." };
    const resultat = await publier(texte);
    return { ...resultat, texte };
}

module.exports = { runDaily, genererPost, posterMaintenant };
