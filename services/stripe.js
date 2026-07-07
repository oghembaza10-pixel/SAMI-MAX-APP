/**
 * ============================================================
 * OG • Stripe Service
 * ============================================================
 */

class StripeService {

    async createPayment(payment) {

        return {
            success: true,
            payment
        };

    }

}

module.exports = new StripeService();
