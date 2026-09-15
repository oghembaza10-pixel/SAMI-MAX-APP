// ==========================================================================
// SAMII OS — TELEGRAM WEBHOOK — V3 Universel (tous métiers, multi-langue)
// ==========================================================================
const express      = require("express");
const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");
const planner      = require("../brain/planner");
const memory       = require("../brain/memory");
const db           = require("../services/db");
const evenements = require("../services/evenements");
const confirmationsQuota = require("../services/confirmationsQuota");
const creditsSamii = require("../services/creditsSamii");
const telegramCommunity = require("../services/telegramCommunity");
const transcription = require("../services/transcription");
const produitsService = require("../services/produitsService");

const router = express.Router();
const TOKEN  = CONFIG.TELEGRAM.BOT_TOKEN;
const BASE   = `https://api.telegram.org/bot${TOKEN}`;

// ── Bot perso du marchand (routes/connector.js, POST /connect/telegram/bot) ──
// Chaque bot perso a son propre webhook dédié (/telegram/:workspaceId, voir
// plus bas) — contrairement à WhatsApp, aucune ambiguïté de routage : c'est
// justement Telegram qui indique par QUELLE URL le message arrive.
async function resolveBotToken(workspaceId) {
    if (!workspaceId) return TOKEN;
    try {
        const rows = await db.query(
            `SELECT config FROM connecteurs WHERE type = 'telegram_bot' AND actif = true AND workspace_id = $1`,
            [workspaceId]
        );
        const config = rows[0] ? JSON.parse(rows[0].config || "{}") : null;
        if (config?.botToken) return config.botToken;
    } catch (err) {
        console.error("❌ Telegram resolveBotToken :", err.message);
    }
    return TOKEN;
}

async function resolveBotBase(workspaceId) {
    const token = await resolveBotToken(workspaceId);
    return token ? `https://api.telegram.org/bot${token}` : BASE;
}

// ══ LE WEBHOOK PROUVE QU'IL VIENT DE TELEGRAM ═══════════════════════════
//
// ── CE QUI SE PASSAIT AVANT ──────────────────────────────────────────────
//
// POST /telegram/:workspaceId n'avait aucune authentification. Mesuré :
//
//     POST /telegram/ws-dun-autre-marchand
//     {"message":{"message_id":1,"chat":{"id":424242},"text":"bonjour"}}
//     → HTTP 200, traité, et FACTURÉ
//
// La réponse part dans le vide (l'attaquant ne lit pas le chat Telegram),
// mais l'appel au modèle a lieu et `creditsSamii.facturerActesWorkspace`
// débite le marchand. Qui connaît un workspaceId vide un solde à volonté.
// La référence d'idempotence `tg:<ws>:<chat>:<message_id>` ne protège rien :
// c'est l'attaquant qui choisit `message_id`.
//
// ── POURQUOI LE SECRET EST DÉRIVÉ DU TOKEN, ET PAS UNE VARIABLE DE PLUS ──
//
// Telegram accepte un `secret_token` à `setWebhook` et le renvoie ensuite
// dans l'en-tête `X-Telegram-Bot-Api-Secret-Token` de chaque mise à jour.
// Il reste à décider D'OÙ vient ce secret.
//
// Une variable d'environnement par marchand serait ingérable : chaque bot
// perso est créé depuis le QG, sans accès à la configuration du serveur.
//
// Le token du bot, lui, est déjà là — et il est déjà le secret partagé
// entre Telegram et nous. Qui le connaît contrôle DÉJÀ le bot entièrement :
// en dériver le secret n'affaiblit donc rien, et se dérive aussi bien pour
// le bot partagé que pour les bots persos, sans une ligne de configuration.
//
// Le sel fixe empêche que le secret envoyé à Telegram soit un condensé nu
// du token, réutilisable ailleurs.
const crypto = require("crypto");

function secretPour(token) {
    if (!token) return null;
    return crypto.createHash("sha256")
        .update(`samii-telegram-webhook:${token}`)
        .digest("hex");                 // 64 caractères, dans l'alphabet accepté
}

