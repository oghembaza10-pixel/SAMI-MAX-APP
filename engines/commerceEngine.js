/**
 * ============================================================
 * OG • Commerce Engine
 * Cerveau Commerce de SAMII
 * ============================================================
 */

const axios = require("axios");
const telegramService = require("../services/telegramService");

class CommerceEngine {

    async newOrder(event) {

        try {

            const order = event.payload;
            const shop = event.shop;

            console.log(`🛒 Nouvelle commande : ${shop}`);

            // ================================
            // FUTUR
            // ================================
            // Ici SAMII décidera quoi faire :
            //
            // ✔ Enregistrer Airtable
            // ✔ Envoyer Telegram
            // ✔ Envoyer WhatsApp
            // ✔ Prévenir Messenger
            // ✔ Prévenir Instagram
            // ✔ Créer CRM
            // ✔ Déclencher IA
            // ✔ Déclencher Analytics
            //
            // Pour l'instant on ne fait rien afin
            // de ne pas casser le webhook actuel.
            // ================================

            return {
                success: true,
                shop,
                orderId: order.id
            };

        } catch (err) {

            console.error("CommerceEngine :", err.message);

            return {
                success: false,
                error: err.message
            };

        }

    }

}

module.exports = new CommerceEngine();
