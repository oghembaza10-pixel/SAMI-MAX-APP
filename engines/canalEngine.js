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

// Un angle différent par jour de l'année — évite de répéter toujours le
// même post, sans avoir besoin de mémoriser un historique côté serveur.
const ANGLES = [
    "L'automatisation des commandes sur WhatsApp et Telegram : SAMII répond aux clients et confirme les commandes à la place du marchand, jour et nuit.",
    "Créer sa boutique / son QG SAMII en quelques minutes, sans aucune connaissance technique.",
    "Le Griot SAMII : génération automatique de contenu marketing (vidéos, posts, légendes) pour les réseaux sociaux du marchand.",
    "La Marketplace SAMII : vendre du local en Algérie/Maroc, ou importer des produits déjà prêts à revendre.",
    "L'Academy SAMII : apprendre l'e-commerce étape par étape, gratuitement, directement dans l'app.",
    "Le programme de parrainage SAMII : gagner une commission récurrente en invitant d'autres marchands à rejoindre.",
    "Le gain de temps réel : ce que ça change au quotidien pour un marchand qui gérait tout seul ses commandes et rendez-vous avant SAMII.",
    "SAMII qui prend des rendez-vous automatiquement (dentiste, coiffeur, tout métier sur rendez-vous) directement depuis une conversation Telegram.",
];

function angleDuJour() {
    const jourAnnee = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    return ANGLES[jourAnnee % ANGLES.length];
}

function construirePrompt(angle) {
    return `Tu es SAMII, et tu gères toi-même le canal Telegram public officiel de la plateforme SAMII OS (destiné aux entrepreneurs et marchands d'Algérie et du Maroc, qui veulent automatiser la gestion de leur activité).

Rédige UN SEUL post, prêt à publier tel quel dans ce canal — pas de JSON, pas de balises, pas de titre "Post :", juste le texte final du message.

Angle du jour : ${angle}

Consignes :
- Ton chaleureux et direct, mélange naturel français/darija comme le fait déjà la vraie communauté SAMII — pas une traduction mot à mot, écris comme un vrai post humain.
- Quelques emojis avec modération, des sauts de ligne pour l'aération (format canal Telegram, pas un pavé de texte).
- Termine toujours par un appel à l'action clair vers l'inscription, en citant le lien https://samii.souverain-store.com
- Ne mens jamais et n'invente jamais une fonctionnalité qui n'existe pas.
- Reste sous 800 caractères.`;
}

async function genererPost(angle = angleDuJour()) {
    const result = await gemini.chat({
        message: construirePrompt(angle),
        context: { source: "canal", workspaceId: "" },
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
