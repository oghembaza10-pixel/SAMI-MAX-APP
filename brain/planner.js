// ======================================================
// SAMII OS — PLANNER V3 (exécute de vraies actions)
// ======================================================
const gemini = require("../services/geminiService");
const commerceEngine = require("../engines/commerceEngine");

class SamiiPlanner {
    async executeFunction(name, args, context = {}) {
        switch (name) {
            case "confirmer_commande":
                return await commerceEngine.confirmTelegramOrder({ payload: { orderId: args.orderId } });

            case "annuler_commande":
                return await commerceEngine.cancelTelegramOrder({ payload: { orderId: args.orderId } });

            case "prendre_rendez_vous":
                return await commerceEngine.createRdvFromChat(context, args);

            case "proposer_creneaux_rdv":
                return await commerceEngine.proposerCreneauxRdv(context, args);

            case "passer_commande":
                return await commerceEngine.createOrderFromChat(context, args);

            case "rechercher_prospects":
                return await this.rechercherProspects(args);

            default:
                return { success: false, error: `Fonction inconnue : ${name}` };
        }
    }

    // Même moteur que routes/radarprospects.js (recherche web réelle via
    // Gemini), mais utilisable directement dans une conversation avec Sami —
    // par un marchand pour ses propres clients, ou par le fondateur pour
    // trouver des marchands à qui proposer SAMII.
    async rechercherProspects({ cible, marche }) {
        try {
            const prompt = `Tu es SAMII, le stratège commercial de OG Technology. On te demande de trouver de vrais prospects (clients ou marchands potentiels) à contacter.

Profil de prospect recherché : ${cible}
Marché cible : ${marche}

Utilise la recherche web pour identifier entre 5 et 8 VRAIES entreprises, boutiques ou pages professionnelles qui correspondent à ce profil — jamais de noms inventés. Cherche largement : Google Maps/Google Business, pages entreprise LinkedIn, pages professionnelles Instagram et Facebook, annuaires professionnels, sites officiels, marketplaces B2B.

Pour chacune, ramène le MAXIMUM d'informations publiques disponibles : nom, site web, page réseau social, secteur d'activité, et — uniquement si l'entreprise l'affiche elle-même publiquement pour être contactée professionnellement — son email ou téléphone professionnel de contact. Ne remonte jamais les coordonnées personnelles d'un individu qui ne sont pas destinées au contact professionnel.

Réponds UNIQUEMENT avec un tableau JSON valide, sans aucun texte autour, sans balises markdown, dans ce format exact :
[
  { "nom": "Nom de l'entreprise ou de la boutique", "lien": "URL publique si trouvée, sinon chaîne vide", "reseau_social": "URL de page pro si trouvée, sinon chaîne vide", "contact_pro": "Email ou téléphone professionnel publié par l'entreprise, sinon chaîne vide", "secteur": "Secteur d'activité", "explication": "Une phrase expliquant pourquoi c'est un bon prospect." }
]`;

            const result = await gemini.chatWithSearch({ message: prompt, context: { source: "rechercher_prospects_chat" } });
            const rawText = result.type === "text" ? result.text : "";
            const match = rawText.match(/\[[\s\S]*\]/);
            const prospects = match ? JSON.parse(match[0]) : null;

            if (!prospects || !Array.isArray(prospects)) {
                return { success: false, error: "Recherche impossible pour le moment, réessaie." };
            }
            return { success: true, prospects, sources: result.sources || [] };
        } catch (err) {
            console.error("❌ Planner.rechercherProspects :", err.message);
            return { success: false, error: "Erreur lors de la recherche." };
        }
    }

    async ask(message, context = {}, history = []) {
        try {
            // Les outils disponibles (confirmer/annuler une commande, prendre
            // RDV, passer commande) concernent exclusivement une conversation
            // avec un CLIENT d'un marchand — jamais le fondateur qui parle à
            // SAMII pour lui-même (QG, Academy, Entraînement admin). Sans ce
            // garde-fou, un fallback (Groq/OpenRouter/DeepSeek, moins
            // disciplinés que Gemini sur le function calling) peut déclencher
            // ces outils hors contexte, avec des valeurs inventées.
            const useTools = context.allowActions !== false && context.audience !== "souverain";
            const result = await gemini.chat({ message, context, useTools, history });

            if (result.type === "function_call") {
                console.log(`⚙️ SAMII exécute : ${result.name}`, result.args);
                const functionResult = await this.executeFunction(result.name, result.args, context);

                const finalReply = await gemini.chatWithFunctionResult({
                    message,
                    context,
                    functionName: result.name,
                    functionArgs: result.args,
                    functionResult,
                    thoughtSignature: result.thoughtSignature,
                    provider: result.provider,
                    toolCallId: result.toolCallId,
                    assistantMessage: result.assistantMessage,
                    history,
                });
                return finalReply;
            }

            return result.text;

        } catch (err) {
            console.error("❌ Planner.ask :", err.message);
            return "SAMII est momentanément indisponible. Réessaie dans quelques instants.";
        }
    }

    async build(objective = {}, context = {}, history = []) {
        if (objective.goal) {
            const reply = await this.ask(objective.goal, context, history);
            return { success: true, reply };
        }
        return { success: false, reply: "Objectif manquant." };
    }
}

module.exports = new SamiiPlanner();
