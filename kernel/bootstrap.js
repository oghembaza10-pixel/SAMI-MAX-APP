/**
 * ============================================================
 * OG • EMPIRE
 * Bootstrap
 * ------------------------------------------------------------
 * Point d'entrée du système.
 * Charge le Kernel puis initialise progressivement
 * tous les composants de l'application.
 * ============================================================
 */

const kernel = require("./kernel");

class Bootstrap {

    async start() {

        console.log("");
        console.log("══════════════════════════════════════");
        console.log("🚀 DÉMARRAGE DE OG • EMPIRE");
        console.log("══════════════════════════════════════");
        console.log("");

        await kernel.boot();

        console.log("");
        console.log("🟢 OG est opérationnel.");
        console.log("");

        return kernel;
    }

}

module.exports = new Bootstrap();
