// ==========================================================================
// OG TECHNOLOGY — CONNEXION OAUTH META (Facebook + Instagram)
// ==========================================================================
const express = require("express");
const axios = require("axios");
const CONFIG = require("../config");
const connectorService = require("../services/connectorService");
const workspaceService = require("../services/workspaceService");
const meta = require("../services/meta");
const orchestrator = require("../brain/orchestrator");
const planner = require("../brain/planner");
const memory = require("../brain/memory");
const socketService = require("../services/socketService");
const db = require("../services/db");
const journalService = require("../services/journalService");
const produitsService = require("../services/produitsService");
const router = express.Router();

const APP_ID = CONFIG.META.APP_ID;
const APP_SECRET = CONFIG.META.APP_SECRET;
const REDIRECT_URI = CONFIG.META.REDIRECT_URI;
const GRAPH_VERSION = "v23.0";

// ── DIAGNOSTIC EN COURS (16-17/08/2026) ────────────────────────────────────
// Lot 1 (public_profile, email, pages_show_list) confirmé OK le 16/08.
// Lot 2 (business_management, ads_management, ads_read) confirmé OK —
// c'est cette liste (Lot 1 + 2) qui fait marcher /ads/settings et
// /ads/create, revenu à cet état stable le 17/08.
//
// Lot 3 (publication sur la Page) remis le 17/08 après vérification dans le
// tableau de bord Meta : sous le cas d'utilisation "Gérez des Pages", ces
// permissions sont bien listées "Prête pour le test".
// pages_read_user_content est volontairement EXCLUE : c'est la seule du lot
// qui n'affiche pas ce statut, et c'est précisément celle que Facebook
// rejetait avec "Invalid Scopes" (y compris quand elle n'était pas demandée).
//
// Lot 4 (Instagram) : le préfixe "instagram_business_*" (supposé obligatoire
// depuis 2025 d'après la doc générale) est en fait INVALIDE pour cette app
// précise — vérifié le 17/08 dans "Autorisations et fonctionnalités" :
// instagram_manage_messages (ancien nom) affiche "Prête pour le test",
// alors qu'instagram_business_manage_messages n'affiche aucun statut. On
// utilise donc l'ancien nommage, confirmé actif sur cette app.
//
// instagram_content_publish et instagram_manage_comments retirées le 22/08 :
// Facebook rejette l'écran de consentement entier avec "Invalid Scopes" tant
// qu'elles sont demandées — pas encore activées/validées pour cette app,
// contrairement à instagram_manage_messages. À réintroduire seulement une
// fois confirmées "Prête pour le test" dans Autorisations et fonctionnalités.
//
// pages_manage_engagement retirée le 22/08 : cette permission a une
// dépendance obligatoire côté Facebook envers pages_read_user_content (pour
// pouvoir gérer des commentaires, il faut d'abord pouvoir les lire) — or
// pages_read_user_content n'est pas activée pour cette app (seule permission
// du lot 3 qui n'affiche pas "Prête pour le test"). Facebook rejetait donc
// TOUT le login avec "Invalid Scopes: pages_read_user_content" à cause de
// cette dépendance manquante, même si elle n'était jamais demandée
// directement. La réponse auto aux commentaires Facebook
// (meta.replyToFacebookComment) reste indisponible tant que
// pages_read_user_content n'est pas activée pour l'app.
const SCOPES = [
    "public_profile",
    "email",
    "pages_show_list",
    "business_management",
    "ads_management",
    "ads_read",
    "pages_manage_ads",
    "pages_manage_posts",
    "pages_manage_metadata",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_manage_messages",
    // Sans cette permission, publier sur Instagram échoue à l'exécution :
    // instagram_basic ne donne que la lecture du profil et des médias. Le
    // code de publication (services/meta.publishInstagramPost, en deux temps
    // conteneur puis media_publish) était correct, mais la permission n'était
    // jamais demandée — la publication Instagram automatique ne pouvait donc
    // pas fonctionner. Comme les autres permissions avancées, elle doit être
    // approuvée par Meta pour valoir au-delà des comptes de test de l'app.
    "instagram_content_publish",
].join(",");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// ── Réponse automatique aux clients sur Messenger / Instagram DM ──────────
// Miroir de routes/webhook-whatsapp.js et routes/telegram.js : SAMII raisonne
// lui-même la conversation via function-calling (brain/planner), tous métiers.
async function resolveConnecteur(canal, externalId) {
    if (!externalId) return null;
    try {
        const idField = canal === "instagram" ? "igAccountId" : "pageId";
        const rows = await db.query(
            `SELECT workspace_id, config FROM connecteurs WHERE type = $1 AND actif = true AND config LIKE $2`,
            [canal, `%"${idField}":"${externalId}"%`]
        );
        if (!rows[0]) return null;
        const config = typeof rows[0].config === "string" ? JSON.parse(rows[0].config) : rows[0].config;
        return { workspaceId: rows[0].workspace_id, config };
    } catch {
        return null;
    }
}

