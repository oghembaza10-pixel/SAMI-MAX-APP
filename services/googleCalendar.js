/**
 * ============================================================
 * OG • Google Calendar Service
 * ============================================================
 */

class GoogleCalendarService {

    async createEvent(event) {

        return {
            success: true,
            event
        };

    }

}

module.exports = new GoogleCalendarService();
