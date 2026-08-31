// ==========================================================================
// SAMII OS — VITRINE PUBLIQUE (chat de la page d'accueil)
//
// Porte d'entrée PUBLIQUE et NON AUTHENTIFIÉE : chaque message coûte de
// l'argent réel en tokens IA et n'est protégé par aucun compte. Tout ici est
// donc verrouillé volontairement :
//   - limite stricte par IP (bien plus serrée que l'apiLimiter général),
//   - message et historique tronqués (un visiteur ne choisit pas la taille
//     du prompt qu'on paie),
//   - aucun outil, aucun accès base d'un autre compte (voir chatLibre),
//   - le prospect capturé va dans sa propre table, jamais dans un workspace.
// ==========================================================================
const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const db = require("../services/db");
const geminiService = require("../services/geminiService");
const SAMII_VITRINE_PROMPT = require("../brain/prompts/vitrine");
const { renderVitrine } = require("./vitrine-page");

// 15 messages / 30 min par IP. Un visiteur sincère qui pose des questions
// n'en envoie jamais autant ; au-delà c'est du test de charge ou de l'abus,
// et c'est nous qui payons les tokens.
const vitrineLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: true,
        reply: "On a bien discuté ! Pour aller plus loin, laisse-moi ton email ou ton WhatsApp — Ouahid te montrera la plateforme en direct.",
        limite: true,
    },
});

const LANGUES = ["fr", "en", "ar", "zh"];
const MAX_MESSAGE = 500;      // au-delà, c'est un copier-coller de document
const MAX_HISTORIQUE = 6;     // 3 allers-retours de contexte, suffisant et borné

// Détecte un email ou un numéro de téléphone laissé par le visiteur dans son
// message, pour l'enregistrer comme prospect. Volontairement simple : on ne
// cherche pas à valider l'adresse, juste à ne pas perdre un contact chaud.
function extraireContact(texte) {
    const email = texte.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/)?.[0] || null;
    const tel = texte.match(/(?:\+|00)\d[\d\s.-]{7,17}\d/)?.[0]?.replace(/[\s.-]/g, "") || null;
    return { email, tel };
}

