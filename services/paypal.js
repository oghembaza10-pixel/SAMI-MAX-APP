/**
 * ============================================================
 * OG • PayPal Service
 * ============================================================
 */

class PayPalService {

    async createPayment(payment) {

        return {
            success: true,
            payment
        };

    }

}

module.exports = new PayPalService();
