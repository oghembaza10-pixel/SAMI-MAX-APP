/**
 * ============================================================
 * OG • EMPIRE
 * Kernel Principal
 * ------------------------------------------------------------
 * Le Kernel est le cœur du système.
 * Il initialise OG, charge les modules principaux,
 * orchestre les moteurs et fournit un point d'entrée unique.
 *
 * Aucune logique métier ne doit vivre ici.
 * Le Kernel coordonne uniquement les composants.
 * ============================================================
 */

class OGKernel {
  constructor() {
    this.name = "OG Kernel";
    this.version = "1.0.0";
    this.status = "booting";

    this.modules = new Map();
    this.engines = new Map();
    this.services = new Map();

    this.startedAt = null;
  }

  registerModule(name, module) {
    this.modules.set(name, module);
    return this;
  }

  registerEngine(name, engine) {
    this.engines.set(name, engine);
    return this;
  }

  registerService(name, service) {
    this.services.set(name, service);
    return this;
  }

  async boot() {
    this.status = "starting";

    this.startedAt = new Date();

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚀 OG • EMPIRE");
    console.log("🧠 Initialisation du Kernel");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    this.status = "online";

    console.log("✅ Kernel prêt.");
    console.log(`Modules : ${this.modules.size}`);
    console.log(`Engines : ${this.engines.size}`);
    console.log(`Services : ${this.services.size}`);

    return this;
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      modules: this.modules.size,
      engines: this.engines.size,
      services: this.services.size,
      startedAt: this.startedAt
    };
  }
}

module.exports = new OGKernel();
