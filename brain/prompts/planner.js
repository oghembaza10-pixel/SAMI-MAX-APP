/**
 * ============================================================
 * OG • Planner — Cerveau Souverain de SAMII
 * Raisonne → Décide → Exécute
 * ============================================================
 */

const geminiService    = require("../services/geminiService");
const airtable         = require("../services/airtable");
const commerceEngine   = require("../engines/commerceEngine");
const crmEngine        = require("../engines/crmEngine");
const automationEngine = require("../engines/automationEngine");
const { getTables }    = require("./sovereign/tables");

// ── DÉTECTEUR D'INTENTION ────────────────────────────
function detectIntent(message) {
    const m = message.toLowerCase();

    if (m.match(/commande|vente|boutique|shopify|produit|stock/))
        return "commerce";
    if (m.match(/client|message|whatsapp|telegram|conversation|sav/))
        return "crm";
    if (m.match(/automatise|déclenche|workflow|tâche|facture/))
        return "automation";
    if (m.match(/stratégie|développe|croissance|empire|vision|plan/))
        return "strategie";
    if (m.match(/code|bug|programme|javascript|api|erreur/))
        return "programmation";
    if (m.match(/pub|marketing|contenu|tiktok|instagram|meta/))
        return "marketing";
    if (m.match(/argent|capital|investissement|finance|budget/))
        return "finance";
    if (m.match(/livraison|transporteur|tracking|logistique/))
        return "logistique";

    return "general";
}

// ── CONSTRUCTEUR DE CONTEXTE ─────────────────────────
function buildContext(message, baseContext = {}) {
    const intent = detectIntent(message);
    const tables = getTables(message);

    return {
        ...baseContext,
        intent,
        tables,
        session: {
            timestamp: Date.now(),
            intent,
        },
    };
}

// ── DÉCLENCHEUR DE MOTEUR ────────────────────────────
async function triggerEngine(intent, context) {
    try {
        switch (intent) {

            case "commerce":
                console.log("⚙️ Planner → CommerceEngine");
                // Déclenche si données disponibles
                if (context.shop && context.commande) {
                    await commerceEngine.newOrder({
                        type   : "planner.triggered",
                        shop   : context.shop,
                        payload: context.commande,
                    });
                }
                break;

            case "crm":
                console.log("⚙️ Planner → CRMEngine");
                if (context.shop) {
                    await crmEngine.telegram({
                        shop   : context.shop,
                        payload: { text: context.message, from: { first_name: context.client || "Inconnu" } },
                    });
                }
                break;

            case "automation":
                console.log("⚙️ Planner → AutomationEngine");
                await automationEngine.run("planner.triggered", context);
                break;

            default:
                // Pas de moteur à déclencher — réponse IA suffit
                break;
        }
    } catch (err) {
        console.error("❌ Planner.triggerEngine :", err.message);
    }
}

// ── PLAN PRINCIPAL ───────────────────────────────────
async function plan({ message, context = {} }) {
    try {
        console.log(`🧠 Planner → Intent détecté : ${detectIntent(message)}`);

        // 1. Construire le contexte enrichi
        const enrichedContext = buildContext(message, context);

        // 2. Log dans Airtable
        await airtable.log(
            "planner.plan",
            `Intent: ${enrichedContext.intent} | Message: ${message}`,
            context.shop || ""
        );

        // 3. Générer la réponse IA avec contexte complet
        const reply = await geminiService.chat({
            message,
            context: enrichedContext,
        });

        // 4. Déclencher le moteur si nécessaire
        await triggerEngine(enrichedContext.intent, {
            ...enrichedContext,
            message,
        });

        // 5. Retourner la réponse
        return {
            success: true,
            reply,
            intent : enrichedContext.intent,
        };

    } catch (err) {
        console.error("❌ Planner :", err.message);
        return {
            success: false,
            reply  : "SAMII réfléchit. Réessaie dans un instant.",
            intent : "error",
        };
    }
}

module.exports = { plan, detectIntent, buildContext };