// Comparaison à temps constant. `timingSafeEqual` EXIGE deux tampons de même
// longueur — sinon il lève, et l'exception elle-même trahirait la longueur.
// On condense donc les deux côtés avant de comparer : deux condensés font
// toujours 32 octets.
function memeSecret(a, b) {
    if (!a || !b) return false;
    const ha = crypto.createHash("sha256").update(String(a)).digest();
    const hb = crypto.createHash("sha256").update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

// Le garde. Il s'exécute AVANT tout traitement : avant le modèle, avant la
// mémoire, avant la facturation. Un rejet ne coûte rien à personne.
//
// ⚠️ IL REFUSE AUSSI QUAND AUCUN SECRET N'EST CALCULABLE (bot inconnu, token
// absent). Un webhook qui traite sans pouvoir vérifier est exactement le
// trou qu'on vient de fermer : il échoue FERMÉ, jamais ouvert.
//
// 401 et pas 403 : c'est un défaut d'authentification, et Telegram cesse de
// réessayer sur un 4xx — on ne veut pas qu'il rejoue une requête refusée.
async function verifierSecret(req, res, workspaceId) {
    const token = await resolveBotToken(workspaceId);
    const attendu = secretPour(token);
    const recu = req.get("X-Telegram-Bot-Api-Secret-Token");

    if (!attendu) {
        // Jamais le token ni le secret dans le journal — seulement l'état.
        console.error(
            `❌ Telegram : aucun token pour « ${workspaceId || "bot partagé"} », ` +
            "webhook refusé (il ne peut pas être vérifié).");
        res.sendStatus(401);
        return false;
    }
    if (!memeSecret(recu, attendu)) {
        console.warn(
            `⚠️ Telegram : mise à jour refusée pour « ${workspaceId || "bot partagé"} » — ` +
            (recu ? "secret invalide." : "aucun en-tête de secret.") +
            " Si c'est un bot légitime, son webhook doit être réenregistré " +
            "(POST /connect/telegram/bot depuis le QG).");
        res.sendStatus(401);
        return false;
    }
    return true;
}

// ── MULTI-LANGUE ───────────────────────────────────────────────
const LANGUES_SUPPORTEES = ["fr", "en", "ar"];

function detecterLangue(message) {
    const code = (message?.from?.language_code || "fr").toLowerCase().slice(0, 2);
    return LANGUES_SUPPORTEES.includes(code) ? code : "fr";
}

const T = {
    fr: {
        bienvenueClient: "👑 *Bienvenue !*\n\nJe suis SAMII, votre Bras droit. Comment puis-je vous aider aujourd'hui ?",
        bienvenueGenerique: (chatId) => `👑 *Bienvenue sur SAMII OS !*\n\n✅ Chat ID : \`${chatId}\`\n\nJe suis SAMII, votre Bras droit. Comment puis-je vous aider ?`,
        adminConnecte: "✅ *Telegram connecté à ton QG !*\n\nTu recevras désormais toutes tes commandes/rendez-vous ici directement. 👑",
        adminErreur: "❌ Erreur de connexion. Réessaie depuis ton QG.",
        rdvConfirme: (id) => `✅ *Rendez-vous #${id} confirmé !*\n\nÀ bientôt 🙏`,
        rdvAnnule: (id) => `❌ *Rendez-vous #${id} annulé.*\n\nSi c'est une erreur, répondez-nous 😊`,
        rdvChoisirHeure: "🕐 Choisis un créneau :",
        rdvJourComplet: "😔 Ce jour est complet, choisis-en un autre.",
        rdvExpire: "⏳ Ce calendrier a expiré, redemande un rendez-vous.",
        rdvCree: (date) => `✅ *Rendez-vous confirmé !*\n\n🗓️ ${date}\n\nÀ bientôt 🙏`,
        commandeConfirmee: (id) => `✅ *Commande #${id} confirmée !*\n\nNous préparons le colis 📦\nMerci de votre confiance 🙏`,
        commandeAnnuleeId: (id) => `❌ *Commande #${id} annulée.*\n\nSi c'est une erreur, répondez-nous 😊`,
        idChat: (chatId) => `🆔 Chat ID : \`${chatId}\``,
    },
    en: {
        bienvenueClient: "👑 *Welcome!*\n\nI'm SAMII, your assistant. How can I help you today?",
        bienvenueGenerique: (chatId) => `👑 *Welcome to SAMII OS!*\n\n✅ Chat ID: \`${chatId}\`\n\nI'm SAMII, your assistant. How can I help?`,
        adminConnecte: "✅ *Telegram connected to your QG!*\n\nYou'll now receive all your orders/appointments here directly. 👑",
        adminErreur: "❌ Connection error. Try again from your QG.",
        rdvConfirme: (id) => `✅ *Appointment #${id} confirmed!*\n\nSee you soon 🙏`,
        rdvAnnule: (id) => `❌ *Appointment #${id} cancelled.*\n\nIf this is a mistake, reply to us 😊`,
        rdvChoisirHeure: "🕐 Pick a time slot:",
        rdvJourComplet: "😔 This day is fully booked, pick another one.",
        rdvExpire: "⏳ This calendar has expired, ask for an appointment again.",
        rdvCree: (date) => `✅ *Appointment confirmed!*\n\n🗓️ ${date}\n\nSee you soon 🙏`,
        commandeConfirmee: (id) => `✅ *Order #${id} confirmed!*\n\nWe're preparing your package 📦\nThank you for your trust 🙏`,
        commandeAnnuleeId: (id) => `❌ *Order #${id} cancelled.*\n\nIf this is a mistake, reply to us 😊`,
        idChat: (chatId) => `🆔 Chat ID: \`${chatId}\``,
    },
    ar: {
        bienvenueClient: "👑 *مرحباً!*\n\nأنا سامي، مساعدك. كيف يمكنني مساعدتك اليوم؟",
        bienvenueGenerique: (chatId) => `👑 *مرحباً بك في SAMII OS!*\n\n✅ Chat ID: \`${chatId}\`\n\nأنا سامي، مساعدك. كيف يمكنني مساعدتك؟`,
        adminConnecte: "✅ *تم ربط تيليجرام بمركز قيادتك!*\n\nستستقبل الآن جميع طلباتك ومواعيدك هنا مباشرة. 👑",
        adminErreur: "❌ خطأ في الاتصال. حاول مرة أخرى من مركز القيادة.",
        rdvConfirme: (id) => `✅ *تم تأكيد الموعد #${id}!*\n\nإلى اللقاء 🙏`,
        rdvAnnule: (id) => `❌ *تم إلغاء الموعد #${id}.*\n\nإذا كان هذا خطأ، يرجى الرد علينا 😊`,
        rdvChoisirHeure: "🕐 اختر موعداً:",
        rdvJourComplet: "😔 هذا اليوم محجوز بالكامل، اختر يوماً آخر.",
        rdvExpire: "⏳ انتهت صلاحية هذا التقويم، اطلب موعداً من جديد.",
        rdvCree: (date) => `✅ *تم تأكيد الموعد!*\n\n🗓️ ${date}\n\nإلى اللقاء 🙏`,
        commandeConfirmee: (id) => `✅ *تم تأكيد الطلب #${id}!*\n\nنحضّر طردك 📦\nشكراً لثقتك 🙏`,
        commandeAnnuleeId: (id) => `❌ *تم إلغاء الطلب #${id}.*\n\nإذا كان هذا خطأ، يرجى الرد علينا 😊`,
        idChat: (chatId) => `🆔 Chat ID: \`${chatId}\``,
    },
};

function tr(lang, key, ...args) {
    const dict = T[lang] || T.fr;
    const entry = dict[key] || T.fr[key];
    return typeof entry === "function" ? entry(...args) : entry;
}

// ── Note vocale : Telegram ne fournit qu'un file_id, il faut d'abord
// résoudre son chemin de téléchargement réel via getFile avant de pouvoir
// récupérer l'audio et le transcrire (Groq Whisper, gratuit).
async function transcribeVoice(fileId, base) {
    try {
        const { data } = await axios.get(`${base}/getFile`, { params: { file_id: fileId } });
        const filePath = data?.result?.file_path;
        if (!filePath) return "";
        const fileUrl = `${base.replace("api.telegram.org/bot", "api.telegram.org/file/bot")}/${filePath}`;
        return await transcription.transcribeFromUrl(fileUrl, "voice.oga");
    } catch (err) {
        console.error("❌ Telegram transcribeVoice :", err.response?.data || err.message);
        return "";
    }
}

async function reply(chatId, text, base = BASE) {
    try {
        await axios.post(`${base}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: "Markdown",
        });
    } catch (err) {
        console.error("❌ Telegram reply :", err.response?.data || err.message);
    }
}

// ── LIAISON WORKSPACE ──────────────────────────────────────────
async function linkClientToWorkspace(chatId, workspaceId) {
    try {
        const existing = await db.query(
            `SELECT id FROM connecteurs WHERE type = 'telegram_client' AND config LIKE $1`,
            [`%"chatId":"${chatId}"%`]
        );
        if (existing.length > 0) return;
        await db.query(
            `INSERT INTO connecteurs (workspace_id, type, config, actif) VALUES ($1, 'telegram_client', $2, true)`,
            [workspaceId, JSON.stringify({ chatId: String(chatId), linkedAt: new Date().toISOString() })]
        );
        console.log(`🔗 Client ${chatId} lié au workspace ${workspaceId}`);
    } catch (err) {
        console.error("❌ linkClientToWorkspace :", err.message);
    }
}

async function linkMerchantToWorkspace(chatId, workspaceId) {
    try {
        const existing = await db.query(
            `SELECT id FROM connecteurs WHERE type = 'telegram' AND workspace_id = $1`,
            [workspaceId]
        );
        const config = JSON.stringify({ chatId: String(chatId), connectedAt: new Date().toISOString() });
        if (existing.length > 0) {
            await db.query(`UPDATE connecteurs SET config = $1, actif = true WHERE id = $2`, [config, existing[0].id]);
            return true;
        }
        await db.query(
            `INSERT INTO connecteurs (workspace_id, type, config, actif) VALUES ($1, 'telegram', $2, true)`,
            [workspaceId, config]
        );
        return true;
    } catch (err) {
        console.error("❌ linkMerchantToWorkspace :", err.message);
        return false;
    }
}

async function getClientWorkspace(chatId) {
    try {
        // Correspondance exacte sur la clé JSON "chatId" — un LIKE brut sur le
        // chatId matchait aussi n'importe quel autre chatId qui le contient
        // comme sous-chaîne (ex: "12345" matchait aussi "112345"), ce qui
        // pouvait relier un client/marchand à la mauvaise boutique dès qu'il
        // existait plusieurs connecteurs Telegram en base.
        const rows = await db.query(
            `SELECT workspace_id FROM connecteurs WHERE type = 'telegram_client' AND config LIKE $1 ORDER BY id DESC LIMIT 1`,
            [`%"chatId":"${chatId}"%`]
        );
        return rows[0]?.workspace_id || "";
    } catch { return ""; }
}

async function getWorkspaceByChatId(chatId) {
    try {
        const rows = await db.query(
            `SELECT workspace_id FROM connecteurs WHERE type = 'telegram' AND actif = true AND config LIKE $1 ORDER BY id DESC LIMIT 1`,
            [`%"chatId":"${chatId}"%`]
        );
        return rows[0]?.workspace_id || "";
    } catch { return ""; }
}

async function getMetierWorkspace(workspaceId) {
    try {
        if (!workspaceId) return "";
        const rows = await db.query(`SELECT metier FROM workspaces WHERE id = $1`, [workspaceId]);
        return rows[0]?.metier || "";
    } catch { return ""; }
}

// ── Traite une mise à jour Telegram, pour n'importe quel bot ──────────────
async function handleUpdate(body, base, forcedWorkspaceId) {
    try {
        const memKey = (chatId) => forcedWorkspaceId ? `tg_${forcedWorkspaceId}_${chatId}` : String(chatId);

        // Les groupes/communautés passent par l'agent communautaire dédié.
        // Cela évite de mélanger la mémoire collective avec une conversation privée.
        if (body.message && telegramCommunity.isGroup(body.message)) {
            await telegramCommunity.handleMessage(body.message, base, {
                workspaceId: forcedWorkspaceId || ""
            });
            return;
        }

        if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const data = cb.data || "";
            const lang = (await memory.get(memKey(chatId)))?.lang || "fr";

            await axios.post(`${base}/answerCallbackQuery`, { callback_query_id: cb.id, text: "⚙️ SAMII..." });

            if (data.startsWith("confirm_")) {
                const orderId = data.replace("confirm_", "");
                const rows = await db.query(`UPDATE commandes SET statut = 'confirmée', confirme_le = now() WHERE id = $1 RETURNING workspace_id`, [orderId]);
                if (rows[0]?.workspace_id) confirmationsQuota.enregistrerSiDepassement(rows[0].workspace_id, orderId).catch(() => {});
                await orchestrator.process({ type: "order.confirmed", shop: "", payload: { orderId, chatId } });
                evenements.publier(rows[0]?.workspace_id, "commande.confirmee", { id: orderId, source: "telegram" });
                await reply(chatId, tr(lang, "commandeConfirmee", orderId), base);
                return;
            }
            if (data.startsWith("cancel_")) {
                const orderId = data.replace("cancel_", "");
                const rows = await db.query(`UPDATE commandes SET statut = 'annulée' WHERE id = $1 RETURNING workspace_id`, [orderId]);
                await orchestrator.process({ type: "order.cancelled.telegram", shop: "", payload: { orderId, chatId } });
                evenements.publier(rows[0]?.workspace_id, "commande.annulee", { id: orderId, source: "telegram" });
                await reply(chatId, tr(lang, "commandeAnnuleeId", orderId), base);
                return;
            }
            if (data.startsWith("rdvconfirm_")) {
                const rdvId = data.replace("rdvconfirm_", "");
                const rows = await db.query(`UPDATE rendez_vous SET statut = 'confirmé' WHERE id = $1 RETURNING workspace_id`, [rdvId.replace("RDV-", "")]);
                evenements.publier(rows[0]?.workspace_id, "rendezvous.confirme", { id: rdvId, source: "telegram" });
                await reply(chatId, tr(lang, "rdvConfirme", rdvId), base);
                return;
            }
            if (data.startsWith("rdvcancel_")) {
                const rdvId = data.replace("rdvcancel_", "");
                const rows = await db.query(`UPDATE rendez_vous SET statut = 'annulé' WHERE id = $1 RETURNING workspace_id`, [rdvId.replace("RDV-", "")]);
                evenements.publier(rows[0]?.workspace_id, "rendezvous.annule", { id: rdvId, source: "telegram" });
                await reply(chatId, tr(lang, "rdvAnnule", rdvId), base);
                return;
            }

            if (data.startsWith("rdvday_")) {
                const [, draftId, dateISO] = data.match(/^rdvday_(\d+)_(\d{4}-\d{2}-\d{2})$/) || [];
                if (!draftId) return;
                const draftRows = await db.query(`SELECT workspace_id FROM rendez_vous WHERE id = $1 AND statut = 'brouillon'`, [draftId]);
                const workspaceId = draftRows[0]?.workspace_id;
                if (!workspaceId) { await reply(chatId, tr(lang, "rdvExpire"), base); return; }

                const commerceEngine = require("../engines/commerceEngine");
                const creneaux = await commerceEngine.creneauxLibresPourJour(workspaceId, dateISO);
                if (!creneaux.length) { await reply(chatId, tr(lang, "rdvJourComplet"), base); return; }

                const boutons = [];
                for (let i = 0; i < creneaux.length; i += 3) {
                    boutons.push(creneaux.slice(i, i + 3).map(c => ({
                        text: c.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
                        callback_data: `rdvslot_${draftId}_${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}T${String(c.getHours()).padStart(2, "0")}:${String(c.getMinutes()).padStart(2, "0")}:00`,
                    })));
                }
                await require("../services/telegramService").sendWithKeyboard(chatId, tr(lang, "rdvChoisirHeure"), boutons, forcedWorkspaceId);
                return;
            }

            if (data.startsWith("rdvslot_")) {
                const [, draftId, dateRdv] = data.match(/^rdvslot_(\d+)_(.+)$/) || [];
                if (!draftId) return;
                const commerceEngine = require("../engines/commerceEngine");
                const rdv = await commerceEngine.finaliserCreneauRdv(draftId, dateRdv);
                if (!rdv) { await reply(chatId, tr(lang, "rdvExpire"), base); return; }
                await reply(chatId, tr(lang, "rdvCree", new Date(rdv.date_rdv).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })), base);
                return;
            }

            await orchestrator.process({ type: "telegram.callback", shop: "", payload: { chatId, data, cb } });
            return;
        }

        const message = body.message;
        if (!message) return;

        const chatId = message.chat.id;
        let text = (message.text || "").trim();
        if (!text && message.voice?.file_id) {
            text = (await transcribeVoice(message.voice.file_id, base)).trim();
        }
        const name = message.from?.first_name || "Client";
        const langDetectee = detecterLangue(message);
        const lang = (await memory.get(memKey(chatId)))?.lang || langDetectee;

        console.log(`📨 Telegram [${name}] (${lang}) : ${text}`);

        if (text.startsWith("/start")) {
            await memory.clear(memKey(chatId));

            if (forcedWorkspaceId) {
                await reply(chatId, tr(lang, "bienvenueClient"), base);
                return;
            }

            const param = text.split(" ")[1] || null;

            if (param && param.startsWith("admin_")) {
                const workspaceId = param.replace("admin_", "");
                const ok = await linkMerchantToWorkspace(chatId, workspaceId);
                await reply(chatId, ok ? tr(lang, "adminConnecte") : tr(lang, "adminErreur"), base);
                return;
            }

            if (param) {
                await linkClientToWorkspace(chatId, param);
                await reply(chatId, tr(lang, "bienvenueClient"), base);
                return;
            }

            await reply(chatId, tr(lang, "bienvenueGenerique", chatId), base);
            return;
        }

        if (text === "/id") { await reply(chatId, tr(lang, "idChat", chatId), base); return; }

        let workspaceId = forcedWorkspaceId;
        if (!workspaceId) {
            workspaceId = await getClientWorkspace(chatId);
            if (!workspaceId) workspaceId = await getWorkspaceByChatId(chatId);
        }
        const metier   = await getMetierWorkspace(workspaceId);
        const produits = workspaceId ? await produitsService.getProduitsDuWorkspace(workspaceId) : [];

        const session      = await memory.get(memKey(chatId)) || {};
        const conversation = session.history || [];

        await orchestrator.process({ type: "telegram.message", shop: "", payload: { chatId, text, message } });
        // `actes` recueille ce que SAMII EXÉCUTE pendant ce tour : une
        // commande enregistrée, un rendez-vous posé. Le client ne paie rien —
        // il n'a même pas de compte ici. C'est le marchand qui reçoit la
        // commande, donc c'est lui qui règle l'acte, et lui seul.
        const actes = [];
        const geminiReply = await planner.ask(text, {
            source: "telegram", chatId, name, lang, audience: "client",
            workspaceId, metier, produits,
        }, conversation, actes);
        await reply(chatId, geminiReply, base);

        // Après la réponse, jamais avant, et sans jamais bloquer : la
        // conversation d'un client ne s'arrête pas parce que son marchand
        // n'a plus de solde. Voir creditsSamii.facturerActesWorkspace.
        await creditsSamii.facturerActesWorkspace(workspaceId, actes, {
            // Le QG entre dans la référence. Un numéro de discussion plus un
            // numéro de message ne distinguent RIEN entre deux marchands :
            // deux bots produisent les mêmes. Sans le QG ici, deux actes
            // différents se ressemblent — et l'un des deux passe pour un
            // rejeu de l'autre.
            ref: `tg:${workspaceId || "-"}:${chatId}:${message?.message_id || Date.now()}`,
            motif: "SAMII sur Telegram",
        });

        const nextHistory = [...conversation, { role: "user", message: text }, { role: "model", message: geminiReply }].slice(-60);
        await memory.set(memKey(chatId), { ...session, lang, history: nextHistory });
    } catch (err) {
        console.error("❌ Telegram webhook :", err.message);
    }
}

// Le 200 est envoyé APRÈS la vérification, plus avant. Il partait en premier
// pour que Telegram ne réessaie pas pendant que le modèle réfléchit — c'est
// juste, mais ça acquittait aussi les requêtes forgées. Vérifier d'abord ne
// coûte rien : aucun appel réseau, un condensé.
router.post("/", async (req, res) => {
    if (!await verifierSecret(req, res, null)) return;
    res.sendStatus(200);
    handleUpdate(req.body, BASE, null);
});

router.post("/:workspaceId", async (req, res) => {
    if (!await verifierSecret(req, res, req.params.workspaceId)) return;
    res.sendStatus(200);
    const base = await resolveBotBase(req.params.workspaceId);
    handleUpdate(req.body, base, req.params.workspaceId);
});

// Exporté pour que routes/connector.js pose le MÊME secret à setWebhook, et
// pour que la suite de tests le recalcule sans recopier la formule. Deux
// copies de cette dérivation finiraient par diverger, et le jour où elles
// divergent tous les bots tombent d'un coup.
module.exports = router;
module.exports.secretPour = secretPour;   // APRÈS l'affectation, sinon elle l'écrase
