/**
 * ============================================================
 * OG • Commerce Engine
 * ============================================================
 */

const airtable           = require("../services/airtable");
const notificationEngine = require("../engines/notificationEngine");

class CommerceEngine {

    async getBoutique(shop) {
        return await airtable.findOne("BOUTIQUES", `{shop_url} = "${shop}"`);
    }

    getClientData(order) {
        return {
            client : `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim(),
            phone  : order.shipping_address?.phone || order.customer?.phone || "",
            address: order.shipping_address
                ? `${order.shipping_address.address1}, ${order.shipping_address.city}`
                : "",
        };
    }

    // ── NOUVELLE COMMANDE ────────────────────────────
    async newOrder(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client, phone, address } = this.getClientData(order);

            console.log(`🛒 Nouvelle commande : ${shop}`);

            // 1. Airtable
            await airtable.create("COMMANDES", {
                "ID Commande" : String(order.id || ""),
                "Client"      : client,
                "Adresse"     : address,
                "Téléphone"   : phone,
                "Total"       : Number(order.total_price || 0),
                "Statut"      : order.financial_status || "pending",
                "Date"        : order.created_at || new Date().toISOString(),
            });

            // 2. Journal + Logs
            await airtable.journal("order.created", { orderId: order.id, client, total: order.total_price }, shop);
            await airtable.log("order.created", `Commande #${order.order_number} — ${client}`, shop);

            // 3. Notification — commerceEngine ne connaît plus Telegram
            const boutique = await this.getBoutique(shop);
            const chatId   = boutique?.fields?.telegram_chat_id;
            const actif    = boutique?.fields?.telegram_actif;

            const message =
                `🛒 *Nouvelle commande !*\n` +
                `👤 Client : ${client}\n` +
                `📞 Tél : ${phone}\n` +
                `📍 Adresse : ${address}\n` +
                `💰 Total : ${order.total_price}\n` +
                `📦 Statut : ${order.financial_status}`;

            await notificationEngine.broadcast({
                channels: actif && chatId
                    ? ["telegram", "whatsapp"]
                    : ["whatsapp"],
                to     : chatId,
                message,
                data   : order,
                shop,
            });

            return { success: true, shop, orderId: order.id };

        } catch (err) {
            console.error("❌ CommerceEngine.newOrder :", err.message);
            await airtable.log("error.order.created", err.message);
            return { success: false, error: err.message };
        }
    }

    // ── COMMANDE MISE À JOUR ─────────────────────────
    async orderUpdated(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client } = this.getClientData(order);

            await airtable.journal("order.updated", { orderId: order.id }, shop);
            await airtable.log("order.updated", `#${order.order_number} mise à jour`, shop);

            const message =
                `🔄 *Commande mise à jour*\n` +
                `👤 ${client} | #${order.order_number}\n` +
                `📦 ${order.fulfillment_status || order.financial_status}`;

            const boutique = await this.getBoutique(shop);
            if (boutique?.fields?.telegram_actif) {
                await notificationEngine.telegram(boutique.fields.telegram_chat_id, message, shop);
            }

            return { success: true };
        } catch (err) {
            console.error("❌ CommerceEngine.orderUpdated :", err.message);
            return { success: false, error: err.message };
        }
    }

    // ── COMMANDE ANNULÉE ─────────────────────────────
    async orderCancelled(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client } = this.getClientData(order);

            await airtable.journal("order.cancelled", { orderId: order.id }, shop);
            await airtable.log("order.cancelled", `#${order.order_number} annulée`, shop);
            await airtable.notification("annulation", `❌ Commande annulée — ${client}`, shop);

            const message =
                `❌ *Commande annulée*\n` +
                `👤 ${client} | #${order.order_number}\n` +
                `💬 Raison : ${order.cancel_reason || "Non précisée"}`;

            const boutique = await this.getBoutique(shop);
            if (boutique?.fields?.telegram_actif) {
                await notificationEngine.telegram(boutique.fields.telegram_chat_id, message, shop);
            }

            return { success: true };
        } catch (err) {
            console.error("❌ CommerceEngine.orderCancelled :", err.message);
            return { success: false, error: err.message };
        }
    }

    // ── COMMANDE EXPÉDIÉE ────────────────────────────
    async orderFulfilled(event) {
        try {
            const order   = event.payload;
            const shop    = event.shop;
            const { client } = this.getClientData(order);
            const tracking = order.fulfillments?.[0]?.tracking_number || "N/A";
            const carrier  = order.fulfillments?.[0]?.tracking_company || "N/A";

            await airtable.journal("order.fulfilled", { orderId: order.id }, shop);
            await airtable.log("order.fulfilled", `#${order.order_number} expédiée`, shop);
            await airtable.notification("livraison", `🚚 Expédiée — ${client}`, shop);

            const message =
                `🚚 *Commande expédiée !*\n` +
                `👤 ${client} | #${order.order_number}\n` +
                `📦 Transporteur : ${carrier}\n` +
                `🔍 Tracking : ${tracking}`;

            const boutique = await this.getBoutique(shop);
            if (boutique?.fields?.telegram_actif) {
                await notificationEngine.telegram(boutique.fields.telegram_chat_id, message, shop);
            }

            return { success: true };
        } catch (err) {
            console.error("❌ CommerceEngine.orderFulfilled :", err.message);
            return { success: false, error: err.message };
        }
    }

    // ── STOCK FAIBLE ─────────────────────────────────
    async lowStock(event) {
        try {
            const { product, variant, shop } = event.payload;

            await airtable.journal("stock.low", { product, variant }, shop);
            await airtable.log("stock.low", `Stock faible — ${product}`, shop);

            const message = `⚠️ *Stock faible*\n📦 ${product} : ${variant} restants`;

            const boutique = await this.getBoutique(shop);
            if (boutique?.fields?.telegram_actif) {
                await notificationEngine.telegram(boutique.fields.telegram_chat_id, message, shop);
            }

            return { success: true };
        } catch (err) {
            console.error("❌ CommerceEngine.lowStock :", err.message);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new CommerceEngine();

