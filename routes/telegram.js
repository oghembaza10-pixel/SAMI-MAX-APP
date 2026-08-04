// ==========================================================================
// SAMII OS — TELEGRAM WEBHOOK — V2 PostgreSQL (remplace Airtable)
// ==========================================================================
const express      = require("express");
const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");
const planner      = require("../brain/planner");
const memory       = require("../brain/memory");
const db           = require("../services/db");

const router = express.Router();
const TOKEN  = CONFIG.TELEGRAM.BOT_TOKEN;
const BASE   = `https://api.telegram.org/bot${TOKEN}`;

async function reply(chatId, text) {
    try {
        await axios.post(`${BASE}/sendMessage`, {
            chat_id   : chatId,
            text,
            parse_mode: "Markdown",
        });
    } catch (err) {
        console.error("❌ Telegram reply :", err.response?.data || err.message);
    }
}

async function linkClientToWorkspace(chatId, workspaceId) {
    try {
        const existing = await db.query(
            `SELECT id FROM connecteurs WHERE type = 'telegram_client' AND config LIKE $1`,
            [`%${chatId}%`]
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
            await db.query(
                `UPDATE connecteurs SET config = $1, actif = true WHERE id = $2`,
                [config, existing[0].id]
            );
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
        const rows = await db.query(
            `SELECT workspace_id FROM connecteurs WHERE type = 'telegram_client' AND config LIKE $1`,
            [`%${chatId}%`]
        );
        return rows[0]?.workspace_id || "";
    } catch { return ""; }
}

async function getWorkspaceByChatId(chatId) {
    try {
        const rows = await db.query(
            `SELECT workspace_id FROM connecteurs WHERE type = 'telegram' AND actif = true AND config LIKE $1`,
            [`%${chatId}%`]
        );
        return rows[0]?.workspace_id || "";
    } catch { return ""; }
}

async function getAdminChatId(workspaceId) {
    try {
        if (!workspaceId) return null;
        const rows = await db.query(
            `SELECT config FROM connecteurs WHERE type = 'telegram' AND actif = true AND workspace_id = $1`,
            [workspaceId]
        );
        if (!rows[0]) return null;
        const config = JSON.parse(rows[0].config || "{}");
        return config.chatId || null;
    } catch { return null; }
}

function genOrderId() {
    return `TG-${Date.now().toString().slice(-6)}`;
}

async function getProduitsDuWorkspace(workspaceId) {
    try {
        return await db.query(
            `SELECT id, nom, prix FROM produits WHERE workspace_id = $1 AND actif = true ORDER BY nom`,
            [workspaceId]
        );
    } catch {
        return [];
    }
}

async function handleOrderFlow(chatId, text, name) {
    const session = memory.get(chatId) || {};
    const step    = session.step;

    if (!step) {
        let workspaceId = await getClientWorkspace(chatId);
        if (!workspaceId) workspaceId = await getWorkspaceByChatId(chatId);

        const produits = await getProduitsDuWorkspace(workspaceId);

        if (produits.length === 0) {
            memory.set(chatId, { step: "produit", name });
            await reply(chatId,
                `🛍️ *Parfait !*\n\nQuel produit souhaitez-vous commander ?\n_(Nom, taille, couleur...)_`
            );
            return true;
        }

        const listeProduits = produits
            .map((p, i) => `${i + 1}. *${p.nom}* — ${p.prix} DZD`)
            .join("\n");

        memory.set(chatId, { step: "produit_choix", name, produitsDisponibles: produits });
        await reply(chatId,
            `🛍️ *Voici nos produits disponibles :*\n\n${listeProduits}\n\n` +
            `Tapez le *numéro* du produit qui vous intéresse.`
        );
        return true;
    }

    if (step === "produit_choix") {
        const index = parseInt(text.trim(), 10) - 1;
        const produits = session.produitsDisponibles || [];
        const choisi = produits[index];

        if (!choisi) {
            await reply(chatId, `❌ Numéro invalide. Réessaie avec un numéro de la liste.`);
            return true;
        }

        memory.set(chatId, { step: "telephone", produit: `${choisi.nom} (${choisi.prix} DZD)`, name: session.name });
        await reply(chatId, `📞 Votre *numéro de téléphone* s'il vous plaît ?`);
        return true;
    }

    if (step === "produit") {
        memory.set(chatId, { step: "telephone", produit: text, name: session.name });
        await reply(chatId, `📞 Votre *numéro de téléphone* s'il vous plaît ?`);
        return true;
    }

    if (step === "telephone") {
        memory.set(chatId, { ...session, step: "adresse", telephone: text });
        await reply(chatId, `📍 Votre *adresse de livraison* ?`);
        return true;
    }

    if (step === "adresse") {
        const orderId = genOrderId();
        const s = memory.get(chatId);

        let workspaceId = await getClientWorkspace(chatId);
        if (!workspaceId) workspaceId = await getWorkspaceByChatId(chatId);

        const adminChatId = await getAdminChatId(workspaceId);

        console.log(`🛒 Création commande Telegram — orderId=${orderId}, workspaceId="${workspaceId}", chatId=${chatId}`);

        try {
            await db.query(
                `INSERT INTO commandes (id, workspace_id, nom_client, telephone, adresse, produit, statut, source, montant)
                 VALUES ($1, $2, $3, $4, $5, $6, 'en attente', 'telegram', 0)`,
                [orderId, workspaceId, s.name || "Inconnu", s.telephone || "", text, s.produit || ""]
            );
            console.log(`✅ Commande ${orderId} créée avec succès sur workspace "${workspaceId}"`);
        } catch (createErr) {
            console.error(`❌ Échec création commande ${orderId} :`, createErr.message);
        }

        await db.query(
            `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
            ["order.created.telegram", `#${orderId} — ${s.name}`, workspaceId]
        );

        if (adminChatId) {
            await axios.post(`${BASE}/sendMessage`, {
                chat_id     : adminChatId,
                parse_mode  : "Markdown",
                text        :
                    `🛎️ *Nouvelle commande !*\n\n` +
                    `🆔 *Numéro :* \`${orderId}\`\n` +
                    `👤 *Client :* ${s.name}\n` +
                    `📞 *Tél :* ${s.telephone}\n` +
                    `📦 *Produit :* ${s.produit}\n` +
                    `📍 *Adresse :* ${text}`,
                reply_markup: {
                    inline_keyboard: [[
                        { text: "✅ Confirmer", callback_data: `confirm_${orderId}` },
                        { text: "❌ Annuler",   callback_data: `cancel_${orderId}`  },
                    ]],
                },
            });
        }

        await axios.post(`${BASE}/sendMessage`, {
            chat_id     : chatId,
            parse_mode  : "Markdown",
            text        :
                `📋 *Récapitulatif de votre commande*\n\n` +
                `📦 *Produit :* ${s.produit}\n` +
                `📍 *Adresse :* ${text}\n` +
                `📞 *Tél :* ${s.telephone}\n\n` +
                `Confirmez-vous cette commande ?`,
            reply_markup: {
                inline_keyboard: [[
                    { text: "✅ Confirmer", callback_data: `confirm_${orderId}` },
                    { text: "❌ Annuler",   callback_data: `cancel_${orderId}`  },
                ]],
            },
        });

        memory.clear(chatId);

        await reply(chatId,
            `✅ *Commande enregistrée !*\n\n` +
            `🆔 *Numéro :* \`${orderId}\`\n\n` +
            `_Merci de confirmer ci-dessus._ 🙏`
        );

        return true;
    }

    return false;
}

function isOrderIntent(text) {
    const t = text.toLowerCase();
    return t.match(/command|acheter|achat|veux commander|je veux|passer commande|order|طلب|نطلب|نشري/);
}

function isCancelIntent(text) {
    const t = text.toLowerCase();
    return t.match(/annul|cancel|stop|arrêt|لا|waqef/);
}

router.post("/", async (req, res) => {
    res.sendStatus(200);
    try {
        const body = req.body;

        if (body.callback_query) {
            const cb     = body.callback_query;
            const chatId = cb.message.chat.id;
            const data   = cb.data || "";

            await axios.post(`${BASE}/answerCallbackQuery`, {
                callback_query_id: cb.id,
                text             : "⚙️ SAMII traite...",
            });

            if (data.startsWith("confirm_")) {
                const orderId = data.replace("confirm_", "");
                await db.query(`UPDATE commandes SET statut = 'confirmée' WHERE id = $1`, [orderId]);
                await orchestrator.process({
                    type: "order.confirmed", shop: "", payload: { orderId, chatId },
                });
                await reply(chatId,
                    `✅ *Commande #${orderId} confirmée !*\n\nNous préparons le colis 📦\nMerci de votre confiance 🙏`
                );
                return;
            }

            if (data.startsWith("cancel_")) {
                const orderId = data.replace("cancel_", "");
                await db.query(`UPDATE commandes SET statut = 'annulée' WHERE id = $1`, [orderId]);
                await orchestrator.process({
                    type: "order.cancelled.telegram", shop: "", payload: { orderId, chatId },
                });
                await reply(chatId,
                    `❌ *Commande #${orderId} annulée.*\n\nSi c'est une erreur, répondez-nous 😊`
                );
                return;
            }

            await orchestrator.process({
                type: "telegram.callback", shop: "", payload: { chatId, data, cb },
            });
            return;
        }

        const message = body.message;
        if (!message) return;

        const chatId = message.chat.id;
        const text   = (message.text || "").trim();
        const name   = message.from?.first_name || "Client";

        console.log(`📨 Telegram [${name}] : ${text}`);

        if (text.startsWith("/start")) {
            memory.clear(chatId);
            const param = text.split(" ")[1] || null;

            if (param && param.startsWith("admin_")) {
                const workspaceId = param.replace("admin_", "");
                const ok = await linkMerchantToWorkspace(chatId, workspaceId);
                await reply(chatId, ok
                    ? `✅ *Telegram connecté à ton QG !*\n\nTu recevras désormais toutes tes commandes ici directement. 👑`
                    : `❌ Erreur de connexion. Réessaie depuis ton QG.`
                );
                return;
            }

            if (param) {
                await linkClientToWorkspace(chatId, param);
                await reply(chatId,
                    `👑 *Bienvenue !*\n\nJe suis SAMII, votre assistant commercial. Comment puis-je vous aider aujourd'hui ?`
                );
                return;
            }

            await reply(chatId,
                `👑 *Bienvenue sur SAMII OS !*\n\n` +
                `✅ Chat ID : \`${chatId}\`\n\n` +
                `Je suis SAMII, votre assistant commercial. Comment puis-je vous aider ?`
            );
            return;
        }

        if (text === "/id") {
            await reply(chatId, `🆔 Chat ID : \`${chatId}\``);
            return;
        }

        if (isCancelIntent(text) && memory.getStep(chatId)) {
            memory.clear(chatId);
            await reply(chatId, `❌ Commande annulée. Comment puis-je vous aider ?`);
            return;
        }

        if (memory.getStep(chatId)) {
            await handleOrderFlow(chatId, text, name);
            return;
        }

        if (isOrderIntent(text)) {
            await handleOrderFlow(chatId, text, name);
            return;
        }

        await orchestrator.process({
            type: "telegram.message", shop: "", payload: { chatId, text, message },
        });

        const geminiReply = await planner.ask(text, { source: "telegram", chatId, name });
        await reply(chatId, geminiReply);

    } catch (err) {
        console.error("❌ Telegram webhook :", err.message);
    }
});

module.exports = router;