async function getMetierWorkspace(workspaceId) {
    try {
        const rows = await db.query(`SELECT metier FROM workspaces WHERE id = $1`, [workspaceId]);
        return rows[0]?.metier || "";
    } catch { return ""; }
}

router.get("/webhook/meta", (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        console.log("✅ Webhook Meta vérifié");
        res.status(200).send(challenge);
    } else {
        console.log("❌ Webhook Meta — token invalide");
        res.sendStatus(403);
    }
});

router.post("/webhook/meta", async (req, res) => {
    res.sendStatus(200);
    try {
        // Monté sous /webhook, où express.raw() laisse le body en Buffer brut.
        const raw = req.body;
        const body = Buffer.isBuffer(raw) ? JSON.parse(raw.toString("utf8") || "{}") : (raw || {});

        // ── WhatsApp Cloud API (numéro officiel OG Technology) ────────────
        // Distinct du webhook Green API (routes/webhook-whatsapp.js) qui sert
        // tous les marchands — celui-ci ne traite que le canal officiel SAMII,
        // routé directement sur CONFIG.META.OG_WORKSPACE_ID (pas encore de
        // résolution multi-marchand, prévu plus tard pour ceux qui passeront
        // par leur propre numéro Cloud API).
        if (body.object === "whatsapp_business_account") {
            const workspaceId = CONFIG.META.OG_WORKSPACE_ID;
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    if (change.field !== "messages") continue;
                    const value = change.value || {};
                    for (const msg of value.messages || []) {
                        if (msg.type !== "text" || !msg.text?.body) continue;

                        const sender = msg.from;
                        const text = msg.text.body.trim();
                        const senderName = value.contacts?.[0]?.profile?.name || "Client";
                        if (!sender || !text) continue;

                        console.log(`💬 WhatsApp Cloud [${senderName}] (workspace ${workspaceId}) : ${text}`);

                        await journalService.log({ action: "whatsapp.message", details: `${senderName}: ${text}`, workspaceId });

                        try {
                            await orchestrator.process({
                                type: "whatsapp.message",
                                shop: workspaceId,
                                payload: { senderName, sender, message: text },
                            });
                        } catch (procErr) {
                            console.error("❌ WhatsApp Cloud orchestrator :", procErr.message);
                        }

                        socketService.emitToShop(workspaceId, "whatsapp.message", { senderName, message: text });

                        const key = `wa_${sender}`;
                        const session = await memory.get(key) || {};
                        const conversation = session.history || [];

                        const geminiReply = await planner.ask(text, {
                            source: "whatsapp", chatId: sender, name: senderName, audience: "client",
                            workspaceId,
                        }, conversation);

                        const whatsapp = require("../services/whatsapp");
                        await whatsapp.send({ to: sender, message: geminiReply, workspaceId });

                        const nextHistory = [...conversation, { role: "user", message: text }, { role: "model", message: geminiReply }].slice(-60);
                        await memory.set(key, { ...session, history: nextHistory });
                    }
                }
            }
            return;
        }

        if (!["page", "instagram"].includes(body.object)) return;
        const canal = body.object === "instagram" ? "instagram" : "facebook";

        for (const entry of body.entry || []) {
            for (const event of entry.messaging || []) {
                const text = event.message?.text;
                const senderId = event.sender?.id;
                if (!text || !senderId || event.message?.is_echo) continue;

                const connecteur = await resolveConnecteur(canal, entry.id);
                if (!connecteur) {
                    console.log(`⚠️ Webhook Meta (${canal}) : aucun workspace connecté pour ${entry.id}`);
                    continue;
                }
                const { workspaceId, config } = connecteur;

                console.log(`💬 ${canal} [${senderId}] (workspace ${workspaceId}) : ${text}`);

                await journalService.log({ action: `${canal}.message`, details: `${senderId}: ${text}`, workspaceId });

                try {
                    await orchestrator.process({
                        type: `${canal}.message`,
                        shop: workspaceId,
                        payload: { senderName: senderId, sender: senderId, message: text },
                    });
                } catch (procErr) {
                    console.error(`❌ ${canal} orchestrator :`, procErr.message);
                }

                socketService.emitToShop(workspaceId, `${canal}.message`, { senderId, message: text });

                const key = `${canal}_${senderId}`;
                const session = await memory.get(key) || {};
                const conversation = session.history || [];

                const metier = await getMetierWorkspace(workspaceId);
                const produits = await produitsService.getProduitsDuWorkspace(workspaceId);

                const geminiReply = await planner.ask(text, {
                    source: canal, chatId: senderId, name: senderId, audience: "client",
                    workspaceId, metier, produits,
                }, conversation);

                await meta.sendMessage(config.pageAccessToken, senderId, geminiReply);

                const nextHistory = [...conversation, { role: "user", message: text }, { role: "model", message: geminiReply }].slice(-60);
                await memory.set(key, { ...session, history: nextHistory });
            }

            // ── Commentaires publics (posts) + avis de Page ────────────────
            // Miroir du bloc messagerie ci-dessus, mais pour ce qui se passe
            // publiquement sur Meta plutôt qu'en message privé. Nécessite que
            // la Page (champ "feed"/"ratings") et le compte Instagram (champ
            // "comments") soient abonnés à ces webhooks côté App Meta.
            for (const change of entry.changes || []) {
                try {
                    if (canal === "facebook" && change.field === "feed") {
                        const value = change.value || {};
                        if (value.item !== "comment" || value.verb !== "add") continue;
                        if (!value.message || !value.comment_id) continue;
                        if (value.sender_id === entry.id) continue; // notre propre réponse (évite la boucle infinie)
                        if (value.parent_id && value.post_id && value.parent_id !== value.post_id) continue; // réponse imbriquée, pas un commentaire de premier niveau

                        const connecteur = await resolveConnecteur("facebook", entry.id);
                        if (!connecteur) continue;
                        const { workspaceId, config } = connecteur;

                        console.log(`💬 [commentaire FB] workspace ${workspaceId} : ${value.message}`);

                        await journalService.log({ action: "facebook.comment", details: `${value.sender_name || value.sender_id}: ${value.message}`, workspaceId });
                        socketService.emitToShop(workspaceId, "facebook.comment", {
                            senderId: value.sender_id, senderName: value.sender_name,
                            message: value.message, postId: value.post_id,
                        });

                        const metier = await getMetierWorkspace(workspaceId);
                        const produits = await produitsService.getProduitsDuWorkspace(workspaceId);
                        const reply = await planner.ask(value.message, {
                            source: "facebook_comment", chatId: value.comment_id,
                            name: value.sender_name || "client", audience: "client",
                            workspaceId, metier, produits,
                        }, []);

                        await meta.replyToFacebookComment(config.pageAccessToken, value.comment_id, reply);
                    }

                    if (canal === "instagram" && change.field === "comments") {
                        const value = change.value || {};
                        if (!value.text || !value.id) continue;
                        if (value.from?.id === entry.id) continue; // notre propre réponse

                        const connecteur = await resolveConnecteur("instagram", entry.id);
                        if (!connecteur) continue;
                        const { workspaceId, config } = connecteur;

                        console.log(`💬 [commentaire IG] workspace ${workspaceId} : ${value.text}`);

                        await journalService.log({ action: "instagram.comment", details: `${value.from?.username || value.from?.id}: ${value.text}`, workspaceId });
                        socketService.emitToShop(workspaceId, "instagram.comment", {
                            senderId: value.from?.id, senderName: value.from?.username,
                            message: value.text, mediaId: value.media?.id,
                        });

                        const metier = await getMetierWorkspace(workspaceId);
                        const produits = await produitsService.getProduitsDuWorkspace(workspaceId);
                        const reply = await planner.ask(value.text, {
                            source: "instagram_comment", chatId: value.id,
                            name: value.from?.username || "client", audience: "client",
                            workspaceId, metier, produits,
                        }, []);

                        await meta.replyToInstagramComment(config.pageAccessToken, value.id, reply);
                    }

                    if (canal === "facebook" && change.field === "ratings") {
                        // Meta ne fournit aucun endpoint public pour répondre par API
                        // à un avis/recommandation de Page (contrairement aux
                        // commentaires) — seule une réponse manuelle via Meta
                        // Business Suite est possible côté Meta. On notifie le
                        // marchand en temps réel plutôt que de rester silencieux.
                        const value = change.value || {};
                        const connecteur = await resolveConnecteur("facebook", entry.id);
                        if (!connecteur) continue;
                        const { workspaceId } = connecteur;

                        await journalService.log({ action: "facebook.review", details: `${value.reviewer_name || value.reviewer_id} (${value.rating ?? "?"}/5) : ${value.review_text || ""}`, workspaceId });
                        socketService.emitToShop(workspaceId, "facebook.review", {
                            reviewerName: value.reviewer_name, rating: value.rating, text: value.review_text,
                        });
                        console.log(`⭐ Nouvel avis Facebook (workspace ${workspaceId}) — réponse manuelle requise (Meta Business Suite).`);
                    }
                } catch (changeErr) {
                    console.error("❌ Webhook Meta (changes) :", changeErr.response?.data || changeErr.message);
                }
            }
        }
    } catch (err) {
        console.error("❌ Webhook Meta (messages) :", err.message);
    }
});

