// ======================================================
// SAMII OS — PLANNER V3 (exécute de vraies actions)
// ======================================================
const gemini = require("../services/geminiService");
const googleSearch = require("../services/googleSearch");
const google = require("../services/google");
const commerceEngine = require("../engines/commerceEngine");
const factureService = require("../services/factureService");

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

            case "resume_journee":
                return await this.resumeJournee(context);

            case "consulter_gmail":
                return await this.consulterGmail(context);

            case "envoyer_email":
                return await this.envoyerEmail(context, args);

            case "consulter_agenda":
                return await this.consulterAgenda(context);

            case "creer_evenement_agenda":
                return await this.creerEvenementAgenda(context, args);

            case "lister_fichiers_drive":
                return await this.listerFichiersDrive(context);

            case "creer_rapport_sheets":
                return await this.creerRapportSheets(context, args);

            case "envoyer_facture":
                return await this.envoyerFacture(context, args);

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
            const cseResults = await googleSearch.search(`${cible} ${marche}`);
            const cseContext = cseResults.length
                ? `\n\nRésultats déjà trouvés sur TikTok/Meta/LinkedIn (moteur de recherche ciblé) — utilise-les en priorité s'ils sont pertinents, en plus de ta propre recherche web :\n${cseResults.map(r => `- ${r.title} — ${r.link} — ${r.snippet}`).join("\n")}`
                : "";

            const prompt = `Tu es SAMII, le stratège commercial de OG Technology. On te demande de trouver de vrais prospects (clients ou marchands potentiels) à contacter.

Profil de prospect recherché : ${cible}
Marché cible : ${marche}
${cseContext}

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

    // ── « QU'EST-CE QUI S'EST PASSÉ AUJOURD'HUI ? » ─────────────────────
    //
    // L'identité vient de `context.identite`, qui est recopiée de la SESSION
    // par routes/api.js — jamais du corps de la requête. Un identifiant
    // accepté depuis la page, et n'importe qui demande le bilan de
    // n'importe qui.
    //
    // Sans identité, on ne devine pas : on refuse. Une IA à qui l'on répond
    // « rien » raconte une journée plausible.
    async resumeJournee(context) {
        const identite = context?.identite;
        if (!identite) {
            return { success: false, error: "Je ne sais pas de quel compte parler — reconnecte-toi." };
        }
        try {
            const briefing = require("../services/briefing");
            const { donnees, indisponibles } = await briefing.collecter(identite, context.communaute ? { slug: context.communaute } : null);
            return {
                success: true,
                periode: donnees.fenetre,
                perimetre: donnees.perimetre,
                donnees,
                // Répété dans la charge utile ET dans la description de
                // l'outil : c'est la consigne la plus importante, et une
                // consigne donnée une seule fois se perd dans un long
                // contexte.
                indisponibles,
                consigne: "Annonce clairement chaque source de la liste 'indisponibles'. N'invente aucun chiffre pour elles.",
            };
        } catch (err) {
            console.error("❌ Planner.resumeJournee :", err.message);
            return { success: false, error: "Je n'ai pas pu lire l'activité pour le moment." };
        }
    }

    // Boîte Gmail du marchand connecté (services/google.js, via son OAuth
    // Google) — jamais celle d'un client, ces outils ne sont proposés que
    // pour le marchand lui-même (voir SEARCH_TOOLS dans geminiService.js).
    async consulterGmail(context) {
        try {
            const result = await google.listRecentEmails(context.workspaceId);
            if (!result.connected) {
                return { success: false, error: "Gmail n'est pas encore connecté — va dans Paramètres → Connecter tes outils → Google." };
            }
            return { success: true, emails: result.emails };
        } catch (err) {
            console.error("❌ Planner.consulterGmail :", err.message);
            return { success: false, error: "Erreur lors de la lecture de Gmail." };
        }
    }

    async envoyerEmail(context, args) {
        try {
            return await google.sendEmail(context.workspaceId, args);
        } catch (err) {
            console.error("❌ Planner.envoyerEmail :", err.message);
            return { success: false, error: "Erreur lors de l'envoi de l'email." };
        }
    }

    async consulterAgenda(context) {
        try {
            const result = await google.listUpcomingEvents(context.workspaceId);
            if (!result.connected) {
                return { success: false, error: "Google n'est pas encore connecté — va dans Paramètres → Connecter tes outils → Google." };
            }
            return { success: true, events: result.events };
        } catch (err) {
            console.error("❌ Planner.consulterAgenda :", err.message);
            return { success: false, error: "Erreur lors de la lecture de l'agenda." };
        }
    }

    async creerEvenementAgenda(context, args) {
        try {
            return await google.createCalendarEvent(context.workspaceId, {
                summary: args.titre,
                description: args.description || "",
                startISO: args.debut,
                endISO: args.fin,
                invites: args.invites || [],
                avecMeet: args.avecMeet === true,
            });
        } catch (err) {
            console.error("❌ Planner.creerEvenementAgenda :", err.message);
            return { success: false, error: "Erreur lors de la création de l'événement." };
        }
    }

    async listerFichiersDrive(context) {
        try {
            const result = await google.listDriveFiles(context.workspaceId);
            if (!result.connected) {
                return { success: false, error: "Google n'est pas encore connecté — va dans Paramètres → Connecter tes outils → Google." };
            }
            return { success: true, files: result.files };
        } catch (err) {
            console.error("❌ Planner.listerFichiersDrive :", err.message);
            return { success: false, error: "Erreur lors de la lecture du Drive." };
        }
    }

    async creerRapportSheets(context, args) {
        try {
            return await google.creerRapportSheets(context.workspaceId, {
                titre: args.titre,
                lignes: args.lignes || [],
            });
        } catch (err) {
            console.error("❌ Planner.creerRapportSheets :", err.message);
            return { success: false, error: "Erreur lors de la création du rapport." };
        }
    }

    async envoyerFacture(context, args) {
        try {
            return await factureService.genererEtEnvoyerFacture(context.workspaceId, args.commandeId);
        } catch (err) {
            console.error("❌ Planner.envoyerFacture :", err.message);
            return { success: false, error: "Erreur lors de la génération de la facture." };
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
