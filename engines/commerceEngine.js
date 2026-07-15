/**
 * ============================================================
 * OG • Commerce Engine V2 — VERSION DÉFINITIVE
 * Gère commandes, stock, Yalidine
 * ============================================================
 */

const airtable           = require("../services/airtable");
const notificationEngine = require("../engines/notificationEngine");
const automationEngine   = require("../engines/automationEngine");
const telegram = require("../services/telegramService");

class CommerceEngine {

    // ── HELPER : Boutique ────────────────────────────────────
    async getBoutique(shop) {
        return await airtable.findOne("BOUTIQUES", `{shop_url} = "${shop}"`);
    }

    // ── HELPER : Données client ──────────────────────────────
    getClientData(order) {
        return {
            client : `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim() || "Inconnu",
            phone  : order.shipping_address?.phone || order.customer?.phone || "",
            address: order.shipping_address
                ? `${order.shipping_address.address1}, ${order.shipping_address.city}`
                : "",
        };
    }

    // ── HELPER : Notifie la boutique (texte simple) ──────────
    async notifyShop(shop, recipients, message) {
        const boutique = await this.getBoutique(shop);
        const chatId   = boutique?.fields?.telegram_chat_id;
        const actif    = boutique?.fields?.telegram_actif;

        const channels = [];
        if (actif && chatId) channels.push("telegram");
        if (recipients.whatsapp) channels.push("whatsapp");
        if (!channels.length) return;

        return notificationEngine.broadcast({
            channels,
            recipients: {
                telegram : chatId,
                whatsapp : recipients.whatsapp || "",
                email    : recipients.email    || "",
            },
            message,
            shop,
        });
    }

    // ── HELPER : Notifie avec boutons Telegram ───────────────
    async notifyShopButtons(shop, message, buttons) {
        const boutique = await this.getBoutique(shop);
        const chatId   = boutique?.fields?.telegram_chat_id;
        const actif    = boutique?.fields?.telegram_actif;

        if (!actif || !chatId) return;
        return telegram.sendButtons(chatId, message, buttons);
    }

    // =========================================================
    // NOUVELLE COMMANDE
    // =========================================================
    async newOrder(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client, phone, address } = this.getClientData(order);

            console.log(`🛒 Nouvelle commande #${order.order_number} — ${shop}`);

            // 1. Airtable → COMMANDES
            await airtable.create("COMMANDES", {
                "ID Commande"   : String(order.order_number || order.id),
                "Client"        : client,
                "Téléphone"     : phone,
                "Adresse"       : address,
                "Produits"      : order.line_items?.map(i => i.title).join(", ") || "",
                "Total"         : order.total_price || "0",
                "Statut"        : "en attente",
                "Boutique"      : shop,
                "Date"          : order.created_at || new Date().toISOString(),
            });

            // 2. Log
            await airtable.log("order.created", `#${order.order_number} — ${client}`, shop);

            // 3. Automation
            await automationEngine.run("order.created", { order, shop, client, phone, address });

            // 4. Notification Telegram AVEC BOUTONS
            const message =
                `🛒 *NOUVELLE COMMANDE #${order.order_number}*\n\n` +
                `👤 *Client :* ${client}\n` +
                `📞 *Tél :* ${phone}\n` +
                `📍 *Adresse :* ${address}\n` +
                `📦 *Produits :* ${order.line_items?.map(i => i.title).join(", ") || ""}\n` +
                `💰 *Total :* ${order.total_price} DZD\n` +
                `📊 *Statut :* ${order.financial_status}`;

            const buttons = [[
                { text: "✅ Confirmer", callback_data: `confirm_${order.order_number}` },
                { text: "❌ Annuler",   callback_data: `cancel_${order.order_number}`  },
            ],[
                { text: "🚚 Expédier",  callback_data: `ship_${order.order_number}`    },
                { text: "📋 Détails",   callback_data: `details_${order.order_number}` },
            ]];

            await this.notifyShopButtons(shop, message, buttons);

            return { success: true, shop, orderId: order.id };

        } catch (err) {
            console.error("❌ CommerceEngine.newOrder :", err.message);
            await airtable.log("error.order.created", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // COMMANDE MISE À JOUR
    // =========================================================
    async orderUpdated(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client, phone } = this.getClientData(order);

            await airtable.log("order.updated", `#${order.order_number} mise à jour`, shop);
            await automationEngine.run("order.updated", { order, shop, client, phone });

            const message =
                `🔄 *Commande mise à jour*\n` +
                `👤 ${client} | #${order.order_number}\n` +
                `📦 ${order.fulfillment_status || order.financial_status}`;

            await this.notifyShop(shop, { whatsapp: phone }, message);

            return { success: true, shop, orderId: order.id };

        } catch (err) {
            console.error("❌ CommerceEngine.orderUpdated :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // COMMANDE PAYÉE
    // =========================================================
    async orderPaid(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client, phone } = this.getClientData(order);

            await airtable.log("order.paid", `#${order.order_number} payée`, shop);
            await automationEngine.run("order.paid", { order, shop, client, phone });

            const message =
                `💳 *Paiement reçu !*\n` +
                `👤 ${client} | #${order.order_number}\n` +
                `💰 ${order.total_price} DZD`;

            await this.notifyShop(shop, { whatsapp: phone }, message);

            return { success: true, shop, orderId: order.id };

        } catch (err) {
            console.error("❌ CommerceEngine.orderPaid :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // COMMANDE EXPÉDIÉE
    // =========================================================
    async orderFulfilled(event) {
        try {
            const order    = event.payload;
            const shop     = event.shop;
            const { client, phone } = this.getClientData(order);
            const tracking = order.fulfillments?.[0]?.tracking_number  || "N/A";
            const carrier  = order.fulfillments?.[0]?.tracking_company || "N/A";

            await airtable.log("order.fulfilled", `#${order.order_number} expédiée`, shop);
            await automationEngine.run("order.fulfilled", { order, shop, client, phone, tracking, carrier });

            const message =
                `🚚 *Commande expédiée !*\n` +
                `👤 ${client} | #${order.order_number}\n` +
                `📦 Transporteur : ${carrier}\n` +
                `🔍 Tracking : ${tracking}`;

            await this.notifyShop(shop, { whatsapp: phone }, message);

            return { success: true, shop, orderId: order.id };

        } catch (err) {
            console.error("❌ CommerceEngine.orderFulfilled :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // COMMANDE LIVRÉE
    // =========================================================
    async orderDelivered(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client, phone } = this.getClientData(order);

            await airtable.log("order.delivered", `#${order.order_number} livrée`, shop);

            const message =
                `✅ *Commande livrée !*\n` +
                `👤 ${client} | #${order.order_number}\n` +
                `🎉 Livraison confirmée.`;

            await this.notifyShop(shop, { whatsapp: phone }, message);

            return { success: true, shop, orderId: order.id };

        } catch (err) {
            console.error("❌ CommerceEngine.orderDelivered :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // COMMANDE ANNULÉE
    // =========================================================
    async orderCancelled(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client, phone } = this.getClientData(order);

            await airtable.log("order.cancelled", `#${order.order_number} annulée`, shop);
            await automationEngine.run("order.cancelled", { order, shop, client, phone });

            const message =
                `❌ *Commande annulée*\n` +
                `👤 ${client} | #${order.order_number}\n` +
                `💬 Raison : ${order.cancel_reason || "Non précisée"}`;

            await this.notifyShop(shop, { whatsapp: phone }, message);

            return { success: true, shop, orderId: order.id };

        } catch (err) {
            console.error("❌ CommerceEngine.orderCancelled :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // STOCK FAIBLE
    // =========================================================
    async lowStock(event) {
        try {
            const { product, variant, shop } = event.payload;

            await airtable.log("stock.low", `Stock faible — ${product} : ${variant}`, shop);
            await automationEngine.run("stock.low", { product, variant, shop });

            const message =
                `⚠️ *Stock faible !*\n` +
                `📦 ${product}\n` +
                `🔢 Quantité restante : ${variant}`;

            await this.notifyShop(shop, {}, message);

            return { success: true, shop };

        } catch (err) {
            console.error("❌ CommerceEngine.lowStock :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // STOCK ÉPUISÉ
    // =========================================================
    async stockEmpty(event) {
        try {
            const { product, shop } = event.payload;

            await airtable.log("stock.empty", `Stock épuisé — ${product}`, shop);

            const message =
                `🚨 *Stock ÉPUISÉ !*\n` +
                `📦 ${product}\n` +
                `⚡ Action requise immédiatement.`;

            await this.notifyShop(shop, {}, message);

            return { success: true, shop };

        } catch (err) {
            console.error("❌ CommerceEngine.stockEmpty :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // YALIDINE — STATUT MIS À JOUR
    // =========================================================
    async yalidineStatus(event) {
        try {
            const { orderId, status, tracking, shop } = event.payload;

            await airtable.updateWhere("COMMANDES", `{ID Commande} = "${orderId}"`, {
                "Statut": status
            });

            await airtable.log("yalidine.status", `#${orderId} → ${status}`, shop);

            const message =
                `📦 *Yalidine — Mise à jour*\n` +
                `🔢 Commande : #${orderId}\n` +
                `📊 Statut : ${status}\n` +
                `🔍 Tracking : ${tracking || "N/A"}`;

            await this.notifyShop(shop, {}, message);

            return { success: true, shop, orderId };

        } catch (err) {
            console.error("❌ CommerceEngine.yalidineStatus :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // YALIDINE — LIVRÉ
    // =========================================================
    async yalidineDelivered(event) {
        try {
            const { orderId, client, phone, shop } = event.payload;

            await airtable.updateWhere("COMMANDES", `{ID Commande} = "${orderId}"`, {
                "Statut": "livrée"
            });

            await airtable.log("yalidine.delivered", `#${orderId} livrée`, shop);

            const message =
                `✅ *Yalidine — Livraison confirmée !*\n` +
                `👤 ${client || "Client"} | #${orderId}\n` +
                `🎉 Colis livré avec succès.`;

            await this.notifyShop(shop, { whatsapp: phone }, message);

            return { success: true, shop, orderId };

        } catch (err) {
            console.error("❌ CommerceEngine.yalidineDelivered :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // YALIDINE — RETOURNÉ
    // =========================================================
    async yalidineReturned(event) {
        try {
            const { orderId, reason, shop } = event.payload;

            await airtable.updateWhere("COMMANDES", `{ID Commande} = "${orderId}"`, {
                "Statut": "retournée"
            });

            await airtable.log("yalidine.returned", `#${orderId} retournée`, shop);

            const message =
                `🔄 *Yalidine — Colis retourné*\n` +
                `🔢 Commande : #${orderId}\n` +
                `💬 Raison : ${reason || "Non précisée"}`;

            await this.notifyShop(shop, {}, message);

            return { success: true, shop, orderId };

        } catch (err) {
            console.error("❌ CommerceEngine.yalidineReturned :", err.message);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new CommerceEngine();

