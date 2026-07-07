/**
 * OG • Notification Engine
 */

class NotificationEngine {

    constructor() {

        this.notifications = [];

    }

    send(notification) {

        this.notifications.push(notification);

    }

    all() {

        return this.notifications;

    }

}

module.exports = new NotificationEngine();
