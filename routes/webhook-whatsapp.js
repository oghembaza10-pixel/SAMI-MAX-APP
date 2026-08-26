// ==========================================================================
// SAMII OS — WEBHOOK WHATSAPP — Messages entrants, tous fournisseurs
// SAMII raisonne lui-même la conversation (rendez-vous, commande, questions)
// via function-calling Gemini, quel que soit le métier — miroir de routes/telegram.js.
// ==========================================================================
const express      = require("express");
const orchestrator = require("../brain/orchestrator");
const planner       = require("../brain/planner");
const memory        = require("../brain/memory");
const evenements = require("../services/evenements");
const whatsapp       = require("../services/whatsapp");
const db            = require("../services/db");
const journalService = require("../services/journalService");
const connectorService = require("../services/connectorService");
const confirmationsQuota = require("../services/confirmationsQuota");
const transcription  = require("../services/transcription");
const produitsService = require("../services/produitsService");
const fournisseurs   = require("../services/whatsappFournisseurs");

const router = express.Router();

function sessionKey(sender) { return `wa_${sender}`; }

async function reply(sender, workspaceId, text) {
    await whatsapp.send({ to: sender, message: text, workspaceId });
}

const REPONSES_OUI = ["oui", "yes", "ok", "okay", "confirme", "confirmé", "نعم", "1"];
const REPONSES_NON = ["non", "no", "annule", "annulé", "لا", "2"];

// ── Confirmation/annulation directe par le client (réponse texte OUI/NON à
// la demande envoyée après création de commande) — évite de dépendre du
// raisonnement Gemini pour une action aussi sensible, même principe que les
// boutons inline déjà utilisés côté Telegram.
async function traiterReponseConfirmation(sender, workspaceId, text) {
    const normalise = text.trim().toLowerCase();
    if (!REPONSES_OUI.includes(normalise) && !REPONSES_NON.includes(normalise)) return false;

    const pending = await db.query(
        `SELECT id FROM commandes WHERE workspace_id = $1 AND contact_id = $2 AND statut = 'en attente' ORDER BY created_at DESC LIMIT 1`,
        [workspaceId, sender]
    );
    const orderId = pending[0]?.id;
    if (!orderId) return false;

    if (REPONSES_OUI.includes(normalise)) {
        await db.query(`UPDATE commandes SET statut = 'confirmée', confirme_le = now() WHERE id = $1`, [orderId]);
        confirmationsQuota.enregistrerSiDepassement(workspaceId).catch(() => {});
        evenements.publier(workspaceId, "commande.confirmee", { id: orderId, source: "whatsapp" });
        await reply(sender, workspaceId, `✅ Commande ${orderId} confirmée ! Merci 🙏`);
    } else {
        await db.query(`UPDATE commandes SET statut = 'annulée' WHERE id = $1`, [orderId]);
        evenements.publier(workspaceId, "commande.annulee", { id: orderId, source: "whatsapp" });
        await reply(sender, workspaceId, `❌ Commande ${orderId} annulée.`);
    }
    return true;
}

// ── Résout le workspace propriétaire de l'instance Green API ──────────
// Fiable uniquement pour une instance personnelle (1 instance = 1 marchand).
// Sur l'instance partagée de dépannage, plusieurs marchands peuvent être
// actifs en même temps — cette fonction ne trouvera jamais rien pour elle
// (aucun connecteur de dépannage n'y stocke d'apiId), ce qui est volontaire :
// voir resolveWorkspaceEntrant ci-dessous pour la vraie résolution.
async function getWorkspaceByInstance(idInstance) {
    try {
        const rows = await db.query(
            `SELECT workspace_id FROM connecteurs WHERE type = 'whatsapp' AND actif = true AND config LIKE $1`,
            [`%"apiId":"${idInstance}"%`]
        );
        return rows[0]?.workspace_id || "";
    } catch {
        return "";
    }
}

