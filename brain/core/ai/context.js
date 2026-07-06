// ======================================================
// SAMII OS
// AI
// CONTEXT ENGINE
// ======================================================

class ContextEngine {

    build(data = {}) {

        return {

            user: data.user || {},

            qg: data.qg || {},

            grade: data.grade || "Soldat",

            business: data.business || null,

            country: data.country || null,

            language: data.language || "fr",

            dialect: data.dialect || null,

            history: data.history || [],

            objectives: data.objectives || [],

            subscriptions: data.subscriptions || [],

            permissions: data.permissions || [],

            date: new Date().toISOString()

        };

    }

}

module.exports = new ContextEngine();
