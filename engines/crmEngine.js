/**
 * ============================================================
 * OG • CRM Engine V2 — VERSION DÉFINITIVE
 * Gère toutes les conversations, callbacks et canaux
 * ============================================================
 */

const airtable = require("../services/airtable");
const telegram = require("../services/telegramService");

class CRMEngine {

  // ── HELPER : Trouve ou crée un client ────────────────────
async findOrCreateClient(data) {
    const { name, phone, email, source } = data;
    const formula = phone
        ? `{Téléphone} = "${phone}"`
        : email
            ? `{Email} = "${email}"`
            : `{Nom Client} = "${name}"`;

    let client = await airtable.findOne("CLIENTS", formula);
    if (!client) {
        client = await airtable.create("CLIENTS", {
            "Nom Client": name   || "Inconnu",
            "Téléphone" : phone  || "",
            "Email"     : email  || "",
            "Source"    : source || "inconnu",
            "Statut"    : "actif",
        });
        console.log(`✅ Nouveau client : ${name}`);
    }
    return client;
}

// ── HELPER : Enregistre conversation ─────────────────────
async saveConversation(data) {
    const { client, message, source, shop, direction = "entrant" } = data;
    return await airtable.create("CONVERSATIONS", {
        "Client"   : client    || "Inconnu",
        "Message"  : message   || "",
        "Source"   : source    || "inconnu",
        "Direction": direction,
        "Boutique" : shop      || "",
        "Lu"       : false,
    });
}

// ── HELPER : Répondre sur Telegram ───────────────────────
async replyTelegram(chatId, text) {
    await telegram.send(chatId, text);
}


    // =========================================================
    // TELEGRAM — MESSAGE
    // =========================================================
    async telegram(event) {
        try {
            const { chatId, text, message } = event.payload;
            const shop = event.shop || "";
            const name = message?.from?.first_name || "Inconnu";

            console.log(`✈️ Telegram [${name}] : ${text}`);

            await this.findOrCreateClient({ name, source: "telegram" });
            await this.saveConversation({ client: name, message: text, source: "telegram", shop });
            await airtable.log("telegram.message", `${name}: ${text}`, shop);

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.telegram :", err.message);
        }
    }