router.get("/auth/meta", requireAuth, (req, res) => {
    // Empêche le navigateur (ou un cache intermédiaire type Cloudflare) de
    // servir une ancienne redirection avec une vieille liste de scopes —
    // vu en test le 17/08 : une redirection vers une URL contenant un scope
    // qui n'existe plus dans SCOPES depuis plusieurs déploiements.
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const authUrl =
        `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth` +
        `?client_id=${APP_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${SCOPES}` +
        // Sans ça, Facebook ne réaffiche pas l'écran de permissions pour un
        // compte qui a déjà autorisé l'app par le passé — il renvoie
        // silencieusement le même token limité aux anciennes permissions,
        // même si SCOPES a changé côté code. "rerequest" force le dialogue
        // à demander les permissions manquantes/nouvelles à chaque connexion.
        `&auth_type=rerequest` +
        `&response_type=code`;
    res.redirect(authUrl);
});

router.get("/auth/meta/callback", requireAuth, async (req, res) => {
    const { code, error, error_description, error_code, error_message } = req.query;

    if (error || error_code) {
        return res.send(`<p>Connexion annulée ou refusée : ${error_description || error || error_message || error_code}</p>`);
    }
    if (!code) {
        return res.send("<p>Code d'autorisation manquant.</p>");
    }

    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");

        const tokenRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`, {
            params: {
                client_id: APP_ID,
                client_secret: APP_SECRET,
                redirect_uri: REDIRECT_URI,
                code,
            },
        });
        const shortLivedToken = tokenRes.data.access_token;

        // Le token obtenu ci-dessus expire en 1-2h — on l'échange contre un
        // token longue durée (~60 jours) pour que pubs et messages continuent
        // de marcher après la session de connexion.
        const longLivedRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`, {
            params: {
                grant_type: "fb_exchange_token",
                client_id: APP_ID,
                client_secret: APP_SECRET,
                fb_exchange_token: shortLivedToken,
            },
        });
        const accessToken = longLivedRes.data.access_token || shortLivedToken;

        const pagesRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`, {
            params: { fields: "id,name,access_token", access_token: accessToken },
        });
        const page = (pagesRes.data.data || [])[0] || null;

        let igAccountId = "";
        if (page) {
            try {
                const igRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${page.id}`, {
                    params: { fields: "instagram_business_account", access_token: page.access_token },
                });
                igAccountId = igRes.data.instagram_business_account?.id || "";
            } catch (igErr) {
                console.warn("⚠️ Pas de compte Instagram lié à la page :", igErr.response?.data?.error?.message || igErr.message);
            }
        }

        let adAccountId = "";
        try {
            const adAccountsRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts`, {
                params: { fields: "account_id,name", access_token: accessToken },
            });
            const firstAdAccount = (adAccountsRes.data.data || [])[0];
            if (firstAdAccount) adAccountId = `act_${firstAdAccount.account_id}`;
        } catch (adErr) {
            console.warn("⚠️ Aucun compte pub Meta trouvé :", adErr.response?.data?.error?.message || adErr.message);
        }

        await connectorService.save(workspaceId, "facebook", {
            pageId: page?.id || "",
            pageName: page?.name || "",
            pageAccessToken: page?.access_token || "",
            connectedAt: new Date().toISOString(),
        });

        // Sans cet appel, la Page ne pousse JAMAIS d'événement vers notre
        // webhook (POST /webhook/meta) même si l'app a la permission et le
        // webhook produit est configuré côté Meta — l'abonnement se fait
        // Page par Page, pas au niveau de l'app. C'est ce qui manquait pour
        // que la réponse auto Messenger/Instagram/commentaires se déclenche
        // réellement après une connexion.
        if (page?.id && page?.access_token) {
            try {
                await axios.post(`https://graph.facebook.com/${GRAPH_VERSION}/${page.id}/subscribed_apps`, null, {
                    params: {
                        subscribed_fields: "messages,messaging_postbacks,feed",
                        access_token: page.access_token,
                    },
                });
                console.log(`✅ Page ${page.id} abonnée au webhook Meta (workspace ${workspaceId})`);
            } catch (subErr) {
                console.error("❌ Abonnement subscribed_apps :", subErr.response?.data?.error?.message || subErr.message);
            }
        }

        if (igAccountId) {
            await connectorService.save(workspaceId, "instagram", {
                igAccountId,
                pageId: page?.id || "",
                pageAccessToken: page?.access_token || "",
                connectedAt: new Date().toISOString(),
            });
        }

        // Alimente directement les réglages Ads (routes/ads.js) : "Connecter Meta"
        // suffit désormais à lancer des campagnes, plus besoin de coller le
        // token/ad account/page ID à la main dans /ads/settings.
        const workspace = await workspaceService.getById(workspaceId);
        if (workspace) {
            await workspaceService.update(workspace.recordId, {
                meta_access_token : accessToken,
                meta_ad_account_id: adAccountId || workspace.metaAdAccountId || "",
                meta_page_id      : page?.id || workspace.metaPageId || "",
            });
        }

        res.redirect("/connect/tools");

    } catch (err) {
        console.error("Erreur OAuth Meta:", err.response?.data || err.message);
        res.status(500).send("Erreur lors de la connexion à Meta. Vérifie les logs serveur.");
    }
});

module.exports = router;
