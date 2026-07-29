/**
 * ============================================================
 * OG • Commerce Engine V3 — VERSION DÉFINITIVE
 * SAMII agit seul et rapporte
 * ============================================================
 */
const socketService = require("../services/socketService");
const airtable           = require("../services/airtable");
const notificationEngine = require("../engines/notificationEngine");
const automationEngine   = require("../engines/automationEngine");

class CommerceEngine {
    // ── HELPER : Boutique ────────────────────────────────────
    async getBoutique(shop) {
        return await airtable.findOne("BOUTIQUES", `{shop_url} = "${shop}"`);
    }

    // ── HELPER : workspace_id réel à partir du shop Shopify ──
    async getWorkspaceIdForShop(shop) {
        try {
            const boutique = await this.getBoutique(shop);
            return boutique?.fields?.workspace_id || shop;
        } catch {
            return shop;
        }
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
         // ── ✅ BOUCLIER ANTI-FRAUDE : détection de commandes à risque ──
            const montantCommande = parseFloat(order.total_price || 0);
            const SEUIL_RISQUE = 50000; // ajuste selon ta devise/marché
            let alerteFraude = null;

            if (montantCommande > SEUIL_RISQUE) {
                alerteFraude = `Montant élevé (${montantCommande} DZD)`;
            }
            if (order.customer?.orders_count === 0 && montantCommande > SEUIL_RISQUE / 2) {
                alerteFraude = alerteFraude
                    ? `${alerteFraude} + Premier achat`
                    : "Premier achat avec montant important";
            }
            const workspaceId = await this.getWorkspaceIdForShop(shop);

            await airtable.create("COMMANDES", {
                "ID Commande"   : String(order.order_number || order.id),
                "nom client"    : client,
                "Téléphone"     : phone,
                "Produit"       : order.line_items?.map(i => i.title).join(", ") || "",
                "Statut"        : "en attente",
                "Boutique"      : workspaceId,
                "Date Commande" : order.created_at || new Date().toISOString(),
                "montant"       : String(parseFloat(order.total_price || 0)),
            });

            await airtable.log("order.created", `#${order.order_number} — ${client}`, shop);
            await automationEngine.run("order.created", { shop, payload: order });

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

            // ── Alerte séparée si risque détecté ──
            if (alerteFraude) {
                const alerteMsg =
                    `🛡️ *SAMII — Bouclier Anti-Fraude*\n\n` +
                    `⚠️ Commande #${order.order_number} signalée pour vérification.\n\n` +
                    `👤 *Client :* ${client}\n` +
                    `💰 *Montant :* ${order.total_price} DZD\n` +
                    `🚩 *Raison :* ${alerteFraude}\n\n` +
                    `_Vérifiez cette commande avant expédition._`;
                await this.notifyShop(shop, { whatsapp: phone }, alerteMsg);
                await airtable.log("fraude.alerte", `#${order.order_number} — ${alerteFraude}`, shop);
            }

            socketService.emitToShop(shop, "nouvelle-commande", { id: order.order_number });

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
            await automationEngine.run("order.updated", { shop, payload: order });

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
            await automationEngine.run("order.paid", { shop, payload: order });

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
            await automationEngine.run("order.fulfilled", { shop, payload: order });

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

            if (phone) {
                try {
                    const reviewMessage =
                        `Bonjour ${client} 👋\n\n` +
                        `Votre commande #${order.order_number} a bien été livrée !\n\n` +
                        `Votre avis compte énormément pour nous. Pourriez-vous prendre 30 secondes pour nous laisser un retour ?\n\n` +
                        `Merci de votre confiance 🙏`;

                    await notificationEngine.send({
                        channel: "whatsapp",
                        to: phone,
                        message: reviewMessage,
                        shop,
                    });

                    await airtable.log("sentinelle.avis.envoyee", `#${order.order_number} — ${client}`, shop);
                } catch (avisErr) {
                    console.warn("⚠️ Sentinelle Avis non envoyée :", avisErr.message);
                }
            }

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
            await automationEngine.run("order.cancelled", { shop, payload: order });

            const message =
                `👑 *SAMII — Commande #${order.order_number} annulée*\n\n` +
                `❌ Annulation enregistrée automatiquement.\n\n` +
                `👤 *Client :* ${client}\n` +
                `💬 *Raison :* ${order.cancel_reason || "Non précisée"}\n\n` +
                `_Dossier mis à jour._`;

            await this.notifyShop(shop, { whatsapp: phone }, message);
            socketService.emitToShop(shop, "commande-annulee", { id: order.order_number });

            return { success: true, shop, orderId: order.id };
        } catch (err) {
            console.error("❌ CommerceEngine.orderCancelled :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // TELEGRAM — CONFIRMATION (canal indépendant, pas Shopify)
    // =========================================================
    async confirmTelegramOrder(event) {
        try {
            const { orderId } = event.payload;
            await airtable.updateWhere("COMMANDES", `{ID Commande} = "${orderId}"`, {
                "Statut": "confirmée"
            });
            await airtable.log("order.confirmed.telegram", `#${orderId} confirmée via Telegram`, "");
            return { success: true, orderId };
        } catch (err) {
            console.error("❌ CommerceEngine.confirmTelegramOrder :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // TELEGRAM — ANNULATION (canal indépendant, pas Shopify)
    // =========================================================
    async cancelTelegramOrder(event) {
        try {
            const { orderId } = event.payload;
            await airtable.updateWhere("COMMANDES", `{ID Commande} = "${orderId}"`, {
                "Statut": "annulée"
            });
            await airtable.log("order.cancelled.telegram", `#${orderId} annulée via Telegram`, "");
            return { success: true, orderId };
        } catch (err) {
            console.error("❌ CommerceEngine.cancelTelegramOrder :", err.message);
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
            await automationEngine.run("stock.low", { shop, payload: event.payload });

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
   
