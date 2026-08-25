// ==========================================================================
// SAMII OS — LES BESOINS DES MARCHANDS (les routes)
//
// DEUX PORTES DIFFÉRENTES POUR DEUX GESTES DIFFÉRENTS.
//
// Publier un besoin ne demande RIEN d'autre qu'un compte : pas de contrat, pas
// d'abonnement, pas de case à cocher. Un marchand qui doit accepter un contrat
// de développeur pour décrire son problème ne le décrit pas — et sans besoins,
// la place reste vide. C'est le sens de `requireAuth` ici plutôt que
// `exigerMembre`.
//
// Répondre à un besoin, en revanche, passe par la porte de l'Académie
// (`exigerMembre`) : une réponse peut mener à une transaction, et la
// commission de 10 % ne doit jamais être découverte après coup. On la fait
// lire AVANT la première proposition, pas au moment d'encaisser.
//
// CE QUE CHACUN VOIT, ET POURQUOI.
//   • Tout le monde voit le besoin et le NOMBRE de réponses. Zéro réponse est
//     un argument pour le développeur (la place est libre) ; beaucoup de
//     réponses le prévient honnêtement qu'il faudra se démarquer. Cacher ce
//     chiffre ferait perdre du temps aux deux côtés.
//   • Seul le marchand voit les réponses en entier. Une proposition chiffrée
//     est une information commerciale : si chaque développeur lit les prix des
//     autres, il ne propose plus son prix, il propose un peu moins que le
//     dernier. La place se transforme en enchère inversée et le travail sérieux
//     s'en va.
//   • Un développeur voit toujours SA propre réponse, pour la relire et la
//     corriger.
// ==========================================================================
const express = require("express");
const besoins = require("../services/besoins");
const metiers = require("../services/metiers");
const vitrine = require("../services/vitrine");
const journalService = require("../services/journalService");
const academie = require("../config/academie");

