// ======================================================
// SAMII OS
// ACTIONS
// ======================================================

class SamiiActions {

    constructor() {

        this.actions = {};

    }

    register(name, callback) {

        this.actions[name] = callback;

    }

    async execute(name, payload = {}) {

        if (!this.actions[name]) {

            return {

                success: false,

                message: "Action inconnue."

            };

        }

        return await this.actions[name](payload);

    }

    exists(name) {

        return !!this.actions[name];

    }

    list() {

        return Object.keys(this.actions);

    }

}

module.exports = new SamiiActions();
