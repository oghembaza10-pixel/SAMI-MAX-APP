/**
 * ============================================================
 * OG • Automation Engine
 * Décide et exécute les automatisations
 * ============================================================
 */

const airtable = require("../services/airtable");

class AutomationEngine {

    // ── EXÉCUTE les automatisations selon le trigger ─
    async run(trigger, data) {
        try {
            console.log(`⚙️ Automation trigger : ${trigger}`);

            // Lit les automatisations actives depuis Airtable
            const automations = await airtable.find(
                "AUTOMATISATIONS",
                `AND({Trigger} = "${trigger}", {Actif} = TRUE())`
            );

            if (!automations.length) {
                console.log(`ℹ️ Aucune automatisation pour : ${trigger}`);
                return;
            }

            for (const auto of automations) {
                const action = auto.fields["Action"];
                console.log(`▶️ Exécution : ${action}`);
                await this.execute(action, data, auto.fields);
            }

        } catch (err) {
            console.error("❌ AutomationEngine.run :", err.message);
        }
    }

    // ── EXÉCUTE une action spécifique ────────────────
    async execute(action, data, fields) {
        try {
            switch (action) {

                case "creer_tache":
                    await airtable.create("JOURNAL", {
                        "Action"  : "Tâche créée",
                        "Détails" : fields["Message"] || JSON.stringify(data),
                        "Boutique": data.shop || "",
                        "Date"    : new Date().toISOString(),
                    });
                    break;

                case "envoyer_notification":
                    await airtable.notification(
                        fields["Type"] || "info",
                        fields["Message"] || "",
                        data.shop || ""
                    );
                    break;

                case "creer_client":
                    await airtable.create("CLIENTS", {
                        "Nom"      : data.client || "Inconnu",
                        "Téléphone": data.phone || "",
                        "Source"   : data.source || "auto",
                        "Date"     : new Date().toISOString(),
                        "Statut"   : "actif",
                    });
                    break;

                case "alerte_stock":
                    await airtable.notification(
                        "stock",
                        `⚠️ Stock faible — ${data.product}`,
                        data.shop || ""
                    );
                    break;

                case "envoyer_facture":
                    await airtable.create("FACTURES", {
                        "Commande" : String(data.orderId || ""),
                        "Client"   : data.client || "",
                        "Total"    : data.total || 0,
                        "Statut"   : "envoyée",
                        "Date"     : new Date().toISOString(),
                    });
                    break;

                default:
                    console.log(`⚠️ Action inconnue : ${action}`);
            }

            await airtable.log(
                `automation.${action}`,
                JSON.stringify(data),
                data.shop || ""
            );

        } catch (err) {
            console.error(`❌ AutomationEngine.execute [${action}] :`, err.message);
        }
    }
}

module.exports = new AutomationEngine();

