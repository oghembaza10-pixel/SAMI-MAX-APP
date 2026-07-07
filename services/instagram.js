/**
 * OG • Instagram Service
 */

class InstagramService {

    async publish(post) {

        return {

            success: true,
            platform: "instagram",
            post

        };

    }

}

module.exports = new InstagramService();