    // =========================================================
    // TELEGRAM — CALLBACK (bouton cliqué)
    // =========================================================
    async telegramCallback(event) {
        try {
            const { chatId, data } = event.payload;
            const shop = event.shop || "";

            console.log(`🔘 Telegram callback : ${data}`);

            const [action, orderId] = data.split("_");

            // ── CONFIRMER ────────────────────────────────────
            if (action === "confirm") {
                await airtable.updateWhere("COMMANDES", `{ID Commande} = "${orderId}"`, {
                    "Statut": "confirmée"
                });
                await telegram.send(chatId,
                    `✅ *Commande #${orderId} confirmée !*\nSAMII a mis à jour le statut.`
                );
                await airtable.log("order.confirmed", `Commande #${orderId} confirmée`, shop);
            }

            // ── ANNULER ───────────────────────────────────────
            else if (action === "cancel") {
                await airtable.updateWhere("COMMANDES", `{ID Commande} = "${orderId}"`, {
                    "Statut": "annulée"
                });
                await telegram.send(chatId,
                    `❌ *Commande #${orderId} annulée.*`
                );
                await airtable.log("order.cancelled", `Commande #${orderId} annulée`, shop);
            }

            // ── EXPÉDIER ──────────────────────────────────────
            else if (action === "ship") {
                await airtable.updateWhere("COMMANDES", `{ID Commande} = "${orderId}"`, {
                    "Statut": "expédiée"
                });
                await telegram.send(chatId,
                    `🚚 *Commande #${orderId} expédiée !*\nSAMII a notifié le client.`
                );
                await airtable.log("order.shipped", `Commande #${orderId} expédiée`, shop);
            }

            // ── DÉTAILS ───────────────────────────────────────
            else if (action === "details") {
                const commande = await airtable.findOne("COMMANDES",
                    `{ID Commande} = "${orderId}"`
                );
                if (commande) {
                    const f = commande.fields;
                    await telegram.send(chatId,
                        `📋 *Détails commande #${orderId}*\n\n` +
                        `👤 Client : ${f["Client"] || "-"}\n` +
                        `💰 Total : ${f["Total"] || "-"}\n` +
                        `📍 Adresse : ${f["Adresse"] || "-"}\n` +
                        `📞 Téléphone : ${f["Téléphone"] || "-"}\n` +
                        `📦 Statut : ${f["Statut"] || "-"}`
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

            await this.findOrCreateClient({ name: senderName, phone: sender, source: "whatsapp" });
            await this.saveConversation({ client: senderName, message, source: "whatsapp", shop });
            await airtable.log("whatsapp.message", `${senderName}: ${message}`, shop);

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.whatsapp :", err.message);
        }
    }

    // =========================================================
    // WHATSAPP — CALLBACK
    // =========================================================
    async whatsappCallback(event) {
        try {
            console.log(`🔘 WhatsApp callback :`, event.payload);
            await airtable.log("whatsapp.callback", JSON.stringify(event.payload), event.shop);
            return { success: true };
        } catch (err) {
            console.error("❌ CRM.whatsappCallback :", err.message);
        }
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

            await this.findOrCreateClient({ name, source: "instagram" });
            await this.saveConversation({ client: name, message: text, source: "instagram", shop });
            await airtable.log("instagram.message", `${name}: ${text}`, shop);

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.instagram :", err.message);
        }
    }

    // =========================================================
    // INSTAGRAM — CALLBACK
    // =========================================================
    async instagramCallback(event) {
        try {
            console.log(`🔘 Instagram callback :`, event.payload);
            await airtable.log("instagram.callback", JSON.stringify(event.payload), event.shop);
            return { success: true };
        } catch (err) {
            console.error("❌ CRM.instagramCallback :", err.message);
        }
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

            await this.findOrCreateClient({ name, source: "messenger" });
            await this.saveConversation({ client: name, message: text, source: "messenger", shop });
            await airtable.log("messenger.message", `${name}: ${text}`, shop);

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.messenger :", err.message);
        }
    }

    // =========================================================
    // MESSENGER — CALLBACK
    // =========================================================
    async messengerCallback(event) {
        try {
            console.log(`🔘 Messenger callback :`, event.payload);
            await airtable.log("messenger.callback", JSON.stringify(event.payload), event.shop);
            return { success: true };
        } catch (err) {
            console.error("❌ CRM.messengerCallback :", err.message);
        }
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

                    const source = body.object === "instagram" ? "instagram" : "messenger";

                    await this.findOrCreateClient({ name, source });
                    await this.saveConversation({ client: name, message: text, source, shop });
                    await airtable.log(`${source}.message`, `${name}: ${text}`, shop);
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
            const { name, email, phone, source } = event.payload;
            const shop = event.shop || "";

            console.log(`🔍 Google Lead : ${name}`);

            await this.findOrCreateClient({ name, email, phone, source: source || "google" });
            await this.saveConversation({ client: name, message: "Lead Google", source: "google", shop });
            await airtable.log("google.lead", `${name} — ${email}`, shop);

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.googleLead :", err.message);
        }
    }

    // =========================================================
    // GOOGLE — CONVERSION ADS
    // =========================================================
    async googleConversion(event) {
        try {
            const { orderId, value, currency } = event.payload;
            const shop = event.shop || "";

            console.log(`📊 Google Conversion : #${orderId} — ${value} ${currency}`);
            await airtable.log("google.conversion", `#${orderId} — ${value} ${currency}`, shop);

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.googleConversion :", err.message);
        }
    }

    // =========================================================
    // TIKTOK — MESSAGE
    // =========================================================
    async tiktok(event) {
        try {
            const { name, text } = event.payload;
            const shop = event.shop || "";

            console.log(`🎵 TikTok [${name}] : ${text}`);

            await this.findOrCreateClient({ name, source: "tiktok" });
            await this.saveConversation({ client: name, message: text, source: "tiktok", shop });
            await airtable.log("tiktok.message", `${name}: ${text}`, shop);

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

            await this.findOrCreateClient({ name, source: "snapchat" });
            await this.saveConversation({ client: name, message: text, source: "snapchat", shop });
            await airtable.log("snapchat.message", `${name}: ${text}`, shop);

            return { success: true };
        } catch (err) {
            console.error("❌ CRM.snapchat :", err.message);
        }
    }
}

module.exports = new CRMEngine();