async function enregistrerProspect({ email, tel, message, langue, ip }) {
    if (!email && !tel) return;
    try {
        await db.query(
            `INSERT INTO prospects_vitrine (email, telephone, message, langue, ip, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [email, tel, message.slice(0, MAX_MESSAGE), langue, ip],
        );
        console.log(`🎯 Nouveau prospect vitrine : ${email || tel}`);
    } catch (err) {
        // Un prospect non enregistré ne doit jamais casser la conversation en
        // cours — le visiteur, lui, ne doit rien voir de cet incident.
        console.error("❌ enregistrerProspect :", err.message);
    }
}

router.post("/chat", vitrineLimiter, async (req, res) => {
    try {
        const messageBrut = String(req.body.message || "").trim();
        if (!messageBrut) {
            return res.json({ success: false, reply: "Pose-moi ta question." });
        }
        const message = messageBrut.slice(0, MAX_MESSAGE);
        const langue = LANGUES.includes(req.body.langue) ? req.body.langue : "fr";

        // L'historique vient du navigateur : on ne lui fait aucune confiance
        // sur la taille ni sur la forme, on le normalise et on le tronque.
        const historique = Array.isArray(req.body.historique)
            ? req.body.historique
                .slice(-MAX_HISTORIQUE)
                .filter(h => h && typeof h.message === "string")
                .map(h => ({
                    role: h.role === "model" ? "model" : "user",
                    message: String(h.message).slice(0, MAX_MESSAGE),
                }))
            : [];

        const nbEchanges = Math.floor(historique.length / 2);
        const systemPrompt = SAMII_VITRINE_PROMPT({ langue, nbEchanges });

        const reponse = await geminiService.chatLibre({ systemPrompt, message, history: historique });

        if (!reponse.text) {
            return res.json({
                success: false,
                reply: "SAMII est momentanément indisponible. Réessaie dans une minute, ou laisse-moi ton email pour qu'on te recontacte.",
            });
        }

        const { email, tel } = extraireContact(message);
        await enregistrerProspect({
            email,
            tel,
            message,
            langue,
            ip: req.ip,
        });

        res.json({ success: true, reply: reponse.text, contactCapture: Boolean(email || tel) });
    } catch (err) {
        console.error("❌ POST /vitrine/chat :", err.message);
        res.json({
            success: false,
            reply: "Une erreur est survenue. Réessaie dans un instant.",
        });
    }
});

// ── SA PHOTO ET SA COUVERTURE ───────────────────────────────────────────
//
// Déclarée AVANT `/:userId`, comme /chat : sinon « apparence » serait pris
// pour l'identifiant d'un marchand et cette route ne serait jamais atteinte.
//
// Elle ne touche que deux colonnes. POST /settings, lui, réécrit d'un bloc
// la photo, la bannière, la bio, le pays, la langue et le thème : appelé
// avec seulement la photo, il aurait vidé les quatre autres. C'est la raison
// d'être de cette route plutôt qu'un appel à celle qui existait.
//
// L'identifiant vient de la SESSION, jamais du corps de la requête : on ne
// peut pas changer la photo de quelqu'un d'autre en modifiant l'envoi.
router.post("/apparence", async (req, res) => {
    if (!req.session?.loggedIn || !req.session?.userId) {
        return res.status(401).json({ success: false, error: "Connecte-toi d'abord." });
    }
    // Une adresse d'image, et rien d'autre : ni javascript:, ni data:. Ces
    // valeurs finissent dans un attribut src affiché à des inconnus, sur le
    // fil comme sur la marketplace.
    const propre = (valeur) => {
        const v = String(valeur ?? "").trim();
        if (!v) return "";
        if (!/^https:\/\//i.test(v)) return null;
        return v.slice(0, 500);
    };

    const champs = { photo_profil_url: null, banniere_url: null, bio_vitrine: null };
    for (const cle of Object.keys(champs)) {
        if (!(cle in req.body)) continue;
        // La présentation est du texte libre, pas une adresse : elle ne passe
        // pas par le même contrôle. Elle est bornée, et échappée à
        // l'affichage comme tout le reste de la page.
        if (cle === "bio_vitrine") {
            champs[cle] = String(req.body[cle] ?? "").trim().slice(0, 800);
            continue;
        }
        const v = propre(req.body[cle]);
        if (v === null) return res.json({ success: false, error: "Adresse d'image invalide." });
        champs[cle] = v;
    }
    const aEcrire = Object.entries(champs).filter(([, v]) => v !== null);
    if (!aEcrire.length) return res.json({ success: false, error: "Rien à enregistrer." });

    try {
        const sets = aEcrire.map(([cle], i) => `${cle} = $${i + 1}`).join(", ");
        await db.query(
            `UPDATE utilisateurs SET ${sets} WHERE id = $${aEcrire.length + 1}`,
            [...aEcrire.map(([, v]) => v), req.session.userId],
        );
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /vitrine/apparence —", err.message);
        res.json({ success: false, error: "Enregistrement impossible. Réessaie." });
    }
});

// ── LA BOUTIQUE D'UN MARCHAND ───────────────────────────────────────────
// Publique et volontairement sans compte requis : ce lien se colle dans une
// story, un statut WhatsApp, une bio Instagram. Un mur de connexion à cet
// endroit-là, c'est le client perdu avant d'avoir vu le premier produit.
//
// Déclarée APRÈS /chat : sinon `/:userId` capterait « chat » comme un
// identifiant de marchand.
router.get("/:userId", async (req, res) => {
    try {
        await renderVitrine(req.params.userId, req, res);
    } catch (err) {
        console.error("❌ GET /vitrine/:userId —", err.message);
        res.status(500).send("La boutique n'a pas pu s'afficher. Réessaie dans un instant.");
    }
});

module.exports = router;
// `index.js` en a besoin pour servir la vitrine à la racine d'un
// sous-domaine (maboutique.souverain-store.com) : c'est la même page, seule
// l'adresse qui y mène change.
module.exports.renderVitrine = renderVitrine;