// Le routeur est fabriqué avec les gardes de l'Académie plutôt que de les
// redéfinir : deux définitions de « qui a le droit » finissent toujours par
// diverger, et c'est celle qu'on a oubliée qui laisse passer.
module.exports = function creerRouteur({ requireAuth, exigerMembre }) {
    const router = express.Router();

    const taux = Math.round(academie.TAUX_COMMISSION * 100);

    // ── La liste : le travail qui attend ─────────────────────────────────
    // Ouverte à tous, sans compte. C'est la page qu'un développeur regarde
    // avant de décider s'il vient — lui demander de s'inscrire pour la voir,
    // c'est lui demander de payer avant de savoir ce qu'il achète.
    router.get("/besoins", async (req, res) => {
        const metier = String(req.query.metier || "").trim();
        const recherche = String(req.query.recherche || "").trim().slice(0, 80);

        try {
            const [ouverts, miens] = await Promise.all([
                besoins.lister({ metier, recherche, limite: 60 }),
                req.session?.userId ? besoins.mesBesoins(req.session.userId) : [],
            ]);

            res.render("academie-besoins", {
                ouverts,
                miens,
                // La même forme de groupes que la vitrine : deux vues qui
                // affichent la même liste de métiers doivent la recevoir
                // identique, sinon l'une des deux finit par se décaler.
                groupes: vitrine.metiersGroupes(),
                metier,
                recherche,
                taux,
                connecte: !!req.session?.loggedIn,
                message: String(req.query.m || "").slice(0, 200),
                erreur: String(req.query.e || "").slice(0, 200),
            });
        } catch (err) {
            console.error("❌ GET /academy/besoins :", err.message);
            res.status(500).send("Erreur de chargement.");
        }
    });

    // ── Publier ──────────────────────────────────────────────────────────
    router.post("/besoins", requireAuth, async (req, res) => {
        try {
            const besoin = await besoins.publier(req.session.userId, {
                titre: req.body.titre,
                description: req.body.description,
                metier: req.body.metier,
                budgetMin: req.body.budget_min,
                budgetMax: req.body.budget_max,
                devise: req.body.devise,
                workspaceId: req.session.workspaceId || null,
            });

            await journalService.log({
                action: "academie.besoin.publie",
                details: besoin.reference,
                userId: req.session.userId,
                workspaceId: req.session.workspaceId,
            }).catch(() => {});

            return res.redirect(`/academy/besoin/${besoin.reference}?m=${
                encodeURIComponent("Ton besoin est publié. Les développeurs peuvent y répondre.")}`);
        } catch (err) {
            // Le message d'erreur du service est écrit pour être lu par un
            // marchand : on le lui rend tel quel plutôt que de le remplacer
            // par un « formulaire invalide » qui n'apprend rien.
            return res.redirect(`/academy/besoins?e=${encodeURIComponent(err.message)}`);
        }
    });

    // ── Le détail ────────────────────────────────────────────────────────
    router.get("/besoin/:reference", async (req, res) => {
        try {
            const besoin = await besoins.parReference(String(req.params.reference || "").slice(0, 40));
            if (!besoin) return res.status(404).send("Besoin introuvable.");

            const moi = req.session?.userId ? String(req.session.userId) : null;
            const estAuteur = !!moi && String(besoin.auteur_id) === moi;

            const toutes = await besoins.listerReponses(besoin.id);
            // Le marchand voit tout ; un développeur ne voit que la sienne.
            // Le compte, lui, est dit à tout le monde (voir l'en-tête).
            const reponses = estAuteur ? toutes
                : toutes.filter((r) => moi && String(r.auteur_id) === moi);

            res.render("academie-besoin", {
                besoin,
                reponses,
                nombreReponses: toutes.length,
                estAuteur,
                aRepondu: !!moi && toutes.some((r) => String(r.auteur_id) === moi),
                metierLabel: besoin.metier ? metiers.label(besoin.metier) : "",
                connecte: !!req.session?.loggedIn,
                taux,
                message: String(req.query.m || "").slice(0, 200),
                erreur: String(req.query.e || "").slice(0, 200),
            });
        } catch (err) {
            console.error("❌ GET /academy/besoin :", err.message);
            res.status(500).send("Erreur de chargement.");
        }
    });

    // ── Répondre ─────────────────────────────────────────────────────────
    // Derrière la porte de l'Académie : le contrat se lit avant la première
    // proposition, jamais au moment d'encaisser.
    router.post("/besoin/:reference/repondre", exigerMembre, async (req, res) => {
        const reference = String(req.params.reference || "").slice(0, 40);
        try {
            const besoin = await besoins.parReference(reference);
            if (!besoin) return res.status(404).send("Besoin introuvable.");

            await besoins.repondre(req.session.userId, besoin.id, {
                message: req.body.message,
                prix: req.body.prix,
                delaiJours: req.body.delai_jours,
                devise: req.body.devise || besoin.devise,
            });

            await journalService.log({
                action: "academie.besoin.reponse",
                details: reference,
                userId: req.session.userId,
                workspaceId: req.session.workspaceId,
            }).catch(() => {});

            return res.redirect(`/academy/besoin/${reference}?m=${
                encodeURIComponent("Ta proposition est envoyée. Tu peux la modifier tant que le besoin est ouvert.")}`);
        } catch (err) {
            return res.redirect(`/academy/besoin/${reference}?e=${encodeURIComponent(err.message)}`);
        }
    });

    // ── Clore ────────────────────────────────────────────────────────────
    // Un besoin réglé qui reste ouvert fait travailler des développeurs pour
    // rien : c'est le genre de détail qui vide une place de marché en silence.
    router.post("/besoin/:reference/cloturer", requireAuth, async (req, res) => {
        const reference = String(req.params.reference || "").slice(0, 40);
        try {
            const besoin = await besoins.parReference(reference);
            if (!besoin) return res.status(404).send("Besoin introuvable.");

            const statut = req.body.statut === "attribue" ? "attribue" : "clos";
            await besoins.cloturer(req.session.userId, besoin.id, statut);

            return res.redirect(`/academy/besoin/${reference}?m=${encodeURIComponent(
                statut === "attribue" ? "Besoin marqué comme attribué." : "Besoin fermé.")}`);
        } catch (err) {
            return res.redirect(`/academy/besoin/${reference}?e=${encodeURIComponent(err.message)}`);
        }
    });

    return router;
};
