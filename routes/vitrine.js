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
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const db = require("../services/db");
const geminiService = require("../services/geminiService");
const SAMII_VITRINE_PROMPT = require("../brain/prompts/vitrine");
const transcription = require("../services/transcription");
const { renderVitrine } = require("./vitrine-page");

// 10 messages sur 5 heures par IP, pour un visiteur sans compte.
//
// Le chiffre n'est pas une limite technique, c'est une décision produit : le
// chat est devenu la page d'accueil, donc la porte doit rester ouverte assez
// longtemps pour que quelqu'un se fasse une opinion — mais chaque message
// coûte de l'argent réel en tokens et n'est protégé par aucun compte.
//
// Les messages REVIENNENT au bout de 5 heures : ce n'est pas un mur définitif.
// Le message de dépassement le dit, et ne culpabilise personne.
const QUOTA_ANONYME = 10;
const FENETRE_MS = 5 * 60 * 60 * 1000;

const vitrineLimiter = rateLimit({
    windowMs: FENETRE_MS,
    max: QUOTA_ANONYME,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: true,
        reply: "On a bien avancé. Tes messages reviennent dans 5 heures — ou crée ton compte et je garde tout ce qu'on s'est dit.",
        limite: true,
        restant: 0,
    },
});

const LANGUES = ["fr", "en", "ar", "zh"];
const MAX_MESSAGE = 500;      // au-delà, c'est un copier-coller de document

// 16 tours, soit 8 allers-retours. C'était 6 (3 échanges) quand le chat était
// un widget dans un coin de la vitrine : à ce niveau SAMII oublie le métier
// annoncé trois messages plus tôt, ce qui est acceptable pour un gadget et
// rédhibitoire pour la page d'accueil. Toujours borné, parce que l'historique
// repart en entier à chaque appel et que c'est nous qui payons.
const MAX_HISTORIQUE = 16;

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

// Combien de messages il reste au visiteur. express-rate-limit renseigne
// req.rateLimit une fois la requête comptée — on lit ce compteur au lieu d'en
// tenir un deuxième, qui finirait par diverger de celui qui décide vraiment.
function resteAutorise(req) {
    const n = req.rateLimit && typeof req.rateLimit.remaining === "number"
        ? req.rateLimit.remaining
        : null;
    return n === null ? QUOTA_ANONYME : Math.max(0, n);
}

// JOURNALISER, PAS ROUTER.
//
// On n'écrit aucune règle « si le visiteur dit X, l'envoyer vers Y » : on ne
// sait pas encore ce que les gens demandent. On enregistre donc les vraies
// conversations, et on lira ce corpus plus tard pour décider des chemins.
//
// Même table que le SAMII connecté (samii_conversations) — `user_id` y est
// TEXT et nullable, donc un visiteur anonyme s'y range sous « anon:<session> »
// sans nouvelle table ni migration. La colonne `source` sépare les deux
// mondes à l'analyse, et un identifiant « anon: » ne peut jamais entrer en
// collision avec un identifiant de compte.
//
// Un échec d'écriture ne doit JAMAIS faire perdre sa réponse au visiteur :
// la journalisation est utile pour nous, invisible pour lui.
async function journaliserTour(req, message, reponse) {
    try {
        const userId = req.session?.userId
            ? String(req.session.userId)
            : "anon:" + String(req.sessionID || "sans-session").slice(0, 24);
        await db.query(
            `INSERT INTO samii_conversations (user_id, role, contenu, source, created_at)
             VALUES ($1, 'user', $2, 'vitrine', NOW()), ($1, 'model', $3, 'vitrine', NOW())`,
            [userId, message, String(reponse || "").slice(0, 4000)],
        );
    } catch (err) {
        console.error("❌ journaliserTour (vitrine) :", err.message);
    }
}

// Normalise ce qui arrive du navigateur. Écrite une fois et partagée par les
// deux routes (/chat et /chat/flux) : ce sont les MÊMES garde-fous — taille du
// message, taille de l'historique, langue autorisée — et les laisser diverger
// reviendrait à ouvrir sur l'une la porte qu'on ferme sur l'autre.
function preparerEntree(req) {
    const messageBrut = String(req.body.message || "").trim();
    // Une photo SANS un mot est une question parfaitement valable — « c'est
    // quoi ça ? ». Refuser le message vide aurait rendu le trombone inutile
    // pour le geste le plus naturel qu'on puisse avoir avec.
    if (!messageBrut && !req.body.imageUrl) return null;

    const message = messageBrut.slice(0, MAX_MESSAGE) || "Regarde cette image et dis-moi ce que tu en penses.";
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

    // L'image est une ADRESSE, jamais des octets : le navigateur l'a déposée
    // sur Cloudinary et ne nous envoie que le lien. On n'accepte donc que du
    // https, et c'est geminiService qui va la chercher, redimensionnée.
    const imageUrl = /^https:\/\/[^\s"']{10,500}$/.test(String(req.body.imageUrl || ""))
        ? String(req.body.imageUrl)
        : null;

    const nbEchanges = Math.floor(historique.length / 2);
    return { message, langue, historique, imageUrl, systemPrompt: SAMII_VITRINE_PROMPT({ langue, nbEchanges }) };
}

// ══════════════════════════════════════════════════════════════════════════
// LE MICRO, SANS COMPTE
// ══════════════════════════════════════════════════════════════════════════
//
// Il était réservé aux membres connectés, et c'était l'erreur : on cachait
// précisément ce qui donne envie de s'inscrire. Quelqu'un qui a parlé à SAMII
// et l'a vu écrire ses mots comprend en trois secondes ce que vaut le produit
// — bien mieux que n'importe quelle phrase de vente. On montre d'abord, on
// invite ensuite.
//
// Et dicter n'est pas un confort ici : beaucoup de gens tapent lentement, ou
// pas du tout, dans l'une ou l'autre de leurs langues. Un chat qui exige un
// clavier exclut une partie du marché visé avant la première phrase.
//
// LE COÛT RESTE BORNÉ : 20 dictées par heure et par IP (une conversation
// entière se dicte largement là-dedans), 8 Mo par envoi, et Groq Whisper
// turbo coûte une fraction d'un message de chat.
const uploadVocal = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const micLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Trop de dictées d'un coup. Réessaie dans un moment." },
});

