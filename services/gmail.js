/**
 * ============================================================
 * OG • Gmail Service
 * ============================================================
 */

class GmailService {

    async send(to, subject, message) {

        return {
            success: true,
            to,
            subject,
            message
        };

    }

}

module.exports = new GmailService();
