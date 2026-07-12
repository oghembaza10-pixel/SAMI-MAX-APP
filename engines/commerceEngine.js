/**
 * ============================================================
 * OG • Commerce Engine v2
 * ============================================================
 */

const airtable           = require("../services/airtable");
const notificationEngine = require("../engines/notificationEngine");
const automationEngine   = require("../engines/automationEngine");

class CommerceEngine {

    // ── HELPER : Boutique ────────────────────────────
    async getBoutique(shop) {
        const records = await airtable.findRecords("TABLE_BOUTIQUES", `{shop_url} = "${shop}"`);
        return records.length ? records[0] : null;
    }

    // ── HELPER : Données client ──────────────────────
    getClientData(order) {
        return {
            client : `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim(),
            phone  : order.shipping_address?.phone || order.customer?.phone || "",
            address: order.shipping_address
                ? `${order.shipping_address.address1}, ${order.shipping_address.city}`
                : "",
        };
    }

    // ── HELPER : Notifie la boutique ─────────────────
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
                telegram: chatId,
                whatsapp: recipients.whatsapp || "",
                email   : recipients.email    || "",
            },
            message,
            shop,
        });
    }

    // ── NOUVELLE COMMANDE ────────────────────────────
    async newOrder(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client, phone, address } = this.getClientData(order);

            console.log(`🛒 Nouvelle commande : ${shop}`);

            // 1. Airtable → COMMANDES
            await airtable.createRecord("Commandes", {
                "ID Commande"  : String(order.id || ""),
                "Lien Boutique": shop    || "",
                "Nom Client"   : client  || "",
                "Téléphone"    : phone   || "",
                "Ville"        : order.shipping_address?.city || "",
                "Statut"       : order.financial_status || "pending",
            });

            // 2. Log
            await airtable.log("order.created", `Commande #${order.order_number} — ${client}`, shop);

            // 3. Automation
            await automationEngine.run("order.created", { order, shop, client, phone, address });

            // 4. Notification
            const message =
                `🛒 *Nouvelle commande !*\n` +
                `👤 Client : ${client}\n` +
                `📞 Tél : ${phone}\n` +
                `📍 Adresse : ${address}\n` +
                `💰 Total : ${order.total_price}\n` +
                `📦 Statut : ${order.financial_status}`;

            await this.notifyShop(shop, { whatsapp: phone }, message);

            return { success: true, event: event.type, shop, orderId: order.id };

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
            const { client, phone } = this.getClientData(order);

            await airtable.log("order.updated", `#${order.order_number} mise à jour`, shop);
            await automationEngine.run("order.updated", { order, shop, client, phone });

            const message =
                `🔄 *Commande mise à jour*\n` +
                `👤 ${client} | #${order.order_number}\n` +
                `📦 ${order.fulfillment_status || order.financial_status}`;

            await this.notifyShop(shop, { whatsapp: phone }, message);

            return { success: true, event: event.type, shop, orderId: order.id };

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
            const { client, phone } = this.getClientData(order);

            await airtable.log("order.cancelled", `#${order.order_number} annulée`, shop);
            await automationEngine.run("order.cancelled", { order, shop, client, phone });

            const message =
                `❌ *Commande annulée*\n` +
                `👤 ${client} | #${order.order_number}\n` +
                `💬 Raison : ${order.cancel_reason || "Non précisée"}`;

            await this.notifyShop(shop, { whatsapp: phone }, message);

            return { success: true, event: event.type, shop, orderId: order.id };

        } catch (err) {
            console.error("❌ CommerceEngine.orderCancelled :", err.message);
            return { success: false, error: err.message };
        }
    }

    // ── COMMANDE EXPÉDIÉE ────────────────────────────
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

            return { success: true, event: event.type, shop, orderId: order.id };

        } catch (err) {
            console.error("❌ CommerceEngine.orderFulfilled :", err.message);
            return { success: false, error: err.message };
        }
    }

    // ── STOCK FAIBLE ─────────────────────────────────
    async lowStock(event) {
        try {
            const { product, variant, shop } = event.payload;

            await airtable.log("stock.low", `Stock faible — ${product}`, shop);
            await automationEngine.run("stock.low", { product, variant, shop });

            const message = `⚠️ *Stock faible*\n📦 ${product} : ${variant} restants`;
            await this.notifyShop(shop, {}, message);

            return { success: true, event: event.type, shop };

        } catch (err) {
            console.error("❌ CommerceEngine.lowStock :", err.message);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new CommerceEngine();

