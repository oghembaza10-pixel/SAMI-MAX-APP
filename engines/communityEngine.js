/**
 * ============================================================
 * OG • Community Engine — SAMII anime le tchat général de la
 * plateforme (routes/discussions.js), clairement identifié comme IA
 * (utilisateurs.type_compte='ia', jamais un compte humain).
 * Miroir de engines/pageEngine.js (Facebook/Instagram) et
 * engines/canalEngine.js (Telegram) : SAMII choisit librement son
 * sujet, jamais une liste fermée qui tourne en boucle. Contrairement
 * aux réponses réactives (routes/discussions.js repondreCommeSamii),
 * ceci lance une discussion, ça ne répond pas à une question précise.
 * ============================================================
 */
const db = require("../services/db");
const socketService = require("../services/socketService");
const geminiService = require("../services/geminiService");
const CONFIG = require("../config");

const SAMII_USER_ID = CONFIG.SAMII_IA_USER_ID;

const THEMES = [
    "actualité et nouveautés en intelligence artificielle",
    "astuce concrète de dropshipping/e-commerce",
    "conseil sur la publicité et le marketing digital",
    "réflexion sur l'entrepreneuriat en Algérie/Maroc",
    "question ouverte pour lancer une vraie discussion avec les membres",
];

function construirePrompt() {
    return `Tu es SAMII, l'IA de la plateforme, et tu lances un sujet de discussion dans le tchat général qui réunit de vrais marchands/clients de SAMII OS (Algérie/Maroc, francophone/arabophone).

Rédige UN SEUL message, prêt à publier tel quel — pas de JSON, pas de balises, pas de titre, juste le texte final.

Choisis TOI-MÊME le thème parmi ceux-ci (sans t'y limiter) : ${THEMES.join(" / ")}.
Écris comme un vrai message de tchat, pas un post Instagram : direct, court (2-5 phrases), qui donne vraiment envie de répondre — termine idéalement par une vraie question ouverte aux membres.
Varie la langue/le dialecte d'un message à l'autre (français, arabe, darija algérienne, darija marocaine).
Ne répète jamais un sujet déjà traité récemment — sois créatif.
Ne mens jamais et n'invente jamais un fait, un chiffre ou une actualité que tu ne connais pas vraiment.
Quelques emojis avec modération.`;
}

async function genererMessage() {
    const result = await geminiService.chat({
        message: construirePrompt(),
        context: { source: "community_engine", audience: "community" },
        useTools: false,
    });
    return result.type === "text" ? result.text.trim() : "";
}

async function getOrCreateGeneral() {
    const rows = await db.query(`SELECT * FROM discussions WHERE type = 'general' LIMIT 1`);
    if (rows[0]) return rows[0];
    const created = await db.query(
        `INSERT INTO discussions (type, nom, created_by) VALUES ('general','Chat général SAMII',NULL) RETURNING *`
    );
    return created[0];
}

async function publier(texte) {
    if (!texte) return { success: false, error: "Texte vide." };
    try {
        const discussion = await getOrCreateGeneral();
        const rows = await db.query(
            `INSERT INTO discussion_messages (discussion_id, expediteur_id, contenu, type) VALUES ($1,$2,$3,'texte') RETURNING *`,
            [discussion.id, SAMII_USER_ID, texte]
        );
        const message = rows[0];
        await db.query(`UPDATE discussions SET updated_at = now() WHERE id = $1`, [discussion.id]);

        socketService.emitToShop(`discussion-${discussion.id}`, "nouveau-message-discussion", {
            discussion_id: discussion.id,
            expediteur_id: SAMII_USER_ID,
            contenu: message.contenu,
            nom_auteur: "SAMII 🤖",
            nom_initiales: "IA",
            est_ia: true,
            created_at: message.created_at,
        });
        return { success: true };
    } catch (err) {
        console.error("❌ Community Engine :", err.message);
        return { success: false, error: err.message };
    }
}

async function run() {
    const texte = await genererMessage();
    const resultat = await publier(texte);
    console.log(resultat.success ? "✅ Community Engine : sujet lancé." : `❌ Community Engine : ${resultat.error}`);
}

// Utilisé par le bouton admin "Publier maintenant" — génère ET publie
// immédiatement, renvoie le texte pour vérification humaine.
async function posterMaintenant() {
    const texte = await genererMessage();
    if (!texte) return { success: false, error: "SAMII n'a pas généré de texte." };
    const resultat = await publier(texte);
    return { ...resultat, texte };
}

module.exports = { run, genererMessage, publier, posterMaintenant };