router.post("/transcrire", micLimiter, uploadVocal.single("audio"), async (req, res) => {
    try {
        if (!req.file?.buffer?.length) {
            return res.json({ success: false, error: "Aucun audio reçu." });
        }
        const texte = await transcription.transcribeBuffer(
            req.file.buffer,
            req.file.originalname || "audio.webm",
        );
        // transcribeBuffer renvoie une chaîne vide plutôt que de lever : on
        // distingue donc « rien entendu » d'une panne, pour que la page puisse
        // dire l'un ou l'autre au lieu d'un « erreur » qui n'aide personne.
        return res.json({ success: Boolean(texte), text: texte || "" });
    } catch (err) {
        console.error("❌ POST /vitrine/transcrire :", err.message);
        return res.json({ success: false, error: "La dictée n'a pas abouti." });
    }
});

router.post("/chat", vitrineLimiter, async (req, res) => {
    try {
        const entree = preparerEntree(req);
        if (!entree) {
            return res.json({ success: false, reply: "Pose-moi ta question." });
        }
        const { message, langue, historique, imageUrl, systemPrompt } = entree;

        const reponse = await geminiService.chatLibre({ systemPrompt, message, history: historique, imageUrl });

        if (!reponse.text) {
            // Le compteur repart MÊME QUAND L'IA EST EN PANNE : le message a
            // été décompté par le limiteur, donc le cacher ferait mentir la
            // page. Sans ce champ, la jauge reste vide et le visiteur croit
            // que ses messages sont infinis jusqu'au blocage sec.
            return res.json({
                success: false,
                reply: "SAMII est momentanément indisponible. Réessaie dans une minute, ou laisse-moi ton email pour qu'on te recontacte.",
                restant: resteAutorise(req),
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

        await journaliserTour(req, message, reponse.text);

        res.json({
            success: true,
            reply: reponse.text,
            contactCapture: Boolean(email || tel),
            restant: resteAutorise(req),
        });
    } catch (err) {
        console.error("❌ POST /vitrine/chat :", err.message);
        res.json({
            success: false,
            reply: "Une erreur est survenue. Réessaie dans un instant.",
        });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// LA MÊME CHOSE, MAIS ÉCRITE SOUS LES YEUX DU VISITEUR
// ══════════════════════════════════════════════════════════════════════════
//
// Route ajoutée À CÔTÉ de /chat, qui ne change pas d'un octet. Un navigateur
// qui ne sait pas lire un flux, un proxy d'entreprise qui met la réponse en
// tampon, une extension qui casse EventSource : dans tous ces cas le client
// retombe sur /chat et reçoit sa réponse d'un bloc. Remplacer l'ancienne
// route aurait fait dépendre le chat entier d'une technique qui échoue
// silencieusement chez une minorité de visiteurs — et une minorité de
// visiteurs, quand on en a huit, c'est tout le monde.
//
// Le passage par le MÊME limiteur est volontaire : les deux routes partagent
// le compteur, sinon il suffirait d'alterner entre elles pour doubler le quota.
router.post("/chat/flux", vitrineLimiter, async (req, res) => {
    const entree = preparerEntree(req);
    if (!entree) {
        return res.json({ success: false, reply: "Pose-moi ta question." });
    }
    const { message, langue, historique, imageUrl, systemPrompt } = entree;

    // Content-Type SSE + désactivation explicite de la mise en tampon. Sans
    // X-Accel-Buffering, un proxy nginx garde la réponse jusqu'à la fin et
    // renvoie tout d'un coup : on aurait fait tout ce travail pour rien, et
    // en production seulement, là où le proxy existe.
    res.set({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    const envoyer = (evenement, donnees) => {
        res.write(`event: ${evenement}\ndata: ${JSON.stringify(donnees)}\n\n`);
    };

    // Le visiteur peut fermer l'onglet en plein milieu. On arrête alors
    // d'écrire — sinon Node accumule des écritures sur une socket morte.
    let vivant = true;
    req.on("close", () => { vivant = false; });

    try {
        const reponse = await geminiService.chatLibreFlux(
            { systemPrompt, message, history: historique, imageUrl },
            (morceau) => { if (vivant) envoyer("morceau", { t: morceau }); },
        );

        if (!vivant) return res.end();

        if (!reponse.text) {
            envoyer("fin", {
                success: false,
                reply: "SAMII est momentanément indisponible. Réessaie dans une minute, ou laisse-moi ton email pour qu'on te recontacte.",
                restant: resteAutorise(req),
            });
            return res.end();
        }

        const { email, tel } = extraireContact(message);
        await enregistrerProspect({ email, tel, message, langue, ip: req.ip });
        await journaliserTour(req, message, reponse.text);

        envoyer("fin", {
            success: true,
            contactCapture: Boolean(email || tel),
            restant: resteAutorise(req),
        });
        res.end();
    } catch (err) {
        console.error("❌ POST /vitrine/chat/flux :", err.message);
        if (vivant) {
            envoyer("fin", { success: false, reply: "Une erreur est survenue. Réessaie dans un instant." });
            res.end();
        }
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
