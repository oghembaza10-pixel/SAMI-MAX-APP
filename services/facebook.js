/**
 * OG • Facebook Service
 */

class FacebookService {

    async publish(post) {

        return {

            success: true,
            platform: "facebook",
            post

        };

    }

}

module.exports = new FacebookService();
