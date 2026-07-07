/**
 * OG • Vision Engine
 */

class VisionEngine {

    async analyze(input) {

        return {
            success: true,
            input
        };

    }

}

module.exports = new VisionEngine();
