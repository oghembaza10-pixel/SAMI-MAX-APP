/**
 * OG • Telegram Service
 */

class TelegramService {

    async send(chatId, message) {

        return {

            success: true,
            chatId,
            message

        };

    }

}

module.exports = new TelegramService();
