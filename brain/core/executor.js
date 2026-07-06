// ======================================================
// SAMII OS
// CORE
// EXECUTOR
// ======================================================

class SamiiExecutor {

    constructor() {

        this.providers = {};

    }

    // ===========================
    // Enregistrer un module
    // ===========================

    register(name, provider) {

        this.providers[name] = provider;

    }

    // ===========================
    // Exécuter une action
    // ===========================

    async execute(action, payload = {}) {

        try {

            switch (action) {

                case "SHOPIFY_CREATE_PRODUCT":

                    return await this.providers.shopify.createProduct(payload);

                case "SHOPIFY_UPDATE_PRODUCT":

                    return await this.providers.shopify.updateProduct(payload);

                case "META_CREATE_CAMPAIGN":

                    return await this.providers.meta.createCampaign(payload);

                case "TIKTOK_CREATE_CAMPAIGN":

                    return await this.providers.tiktok.createCampaign(payload);

                case "WHATSAPP_SEND":

                    return await this.providers.whatsapp.send(payload);

                case "AIRTABLE_CREATE":

                    return await this.providers.airtable.create(payload);

                case "AIRTABLE_UPDATE":

                    return await this.providers.airtable.update(payload);

                default:

                    return {

                        success: false,

                        message: "Action inconnue."

                    };

            }

        }

        catch (err) {

            return {

                success: false,

                error: err.message

            };

        }

    }

}

module.exports = new SamiiExecutor();
