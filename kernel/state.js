/**
 * ============================================================
 * OG • Global State
 * Stocke l'état général du système.
 * ============================================================
 */

class State {

    constructor() {

        this.data = {};

    }

    set(key, value) {

        this.data[key] = value;

    }

    get(key) {

        return this.data[key];

    }

    has(key) {

        return key in this.data;

    }

    all() {

        return this.data;

    }

}

module.exports = new State();