// ── Résout le marchand d'un message entrant ────────────────────────────
// 1) D'abord via une commande WhatsApp en attente pour ce numéro : marche
//    aussi bien sur une instance perso que sur l'instance de dépannage
//    partagée, puisqu'une telle commande n'a pu être créée que par un
//    marchand effectivement autorisé à envoyer au moment de sa création.
// 2) Sinon, repli sur la correspondance instance → marchand — utile pour
//    une question nouvelle du client sur son instance perso, mais qui ne
//    résout jamais rien sur l'instance partagée (ambiguë entre marchands).
async function resolveWorkspaceEntrant(idInstance, sender) {
    try {
        const rows = await db.query(
            `SELECT workspace_id FROM commandes WHERE contact_id = $1 AND source = 'whatsapp' AND statut = 'en attente' ORDER BY created_at DESC LIMIT 1`,
            [sender]
        );
        if (rows[0]?.workspace_id) return rows[0].workspace_id;
    } catch { /* ignore, on retombe sur l'instance */ }
    return await getWorkspaceByInstance(idInstance);
}

// ── Résout le marchand d'un numéro Meta Cloud / 360dialog ──────────────
// Deux chemins, dans cet ordre :
//   1) l'identifiant de numéro (phone_number_id) déjà enregistré — le cas
//      normal une fois le premier message passé ;
//   2) le numéro affiché, saisi par l'entreprise au moment de la connexion.
//      360dialog ne donne pas le phone_number_id à la connexion : on ne peut
//      donc pas l'exiger. Dès qu'un premier message arrive, on l'enregistre
//      pour que le chemin 1 fonctionne ensuite — le connecteur se répare seul.
async function getWorkspaceParNumeroCloud(phoneNumberId, numeroAffiche) {
    const chiffres = String(numeroAffiche || "").replace(/[^\d]/g, "");
    try {
        if (phoneNumberId) {
            const rows = await db.query(
                `SELECT workspace_id FROM connecteurs
                  WHERE type = 'whatsapp' AND actif = true AND config LIKE $1 LIMIT 1`,
                [`%"phoneNumberId":"${phoneNumberId}"%`],
            );
            if (rows[0]?.workspace_id) return rows[0].workspace_id;
        }
        if (chiffres) {
            const rows = await db.query(
                `SELECT workspace_id FROM connecteurs
                  WHERE type = 'whatsapp' AND actif = true AND config LIKE $1 LIMIT 1`,
                [`%"numero":"${chiffres}"%`],
            );
            const workspaceId = rows[0]?.workspace_id;
            if (workspaceId) {
                if (phoneNumberId) {
                    // save() fusionne avec la config existante : on ajoute
                    // l'identifiant sans toucher à la clé d'API.
                    await connectorService.save(workspaceId, "whatsapp", { phoneNumberId })
                        .catch(err => console.warn("⚠️ phone_number_id non mémorisé :", err.message));
                }
                return workspaceId;
            }
        }
    } catch (err) {
        console.error("❌ WhatsApp getWorkspaceParNumeroCloud :", err.message);
    }
    return "";
}

async function getMetierWorkspace(workspaceId) {
    try {
        const rows = await db.query(`SELECT metier FROM workspaces WHERE id = $1`, [workspaceId]);
        return rows[0]?.metier || "";
    } catch { return ""; }
}

// Whisper choisit son décodeur d'après l'extension du nom de fichier, pas
// d'après le type MIME envoyé : un nom mal choisi donne une transcription
// vide, sans message d'erreur.
function nomFichierAudio(mime = "") {
    const type = String(mime).split(";")[0].trim();
    const extensions = {
        "audio/ogg": "ogg", "audio/opus": "ogg",
        "audio/mpeg": "mp3", "audio/mp3": "mp3",
        "audio/mp4": "m4a", "audio/aac": "m4a",
        "audio/amr": "amr", "audio/wav": "wav", "audio/webm": "webm",
    };
    return `audio.${extensions[type] || "ogg"}`;
}

