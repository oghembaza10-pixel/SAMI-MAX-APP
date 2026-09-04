// ==========================================================================
// WEBHOOK META — LES COMMENTAIRES FACEBOOK ET INSTAGRAM
// ==========================================================================
//
// Ce fichier ne contient QUE ce qui est vraiment du HTTP : la poignée de
// main de Meta, la vérification de signature, l'accusé de réception. Ce
// qu'on fait d'un commentaire vit dans `engines/social/commentaires.js`,
// où ça se teste sans serveur.
//
// ── POURQUOI LA SIGNATURE EST VÉRIFIÉE ICI ────────────────────────────────
//
// Cette route FAIT PUBLIER SAMII sur des pages réelles. Sans signature,
// n'importe qui connaissant l'adresse peut fabriquer un faux commentaire et
// faire écrire SAMII sous nos propres publications, avec le texte qu'il
// aura choisi de provoquer.
//
// `routes/webhook-whatsapp.js` ne la vérifie pas — c'est un manque réel,
// mais il reçoit des messages privés et n'écrit rien en public. Je ne le
// modifie pas au passage : changer une route qui marche pendant qu'on en
// construit une autre, c'est se retrouver avec deux choses à déboguer.
// C'est noté, ça se traite séparément.

const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const commentaires = require("../engines/social/commentaires");

// ── LA POIGNÉE DE MAIN ────────────────────────────────────────────────────
//
// Meta appelle cette adresse en GET une seule fois, au branchement, et
// attend qu'on lui rende son défi. Même logique de repli que pour WhatsApp :
// Meta n'a qu'un champ « token de vérification » par webhook, exiger un nom
// de variable précis fabrique une panne muette.
router.get("/", (req, res) => {
    const attendu = process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "";
    const mode = req.query["hub.mode"];
    const jeton = req.query["hub.verify_token"];
    const defi = req.query["hub.challenge"];

    if (mode === "subscribe" && attendu && jeton === attendu) {
        console.log("✅ Webhook Meta (commentaires) vérifié");
        return res.status(200).send(String(defi || ""));
    }
    console.warn(attendu
        ? "⚠️ Webhook Meta : jeton de vérification refusé."
        : "⚠️ Webhook Meta : META_VERIFY_TOKEN n'est pas défini — Meta ne pourra pas brancher le webhook.");
    return res.sendStatus(403);
});

// ── LA SIGNATURE ──────────────────────────────────────────────────────────
//
// Meta signe le corps BRUT avec le secret de l'application. La comparaison
// se fait en temps constant : un `===` sur deux chaînes s'arrête au premier
// caractère différent, ce qui laisse mesurer la bonne signature octet par
// octet. Sur une route publique, ça se fait.
//
// Le corps doit être le Buffer brut. `index.js` monte `express.raw()` sur
// `/webhook` — si un `express.json()` passait devant, le corps serait
// re-sérialisé et la signature ne correspondrait plus jamais.
function signatureValide(req) {
    const secret = process.env.META_APP_SECRET || "";
    if (!secret) return { ok: false, raison: "META_APP_SECRET n'est pas posée" };

    const entete = String(req.headers["x-hub-signature-256"] || "");
    if (!entete.startsWith("sha256=")) return { ok: false, raison: "en-tête de signature absent" };

    const brut = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}), "utf8");
    const attendue = "sha256=" + crypto.createHmac("sha256", secret).update(brut).digest("hex");

    const a = Buffer.from(entete);
    const b = Buffer.from(attendue);
    if (a.length !== b.length) return { ok: false, raison: "signature de longueur inattendue" };
    if (!crypto.timingSafeEqual(a, b)) return { ok: false, raison: "signature invalide" };
    return { ok: true };
}

router.post("/", async (req, res) => {
    // ── ON ACCUSE RÉCEPTION D'ABORD ──────────────────────────────────────
    //
    // Meta réessaie la livraison s'il n'a pas son 200 rapidement, et écrire
    // une réponse demande un appel au modèle — plusieurs secondes. Sans
    // accusé immédiat, le même commentaire reviendrait pendant qu'on est en
    // train d'y répondre.
    const sig = signatureValide(req);
    if (!sig.ok) {
        console.warn(`⛔ Webhook Meta rejeté — ${sig.raison}`);
        return res.sendStatus(401);
    }
    res.sendStatus(200);

    let corps = {};
    try {
        corps = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8") || "{}") : (req.body || {});
    } catch (err) {
        console.error("❌ Webhook Meta — corps illisible :", err.message);
        return;
    }

    // Une trace à l'entrée, toujours : sans elle, « rien dans les journaux »
    // veut dire deux choses opposées — Meta ne nous a jamais appelés, ou
    // tout s'est bien passé en silence.
    const lus = commentaires.lireLivraison(corps);
    console.log(`💬 Webhook Meta — ${lus.length} commentaire(s) dans cette livraison`);
    if (!lus.length) return;

    try {
        for (const r of await commentaires.traiterLivraison(corps)) {
            // Le contenu du commentaire n'est pas journalisé : ce sont les
            // mots de vraies personnes. La décision, si.
            if (r.fait) console.log(`✅ Répondu sur ${r.plateforme} (${r.commentaireId})`);
            else console.log(`⏭️ Sans réponse — ${r.raison}`);
        }
    } catch (err) {
        console.error("❌ Webhook Meta — traitement :", err.message);
    }
});

module.exports = router;
