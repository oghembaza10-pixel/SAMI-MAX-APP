class Registry {

    constructor() {

        this.providers = {};

    }

    register(name, provider) {

        this.providers[name] = provider;

    }

    get(name) {

        return this.providers[name];

    }

    all() {

        return this.providers;

    }

}

module.exports = new Registry();
