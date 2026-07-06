// ======================================================
// SAMII OS
// CORE
// LEARNING ENGINE
// ======================================================

class SamiiLearning {

    constructor() {

        this.history = [];

    }

    // ===================================
    // Sauvegarder une expérience
    // ===================================

    learn(event = {}) {

        this.history.push({

            date: new Date(),

            action: event.action || null,

            result: event.result || null,

            success: event.success || false,

            confidence: event.confidence || 0,

            notes: event.notes || ""

        });

    }

    // ===================================
    // Retourner les dernières expériences
    // ===================================

    getLast(limit = 20) {

        return this.history.slice(-limit);

    }

    // ===================================
    // Calcul du taux de réussite
    // ===================================

    getSuccessRate() {

        if (this.history.length === 0)
            return 100;

        const success = this.history.filter(h => h.success).length;

        return Math.round((success / this.history.length) * 100);

    }

    // ===================================
    // Vider l'historique
    // ===================================

    clear() {

        this.history = [];

    }

}

module.exports = new SamiiLearning();