// ── Ce qui arrive à un message, quel que soit le fournisseur ───────────
// Green API et la famille Cloud n'ont en commun que ce qui précède : à partir
// d'ici, un message est un message. Une seule fonction, donc, sinon les deux
// chemins divergeraient au premier ajout.
async function traiterMessage({ workspaceId, sender, senderName, text }) {
    console.log(`💬 WhatsApp [${senderName}] (workspace ${workspaceId}) : ${text}`);

    try {
        await orchestrator.process({
            type   : "whatsapp.message",
            shop   : workspaceId,
            payload: { senderName, sender, message: text },
        });
    } catch (procErr) {
        console.error("❌ WhatsApp orchestrator :", procErr.message);
        await journalService.log({ action: "error.whatsapp.message", details: procErr.message, workspaceId });
    }

    evenements.publier(workspaceId, "message.recu",
        { canal: "whatsapp", expediteur: sender, nom: senderName, message: text },
        { socketDonnees: { senderName, message: text } });

    // Réponse directe à une demande de confirmation de commande en cours —
    // traitée avant le raisonnement Gemini général (action sensible, pas
    // besoin de laisser l'IA l'interpréter).
    const traitee = await traiterReponseConfirmation(sender, workspaceId, text);
    if (traitee) return;

    // ── Raisonnement universel : SAMII mène la conversation lui-même, tous
    // métiers (rendez-vous, commande, questions...), via function-calling
    // Gemini, au lieu d'un parcours pas-à-pas figé par métier.
    const key      = sessionKey(sender);
    const session  = await memory.get(key) || {};
    const conversation = session.history || [];

    const metier   = await getMetierWorkspace(workspaceId);
    const produits = await produitsService.getProduitsDuWorkspace(workspaceId);

    const geminiReply = await planner.ask(text, {
        source: "whatsapp", chatId: sender, name: senderName, audience: "client",
        workspaceId, metier, produits,
    }, conversation);
    await reply(sender, workspaceId, geminiReply);

    const nextHistory = [...conversation, { role: "user", message: text }, { role: "model", message: geminiReply }].slice(-60);
    await memory.set(key, { ...session, history: nextHistory });
}

// ── Vérification d'abonnement (Meta) ───────────────────────────────────
// Meta n'accepte un webhook qu'après avoir appelé cette URL en GET et reçu
// son défi en clair. Sans cette route, une entreprise qui branche son propre
// numéro Cloud API ne peut tout simplement pas enregistrer SAMII.
// 360dialog n'en a pas besoin, mais répondre ne coûte rien.
router.get("/", (req, res) => {
    // Repli sur META_VERIFY_TOKEN quand WHATSAPP_VERIFY_TOKEN n'existe pas.
    // Meta n'a qu'un seul champ « token de vérification » par webhook et la
    // plupart des installations n'en posent qu'un : exiger un second nom de
    // variable ne protège de rien et fabrique une panne muette — Meta refuse
    // de brancher, personne ne comprend pourquoi, et la seule trace est un 403
    // dans nos journaux. On accepte donc les deux noms.
    const attendu = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || "";
    const mode = req.query["hub.mode"];
    const jeton = req.query["hub.verify_token"];
    const defi = req.query["hub.challenge"];

    if (mode === "subscribe" && attendu && jeton === attendu) {
        console.log("✅ Webhook WhatsApp vérifié par Meta");
        return res.status(200).send(String(defi || ""));
    }
    console.warn(attendu
        ? "⚠️ Webhook WhatsApp : jeton de vérification refusé — la valeur saisie chez Meta ne correspond pas."
        : "⚠️ Webhook WhatsApp : ni WHATSAPP_VERIFY_TOKEN ni META_VERIFY_TOKEN ne sont définis. Meta ne pourra pas brancher le webhook.");
    return res.sendStatus(403);
});

