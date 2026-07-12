/**
 * OG • Telegram Service
 */

const axios = require("axios");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

class TelegramService {

    async send(chatId, text) {
        try {
            await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: text,
                parse_mode: "Markdown"
            });
            console.log(`✅ Telegram envoyé à ${chatId}`);
            return { success: true, chatId, message: text };
        } catch (err) {
            console.error("❌ Telegram error:", err.message);
            return { success: false, chatId, error: err.message };
        }
    }

    async notifyNewOrder(chatId, order) {
        const msg = `
🛒 *Nouvelle Commande !*
━━━━━━━━━━━━━━
📦 Commande : #${order.order_number}
👤 Client : ${order.customer?.first_name || ""} ${order.customer?.last_name || ""}
💰 Total : ${order.total_price} DZD
📍 Ville : ${order.shipping_address?.city || "N/A"}
━━━━━━━━━━━━━━
⏰ ${new Date().toLocaleString("fr-DZ")}
        `;
        return await this.send(chatId, msg);
    }

    async notifyOrderCancelled(chatId, order) {
        const msg = `
❌ *Commande Annulée*
━━━━━━━━━━━━━━
📦 Commande : #${order.order_number}
👤 Client : ${order.customer?.first_name || ""} ${order.customer?.last_name || ""}
💰 Montant : ${order.total_price} DZD
━━━━━━━━━━━━━━
⏰ ${new Date().toLocaleString("fr-DZ")}
        `;
        return await this.send(chatId, msg);
    }

    async notifyLowStock(chatId, productTitle, qty) {
        const msg = `
⚠️ *Stock Faible !*
━━━━━━━━━━━━━━
📦 Produit : ${productTitle}
🔢 Stock restant : ${qty} unités
━━━━━━━━━━━━━━
⏰ ${new Date().toLocaleString("fr-DZ")}
        `;
        return await this.send(chatId, msg);
    }

    async notifyOrderFulfilled(chatId, order) {
        const msg = `
✅ *Commande Expédiée !*
━━━━━━━━━━━━━━
📦 Commande : #${order.order_number}
👤 Client : ${order.customer?.first_name || ""} ${order.customer?.last_name || ""}
📍 Destination : ${order.shipping_address?.city || "N/A"}
━━━━━━━━━━━━━━
⏰ ${new Date().toLocaleString("fr-DZ")}
        `;
        return await this.send(chatId, msg);
    }

}

module.exports = new TelegramService();
