/**
 * ============================================================
 * OG • Marketing Engine
 * ============================================================
 */

class MarketingEngine {

    constructor() {

        this.campaigns = [];
        this.recommendations = [];

    }

    createCampaign(campaign) {

        this.campaigns.push(campaign);

    }

    addRecommendation(text) {

        this.recommendations.push(text);

    }

    getCampaigns() {

        return this.campaigns;

    }

    getRecommendations() {

        return this.recommendations;

    }

}

module.exports = new MarketingEngine();
