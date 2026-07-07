/**
 * OG • Automation Engine
 */

class AutomationEngine {

    constructor() {

        this.workflows = [];

    }

    register(workflow) {

        this.workflows.push(workflow);

    }

    list() {

        return this.workflows;

    }

}

module.exports = new AutomationEngine();
