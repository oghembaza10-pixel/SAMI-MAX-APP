/**
 * ============================================================
 * OG • Commerce Engine
 * Cerveau Commerce de SAMII
 * ============================================================
 */

const airtable       = require("../services/airtable");
const telegramService = require("../services/telegramService");

class CommerceEngine {

    // ── HELPER : Récupère la boutique ────────────────
    async getBoutique(shop) {
        return await airtable.findOne("BOUTIQUES", `{shop_url} = "${shop}"`);
    }

    // ── HELPER : Données client depuis commande ──────
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

            // 1. Airtable → COMMANDES
            await airtable.create("COMMANDES", {
                "ID Commande" : String(order.id || ""),
                "Client"      : client,
                "Adresse"     : address,
                "Téléphone"   : phone,
                "Total"       : Number(order.total_price || 0),
                "Statut"      : order.financial_status || "pending",
                "Date"        : order.created_at || new Date().toISOString(),
            });
            console.log("✅ Commande enregistrée dans Airtable");

            // 2. Airtable → JOURNAL
            await airtable.journal("order.created", {
                orderId: order.id,
                client,
                total: order.total_price,
            }, shop);

            // 3. Airtable → LOGS
            await airtable.log("order.created", `Commande #${order.order_number} - ${client}`, shop);

            // 4. Airtable → NOTIFICATIONS
            await airtable.notification("commande", `🛒 Nouvelle commande de ${client} — ${order.total_price} DZD`, shop);

            // 5. Telegram
            const boutique = await this.getBoutique(shop);
            if (boutique?.fields?.telegram_chat_id && boutique?.fields?.telegram_actif) {
                await telegramService.notifyNewOrder(boutique.fields.telegram_chat_id, order);
                console.log("✅ Telegram notifié");
            }

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

            await airtable.journal("order.updated", { orderId: order.id, statut: order.financial_status }, shop);
            await airtable.log("order.updated", `Commande #${order.order_number} mise à jour`, shop);

            const boutique = await this.getBoutique(shop);
            if (boutique?.fields?.telegram_chat_id && boutique?.fields?.telegram_actif) {
                await telegramService.send(boutique.fields.telegram_chat_id,
                    `🔄 Commande mise à jour\n👤 ${client} | #${order.order_number}\n📦 ${order.fulfillment_status || order.financial_status}`
                );
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
            await airtable.log("order.cancelled", `Commande #${order.order_number} annulée`, shop);
            await airtable.notification("annulation", `❌ Commande annulée — ${client}`, shop);

            const boutique = await this.getBoutique(shop);
            if (boutique?.fields?.telegram_chat_id && boutique?.fields?.telegram_actif) {
                await telegramService.notifyOrderCancelled(boutique.fields.telegram_chat_id, order);
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
            const order = event.payload;
            const shop  = event.shop;
            const { client } = this.getClientData(order);

            await airtable.journal("order.fulfilled", { orderId: order.id }, shop);
            await airtable.log("order.fulfilled", `Commande #${order.order_number} expédiée`, shop);
            await airtable.notification("livraison", `🚚 Commande expédiée — ${client}`, shop);

            const boutique = await this.getBoutique(shop);
            if (boutique?.fields?.telegram_chat_id && boutique?.fields?.telegram_actif) {
                await telegramService.notifyOrderFulfilled(boutique.fields.telegram_chat_id, order);
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
            await airtable.notification("stock", `⚠️ Stock faible — ${product} : ${variant} restants`, shop);

            return { success: true };
        } catch (err) {
            console.error("❌ CommerceEngine.lowStock :", err.message);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new CommerceEngine();

