// ==========================================================================
// SAMII OS — MÉMOIRE STRUCTURÉE UTILISATEUR
// ==========================================================================
// Différent de samiiMemoire.js (l'historique brut des conversations) : ici
// on garde une FICHE synthétique par utilisateur — activité, projets en
// cours, préférences — pour que SAMII puisse s'y référer sans avoir à
// relire 150 messages à chaque fois ("Ton projet précédent était déjà
// orienté vers X..."). Alimentée automatiquement après chaque tour de
// conversation web (routes/api.js), jamais en interrogeant l'utilisateur.
//
// Le profil de base (nom, langue, pays, métier) existe déjà en colonnes
// réelles sur `utilisateurs` — inutile de le dupliquer ici, on le lit
// directement dans get().
const db = require("../services/db");
const gemini = require("../services/geminiService");

const FORME_VIDE = { activite: {}, preferences: {}, note_libre: "" };

function extraireJson(texte) {
    if (!texte) return null;
    const nettoye = texte.replace(/```json/gi, "").replace(/```/g, "").trim();
    const debut = nettoye.indexOf("{");
    const fin = nettoye.lastIndexOf("}");
    if (debut === -1 || fin === -1 || fin < debut) return null;
    try {
        return JSON.parse(nettoye.slice(debut, fin + 1));
    } catch {
        return null;
    }
}

// Renvoie la fiche complète (profil réel + mémoire structurée) prête à
// injecter dans le contexte du prompt.
async function get(userId) {
    if (!userId) return null;
    try {
        const rows = await db.query(
            `SELECT nom, prenom, langue_preferee, pays, metier, memoire, directives_permanentes FROM utilisateurs WHERE id = $1`,
            [userId]
        );
        const u = rows[0];
        if (!u) return null;
        return {
            profil: { nom: u.nom, prenom: u.prenom, langue: u.langue_preferee, pays: u.pays, metier: u.metier },
            ...FORME_VIDE,
            ...(u.memoire || {}),
            directives_permanentes: u.directives_permanentes || "",
        };
    } catch (err) {
        console.error("❌ memoireUtilisateur.get :", err.message);
        return null;
    }
}

async function fusionner(userId, patch) {
    if (!userId || !patch || typeof patch !== "object") return;
    try {
        const rows = await db.query(`SELECT memoire FROM utilisateurs WHERE id = $1`, [userId]);
        const actuelle = rows[0]?.memoire || {};
        const fusionnee = {
            activite: { ...(actuelle.activite || {}), ...(patch.activite || {}) },
            preferences: { ...(actuelle.preferences || {}), ...(patch.preferences || {}) },
            note_libre: patch.note_libre || actuelle.note_libre || "",
        };
        await db.query(`UPDATE utilisateurs SET memoire = $1 WHERE id = $2`, [JSON.stringify(fusionnee), userId]);
    } catch (err) {
        console.error("❌ memoireUtilisateur.fusionner :", err.message);
    }
}

// Fire-and-forget : appelée après avoir déjà répondu à l'utilisateur,
// n'affecte jamais le temps de réponse ni la conversation en cours si elle
// échoue. Ne mémorise QUE ce qui change réellement l'un des trois axes
// (activité, préférences, note libre) — jamais de bruit conversationnel.
async function extraireEtMemoriser(userId, messageUser, reponseSami) {
    if (!userId || !messageUser) return;
    try {
        const prompt = `Voici un échange entre un utilisateur et SAMII (assistant business).

Utilisateur : ${messageUser}
SAMII : ${reponseSami || ""}

Si cet échange révèle une information DURABLE et utile sur l'utilisateur ou son activité (son secteur, ses produits/services, les canaux/outils qu'il utilise, un projet en cours, une préférence de travail ou de communication), extrais-la. Sinon, réponds avec des objets vides.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, dans ce format exact (uniquement les champs nouveaux/à mettre à jour, ignore le reste) :
{"activite": {"secteur": "", "produits_services": "", "canaux": "", "outils": ""}, "preferences": {"style_communication": "", "preferences_travail": ""}, "note_libre": ""}`;

        const result = await gemini.chat({ message: prompt, context: { source: "memoire", workspaceId: "" }, useTools: false });
        const patch = result.type === "text" ? extraireJson(result.text) : null;
        if (!patch) return;

        const vide = (obj) => !obj || Object.values(obj).every(v => !v);
        if (vide(patch.activite) && vide(patch.preferences) && !patch.note_libre) return;

        await fusionner(userId, patch);
    } catch (err) {
        console.error("❌ memoireUtilisateur.extraireEtMemoriser :", err.message);
    }
}

// Directives permanentes : contrairement au reste de cette fiche (extrait
// automatiquement par l'IA, probabiliste), ce champ est écrit DIRECTEMENT
// par l'utilisateur — un réglage fiable et garanti, pas une supposition.
async function setDirectives(userId, texte) {
    if (!userId) return false;
    try {
        await db.query(`UPDATE utilisateurs SET directives_permanentes = $1 WHERE id = $2`, [(texte || "").trim().slice(0, 2000), userId]);
        return true;
    } catch (err) {
        console.error("❌ memoireUtilisateur.setDirectives :", err.message);
        return false;
    }
}

module.exports = { get, fusionner, extraireEtMemoriser, setDirectives };