router.post("/", async (req, res) => {
    res.sendStatus(200);
    try {
        // Monté sous /webhook, où express.raw() laisse le body en Buffer brut.
        const raw  = req.body;
        const body = Buffer.isBuffer(raw) ? JSON.parse(raw.toString("utf8") || "{}") : (raw || {});

        // UNE TRACE À L'ENTRÉE, TOUJOURS. Sans elle, « rien dans les journaux »
        // veut dire deux choses opposées : Meta ne nous a jamais appelés, ou
        // tout s'est bien passé en silence. On a perdu une heure là-dessus le
        // jour du branchement — ce n'est pas du bavardage, c'est la seule
        // façon de couper le problème en deux depuis l'extérieur.
        // Aucun contenu de message n'est journalisé : ce sont des
        // conversations de clients.
        console.log(`📩 Webhook WhatsApp reçu — ${Array.isArray(body.entry) ? "format Meta/360dialog" : (body.typeWebhook || "format inconnu")}`);

        // ── Famille Cloud : Meta en direct et 360dialog ────────────────────
        // Même enveloppe pour les deux, d'où un seul traitement. On la
        // reconnaît à sa structure (entry[].changes[]), jamais à une devinette
        // sur le fournisseur : c'est le format qui décide, pas nous.
        if (Array.isArray(body.entry)) {
            const lu = fournisseurs.lireWebhookCloud(body);
            // Accusés de réception (delivered, read) et types non gérés :
            // lireWebhookCloud renvoie null, il n'y a rien à faire.
            if (!lu) {
                console.log("   ↳ accusé de réception ou type non géré — rien à faire.");
                return;
            }
            console.log(`   ↳ message entrant, numéro ${lu.phoneNumberId || "?"}`);

            const workspaceId = await getWorkspaceParNumeroCloud(lu.phoneNumberId, lu.numeroAffiche);
            if (workspaceId) console.log(`   ↳ marchand trouvé : ${workspaceId}`);
            if (!workspaceId) {
                console.log(`⚠️ WhatsApp Cloud : marchand introuvable pour ${lu.numeroAffiche || lu.phoneNumberId}`);
                return;
            }

            let texte = lu.texte;
            // Note vocale : on récupère le média avec les identifiants du
            // marchand, puis on transcrit. Un échec ne casse rien — le
            // message est simplement ignoré, comme un type non géré.
            if (!texte && lu.mediaId) {
                const config = await whatsapp.resolveCredentials(workspaceId);
                const audio = config ? await fournisseurs.telechargerMedia(config, lu.mediaId) : null;
                // Whisper déduit le format de l'extension : sans elle, un
                // vocal WhatsApp (ogg/opus) revient vide sans erreur.
                if (audio) texte = await transcription.transcribeBuffer(audio, nomFichierAudio(lu.mediaMime));
            }
            if (!texte || !texte.trim()) return;

            return await traiterMessage({
                workspaceId,
                sender: lu.sender,
                senderName: lu.senderName,
                text: texte.trim(),
            });
        }

        // ── Green API ──────────────────────────────────────────────────────
        if (body.typeWebhook !== "incomingMessageReceived") return;

        const idInstance = body.instanceData?.idInstance;
        const senderData  = body.senderData || {};
        let textMessage =
            body.messageData?.textMessageData?.textMessage ||
            body.messageData?.extendedTextMessageData?.text ||
            "";

        // Note vocale : Green API l'envoie en fileMessageData (audio/ogg,
        // downloadUrl temporaire) plutôt qu'en texte — on la transcrit via
        // Groq Whisper et on continue exactement comme un message texte.
        const fileData = body.messageData?.fileMessageData;
        if (!textMessage && fileData?.downloadUrl && (fileData.mimeType || "").startsWith("audio/")) {
            textMessage = await transcription.transcribeFromUrl(fileData.downloadUrl, fileData.fileName || "audio.ogg");
        }

        if (!idInstance || !textMessage) return;

        const senderName = senderData.senderName || senderData.chatName || "Client";
        const sender      = (senderData.sender || senderData.chatId || "").replace("@c.us", "");
        const text        = textMessage.trim();

        const workspaceId = await resolveWorkspaceEntrant(idInstance, sender);
        if (!workspaceId) {
            console.log(`⚠️ WhatsApp webhook : marchand introuvable pour idInstance=${idInstance}, sender=${sender}`);
            return;
        }

        await traiterMessage({ workspaceId, sender, senderName, text });

    } catch (err) {
        console.error("❌ Webhook WhatsApp :", err.message);
    }
});

module.exports = router;
