/**
 * OG • Analytics Engine
 */

class AnalyticsEngine {

    constructor() {

        this.reports = [];

    }

    add(report) {

        this.reports.push(report);

    }

    all() {

        return this.reports;

    }

}

module.exports = new AnalyticsEngine();
