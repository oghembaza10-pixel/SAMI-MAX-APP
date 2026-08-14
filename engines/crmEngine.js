/**
 * ============================================================
 * OG • CRM Engine V3 — Postgres réel
 * Construit les fiches clients + fils de conversation à partir de
 * l'activité multi-canal (Telegram, WhatsApp, Instagram, Messenger,
 * Google, TikTok, Snapchat), écoutée via l'orchestrateur.
 *
 * V2 écrivait tout dans des tables Airtable ("CLIENTS", "CONVERSATIONS",
 * "COMMANDES", "LOGS") qui ne sont plus la source réelle depuis longtemps —
 * chaque écriture échouait silencieusement dès qu'Airtable n'était pas
 * configuré, donc aucune fiche client ni conversation ne s'est jamais
 * vraiment construite. Les logs applicatifs (LOGS) sont retirés : les
 * routes webhook (whatsapp/telegram/auth-meta) écrivent déjà directement
 * dans la table Postgres "journal" au moment du message — les dupliquer
 * ici n'apportait rien.
 * ============================================================
 */

const db = require("../services/db");
const telegram = require("../services/telegramService");
const confirmationsQuota = require("../services/confirmationsQuota");

class CRMEngine {

    // ── HELPER : Trouve ou crée un client (Postgres) ──────────
    // workspace_id est une clé étrangère vers workspaces(id) — sans
    // workspaceId résolu (ex : Telegram avant liaison marchand/client), on
    // n'écrit rien plutôt que de spammer les logs d'erreurs FK à chaque message.
    async findOrCreateClient({ name, phone, workspaceId }) {
        if (!workspaceId) return null;
        try {
            const existing = phone
                ? await db.query(`SELECT id FROM clients WHERE telephone = $1 AND workspace_id = $2 LIMIT 1`, [phone, workspaceId || ""])
                : await db.query(`SELECT id FROM clients WHERE nom = $1 AND workspace_id = $2 LIMIT 1`, [name || "Inconnu", workspaceId || ""]);

            if (existing[0]) return existing[0];

            const created = await db.query(
                `INSERT INTO clients (workspace_id, nom, telephone, statut) VALUES ($1, $2, $3, 'actif') RETURNING id`,
                [workspaceId || "", name || "Inconnu", phone || ""]
            );
            console.log(`✅ Nouveau client : ${name || "Inconnu"}`);
            return created[0];
        } catch (err) {
            console.error("❌ CRM.findOrCreateClient :", err.message);
            return null;
        }
    }

    // ── HELPER : Enregistre/actualise le fil de conversation (Postgres) ──
    async saveConversation({ client, phone, message, canal, workspaceId }) {
        if (!workspaceId) return;
        try {
            const existing = phone
                ? await db.query(`SELECT id FROM conversations WHERE client_telephone = $1 AND canal = $2 AND workspace_id = $3 LIMIT 1`, [phone, canal, workspaceId || ""])
                : await db.query(`SELECT id FROM conversations WHERE client_nom = $1 AND canal = $2 AND workspace_id = $3 LIMIT 1`, [client || "Inconnu", canal, workspaceId || ""]);

            if (existing[0]) {
                await db.query(
                    `UPDATE conversations SET dernier_message = $1, updated_at = now() WHERE id = $2`,
                    [message || "", existing[0].id]
                );
                return;
            }

            await db.query(
                `INSERT INTO conversations (workspace_id, client_nom, client_telephone, canal, dernier_message, statut, updated_at, created_at)
                 VALUES ($1, $2, $3, $4, $5, 'ouverte', now(), now())`,
                [workspaceId || "", client || "Inconnu", phone || "", canal, message || ""]
            );
        } catch (err) {
            console.error("❌ CRM.saveConversation :", err.message);
        }
    }

    // =========================================================
    // TELEGRAM — MESSAGE
    // =========================================================
    async telegram(event) {
        try {
            const { text, message } = event.payload;
            const shop = event.shop || "";
            const name = message?.from?.first_name || "Inconnu";

            console.log(`✈️ Telegram [${name}] : ${text}`);

            await this.findOrCreateClient({ name, workspaceId: shop });
            await this.saveConversation({ client: name, message: text, canal: "telegram", workspaceId: shop });

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.telegram :", err.message);
        }
    }

    // =========================================================
    // TELEGRAM — CALLBACK (bouton cliqué)
    // =========================================================
    // NOTE : les callback_data "confirm_"/"cancel_" sont déjà interceptés et
    // traités directement dans routes/telegram.js (Postgres) avant d'arriver
    // ici — ces deux branches ne restent que par sécurité si jamais elles
    // étaient un jour émises ailleurs. "ship_"/"details_" restent la
    // responsabilité de ce handler.
    async telegramCallback(event) {
        try {
            const { chatId, data } = event.payload;
            const shop = event.shop || "";

            console.log(`🔘 Telegram callback : ${data}`);
            const [action, orderId] = data.split("_");

            if (action === "confirm") {
                await db.query(`UPDATE commandes SET statut = 'confirmée', confirme_le = now() WHERE id = $1`, [orderId]);
                if (shop) confirmationsQuota.enregistrerSiDepassement(shop).catch(() => {});
                await telegram.send(chatId, `✅ *Commande #${orderId} confirmée !*\nSAMII a mis à jour le statut.`);
            }

            else if (action === "cancel") {
                await db.query(`UPDATE commandes SET statut = 'annulée' WHERE id = $1`, [orderId]);
                await telegram.send(chatId, `❌ *Commande #${orderId} annulée.*`);
            }

            else if (action === "ship") {
                await db.query(`UPDATE commandes SET statut = 'expédiée' WHERE id = $1`, [orderId]);
                await telegram.send(chatId, `🚚 *Commande #${orderId} expédiée !*\nSAMII a notifié le client.`);
            }

            else if (action === "details") {
                const rows = await db.query(
                    `SELECT nom_client, montant, adresse, telephone, statut FROM commandes WHERE id = $1`,
                    [orderId]
                );
                const c = rows[0];
                if (c) {
                    await telegram.send(chatId,
                        `📋 *Détails commande #${orderId}*\n\n` +
                        `👤 Client : ${c.nom_client || "-"}\n` +
                        `💰 Total : ${c.montant || "-"}\n` +
                        `📍 Adresse : ${c.adresse || "-"}\n` +
                        `📞 Téléphone : ${c.telephone || "-"}\n` +
                        `📦 Statut : ${c.statut || "-"}`
                    );
                }
            }

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.telegramCallback :", err.message);
        }
    }

