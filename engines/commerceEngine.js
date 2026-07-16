/**
 * ============================================================
 * OG • Commerce Engine V2 — VERSION DÉFINITIVE
 * SAMII agit seul et rapporte
 * ============================================================
 */

const airtable           = require("../services/airtable");
const notificationEngine = require("../engines/notificationEngine");
const automationEngine   = require("../engines/automationEngine");

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

    // ── HELPER : Notifie la boutique ─────────────────────────
    async notifyShop(shop, recipients, message) {
        const boutique = await this.getBoutique(shop);
        const chatId   = boutique?.fields?.telegram_chat_id;
        const actif    = boutique?.fields?.telegram_actif;

        const isActif = actif === true || actif === "true" || actif === 1;
        const channels = [];
        if (isActif && chatId) channels.push("telegram");
        if (recipients?.whatsapp) channels.push("whatsapp");
        if (!channels.length) return;

        return notificationEngine.broadcast({
            channels,
            recipients: {
                telegram : chatId,
                whatsapp : recipients?.whatsapp || "",
                email    : recipients?.email    || "",
            },
            message,
            shop,
        });
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
                "ID Commande" : String(order.order_number || order.id),
                "Client"      : client,
                "Téléphone"   : phone,
                "Adresse"     : address,
                "Produits"    : order.line_items?.map(i => i.title).join(", ") || "",
                "Total"       : order.total_price || "0",
                "Statut"      : "en attente",
                "Boutique"    : shop,
                "Date"        : order.created_at || new Date().toISOString(),
            });

            // 2. Log
            await airtable.log("order.created", `#${order.order_number} — ${client}`, shop);

            // 3. Automation
            await automationEngine.run("order.created", { order, shop, client, phone, address });

            // 4. Notification Telegram — SAMII rapporte
            const message =
                `👑 *SAMII — Commande #${order.order_number} enregistrée*\n\n` +
                `✅ J'ai enregistré la commande automatiquement.\n\n` +
                `👤 *Client :* ${client}\n` +
                `📞 *Tél :* ${phone}\n` +
                `📍 *Adresse :* ${address}\n` +
                `📦 *Produits :* ${order.line_items?.map(i => i.title).join(", ") || ""}\n` +
                `💰 *Total :* ${order.total_price} DZD\n` +
                `📊 *Statut :* ${order.financial_status}\n\n` +
                `_SAMII gère la suite automatiquement._`;

            await this.notifyShop(shop, { whatsapp: phone }, message);

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
                `👑 *SAMII — Commande #${order.order_number} mise à jour*\n\n` +
                `👤 *Client :* ${client}\n` +
                `📦 *Statut :* ${order.fulfillment_status || order.financial_status}\n\n` +
                `_Mis à jour automatiquement._`;

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
                `👑 *SAMII — Paiement confirmé #${order.order_number}*\n\n` +
                `✅ Paiement reçu et enregistré.\n\n` +
                `👤 *Client :* ${client}\n` +
                `💰 *Total :* ${order.total_price} DZD\n\n` +
                `_SAMII continue le traitement._`;

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
                `👑 *SAMII — Expédition #${order.order_number}*\n\n` +
                `✅ J'ai mis à jour le statut en expédiée.\n\n` +
                `👤 *Client :* ${client}\n` +
                `📦 *Transporteur :* ${carrier}\n` +
                `🔍 *Tracking :* ${tracking}\n\n` +
                `_Client notifié automatiquement._`;

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
                `👑 *SAMII — Livraison confirmée #${order.order_number}*\n\n` +
                `✅ Colis livré avec succès.\n\n` +
                `👤 *Client :* ${client}\n\n` +
                `_Dossier clôturé automatiquement._`;

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
                `👑 *SAMII — Commande #${order.order_number} annulée*\n\n` +
                `❌ Annulation enregistrée automatiquement.\n\n` +
                `👤 *Client :* ${client}\n` +
                `💬 *Raison :* ${order.cancel_reason || "Non précisée"}\n\n` +
                `_Dossier mis à jour._`;

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
                `👑 *SAMII — Alerte Stock*\n\n` +
                `⚠️ Stock faible détecté.\n\n` +
                `📦 *Produit :* ${product}\n` +
                `🔢 *Quantité restante :* ${variant}\n\n` +
                `_Pensez à réapprovisionner._`;

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
                `👑 *SAMII — Stock ÉPUISÉ*\n\n` +
                `🚨 Rupture de stock détectée.\n\n` +
                `📦 *Produit :* ${product}\n\n` +
                `_Action requise immédiatement._`;

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
                `👑 *SAMII — Yalidine #${orderId}*\n\n` +
                `✅ Statut mis à jour automatiquement.\n\n` +
                `📊 *Nouveau statut :* ${status}\n` +
                `🔍 *Tracking :* ${tracking || "N/A"}\n\n` +
                `_Airtable synchronisé._`;

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
                `👑 *SAMII — Livraison Yalidine #${orderId}*\n\n` +
                `✅ Colis livré — statut mis à jour.\n\n` +
                `👤 *Client :* ${client || "Client"}\n\n` +
                `_Dossier clôturé automatiquement._`;

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
                `👑 *SAMII — Retour Yalidine #${orderId}*\n\n` +
                `🔄 Colis retourné — statut mis à jour.\n\n` +
                `💬 *Raison :* ${reason || "Non précisée"}\n\n` +
                `_Airtable synchronisé._`;

            await this.notifyShop(shop, {}, message);

            return { success: true, shop, orderId };

        } catch (err) {
            console.error("❌ CommerceEngine.yalidineReturned :", err.message);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new CommerceEngine();
