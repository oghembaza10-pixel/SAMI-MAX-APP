/**
 * OG • WhatsApp Service
 */

class WhatsAppService {

    async send(to, message) {

        console.log(`📲 WhatsApp -> ${to}`);

        return {

            success: true,
            to,
            message

        };

    }

}

module.exports = new WhatsAppService();