    // =========================================================
    // WHATSAPP — MESSAGE
    // =========================================================
    async whatsapp(event) {
        try {
            const { senderName, sender, message } = event.payload;
            const shop = event.shop || "";

            console.log(`💬 WhatsApp [${senderName}] : ${message}`);

            await this.findOrCreateClient({ name: senderName, phone: sender, workspaceId: shop });
            await this.saveConversation({ client: senderName, phone: sender, message, canal: "whatsapp", workspaceId: shop });

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.whatsapp :", err.message);
        }
    }

    // =========================================================
    // WHATSAPP — CALLBACK
    // =========================================================
    async whatsappCallback(event) {
        console.log(`🔘 WhatsApp callback :`, event.payload);
        return { success: true };
    }

    // =========================================================
    // INSTAGRAM — MESSAGE
    // =========================================================
    async instagram(event) {
        try {
            const { sender, text } = event.payload;
            const shop = event.shop || "";
            const name = sender?.name || "Inconnu";

            console.log(`📸 Instagram [${name}] : ${text}`);

            await this.findOrCreateClient({ name, workspaceId: shop });
            await this.saveConversation({ client: name, message: text, canal: "instagram", workspaceId: shop });

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.instagram :", err.message);
        }
    }

    // =========================================================
    // INSTAGRAM — CALLBACK
    // =========================================================
    async instagramCallback(event) {
        console.log(`🔘 Instagram callback :`, event.payload);
        return { success: true };
    }

    // =========================================================
    // MESSENGER — MESSAGE
    // =========================================================
    async messenger(event) {
        try {
            const { sender, text } = event.payload;
            const shop = event.shop || "";
            const name = sender?.name || "Inconnu";

            console.log(`📘 Messenger [${name}] : ${text}`);

            await this.findOrCreateClient({ name, workspaceId: shop });
            await this.saveConversation({ client: name, message: text, canal: "messenger", workspaceId: shop });

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.messenger :", err.message);
        }
    }

    // =========================================================
    // MESSENGER — CALLBACK
    // =========================================================
    async messengerCallback(event) {
        console.log(`🔘 Messenger callback :`, event.payload);
        return { success: true };
    }

    // =========================================================
    // META WEBHOOK (Instagram + Messenger combinés)
    // =========================================================
    async metaWebhook(event) {
        try {
            const body = event.payload;
            const shop = event.shop || "";

            for (const entry of body.entry || []) {
                for (const msg of entry.messaging || []) {
                    const name = msg.sender?.name || msg.sender?.id || "Inconnu";
                    const text = msg.message?.text || "";

                    if (!text) continue;

                    const canal = body.object === "instagram" ? "instagram" : "messenger";

                    await this.findOrCreateClient({ name, workspaceId: shop });
                    await this.saveConversation({ client: name, message: text, canal, workspaceId: shop });
                }
            }

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.metaWebhook :", err.message);
        }
    }

    // =========================================================
    // GOOGLE — LEAD
    // =========================================================
    async googleLead(event) {
        try {
            const { name, phone } = event.payload;
            const shop = event.shop || "";

            console.log(`🔍 Google Lead : ${name}`);

            await this.findOrCreateClient({ name, phone, workspaceId: shop });
            await this.saveConversation({ client: name, phone, message: "Lead Google", canal: "google", workspaceId: shop });

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.googleLead :", err.message);
        }
    }

    // =========================================================
    // GOOGLE — CONVERSION ADS
    // =========================================================
    async googleConversion(event) {
        const { orderId, value, currency } = event.payload;
        console.log(`📊 Google Conversion : #${orderId} — ${value} ${currency}`);
        return { success: true };
    }

    // =========================================================
    // TIKTOK — MESSAGE
    // =========================================================
    async tiktok(event) {
        try {
            const { name, text } = event.payload;
            const shop = event.shop || "";

            console.log(`🎵 TikTok [${name}] : ${text}`);

            await this.findOrCreateClient({ name, workspaceId: shop });
            await this.saveConversation({ client: name, message: text, canal: "tiktok", workspaceId: shop });

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.tiktok :", err.message);
        }
    }

    // =========================================================
    // SNAPCHAT — MESSAGE
    // =========================================================
    async snapchat(event) {
        try {
            const { name, text } = event.payload;
            const shop = event.shop || "";

            console.log(`👻 Snapchat [${name}] : ${text}`);

            await this.findOrCreateClient({ name, workspaceId: shop });
            await this.saveConversation({ client: name, message: text, canal: "snapchat", workspaceId: shop });

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.snapchat :", err.message);
        }
    }
}

module.exports = new CRMEngine();
