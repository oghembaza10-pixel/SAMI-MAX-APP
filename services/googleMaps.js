/**
 * ============================================================
 * OG • Google Maps Service
 * ============================================================
 */

class GoogleMapsService {

    async route(origin, destination) {

        return {
            success: true,
            origin,
            destination
        };

    }

}

module.exports = new GoogleMapsService();
