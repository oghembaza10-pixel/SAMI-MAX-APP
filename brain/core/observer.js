// ======================================================
// SAMII OS
// CORE
// OBSERVER
// ======================================================

class SamiiObserver {

    async observe(state = {}) {

        return {

            alerts: this.detectAlerts(state),

            opportunities: this.detectOpportunities(state),

            risks: this.detectRisks(state),

            recommendations: this.buildRecommendations(state)

        };

    }

    // ==============================
    // Alertes
    // ==============================

    detectAlerts(state) {

        const alerts = [];

        if (state.shopifyOffline)
            alerts.push("SHOPIFY_OFFLINE");

        if (state.metaOffline)
            alerts.push("META_OFFLINE");

        if (state.lowBalance)
            alerts.push("LOW_BALANCE");

        if (state.serverOffline)
            alerts.push("SERVER_OFFLINE");

        return alerts;

    }

    // ==============================
    // Opportunités
    // ==============================

    detectOpportunities(state) {

        const opportunities = [];

        if (state.newCustomer)
            opportunities.push("NEW_CUSTOMER");

        if (state.highTraffic)
            opportunities.push("HIGH_TRAFFIC");

        if (state.newProduct)
            opportunities.push("PROMOTE_PRODUCT");

        if (state.goodSales)
            opportunities.push("SCALE_CAMPAIGN");

        return opportunities;

    }

    // ==============================
    // Risques
    // ==============================

    detectRisks(state) {

        const risks = [];

        if (state.badReviews)
            risks.push("BAD_REVIEWS");

        if (state.highRefunds)
            risks.push("HIGH_REFUNDS");

        if (state.lowStock)
            risks.push("LOW_STOCK");

        return risks;

    }

    // ==============================
    // Conseils
    // ==============================

    buildRecommendations(state) {

        const recommendations = [];

        if (state.lowStock)
            recommendations.push("Réapprovisionner le stock.");

        if (state.highTraffic)
            recommendations.push("Augmenter le budget publicitaire.");

        if (state.badReviews)
            recommendations.push("Analyser les avis clients.");

        return recommendations;

    }

}

module.exports = new SamiiObserver();
