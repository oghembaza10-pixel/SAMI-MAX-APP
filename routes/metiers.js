// ==========================================================================
// SAMII OS — LES MÉTIERS : LA PORTE D'ENTRÉE GOOGLE
// ==========================================================================
//
// LE PROBLÈME QUE CES PAGES RÉSOLVENT.
//
// « / » est devenu le chat. C'est ce qu'il fallait pour convertir, mais un
// champ de saisie ne se classe sur aucune recherche : il n'y a rien à
// indexer. Le chat convertit les gens qui arrivent ; il ne les fait pas
// arriver. Ces pages-ci sont l'autre moitié — elles portent le texte que
// Google lit, et chacune repart vers SAMII.
//
// POURQUOI PAS DANS LE HUB.
//
// Le Hub (routes/hub.js) regroupe bien des métiers, et c'était le premier
// endroit à regarder. Mais il est en requireAuth et renvoie les comptes
// client ailleurs : Googlebot n'a pas de session, il ne le verra jamais. Son
// propre en-tête le dit — « Le Hub sélectionne le Workspace. Il ne contient
// aucune logique métier. » Le Hub choisit un espace de travail existant ;
// ces pages s'adressent à quelqu'un qui n'a encore rien.
//
// CE QUI N'EST PAS DUPLIQUÉ.
//
// Tout vient de services/metiers.js, la source unique déjà consommée par
// l'onboarding, l'agence et l'API. Aucune liste n'est recopiée, aucune
// seconde vérité n'est créée. Et la sortie « ouvrir mon QG » pointe sur
// /workspace/create?metier=<id>, la route de création qui existait déjà et
// qui sait pré-remplir le métier : rien de neuf n'a été inventé pour ça.
// ==========================================================================
const express = require("express");
const router = express.Router();
const metiers = require("../services/metiers");
const CONFIG = require("../config");

// L'adresse canonique vient d'APP_URL, la même que celle utilisée par les
// redirections OAuth. Une URL canonique doit être STABLE : la déduire de
// l'en-tête Host ferait qu'un même contenu s'annonce sous deux adresses
// (domaine et adresse Render brute), et Google les traiterait comme deux
// pages en concurrence.
const BASE = String(CONFIG.APP_URL || "").replace(/\/+$/, "");

// ── LE HUB PUBLIC ────────────────────────────────────────────────────────
router.get("/", (req, res) => {
    res.render("metiers", {
        loggedIn: !!req.session?.loggedIn,
        typeCompte: req.session?.typeCompte || "client",
        groupes: metiers.parGroupe(),
        base: BASE,
    });
});

// ── LA PAGE D'UN MÉTIER ──────────────────────────────────────────────────
router.get("/:id", (req, res, next) => {
    const fiche = metiers.fiche(String(req.params.id || "").toLowerCase());

    // 404 FRANC POUR UN MÉTIER INCONNU.
    //
    // La tentation est de rediriger vers le hub : le visiteur atterrit
    // quelque part, personne ne voit d'erreur. Mais Google, lui, enregistre
    // qu'une adresse inventée répond 200 — et se met à indexer n'importe
    // quelle URL sous /metiers/. On passe donc la main au gestionnaire 404
    // de l'application, qui répond ce qui est vrai.
    if (!fiche) return next();

    const L = res.locals.L || ((s) => s);
    const titre = fiche.parcours === "rdv"
        ? `${L(fiche.label)} : ${L("remplir son agenda sans décrocher le téléphone")} — SAMII`
        : `${L(fiche.label)} : ${L("vendre en ligne sans perdre ses colis")} — SAMII`;

    // Les voisins du même groupe : ils donnent à Google un maillage interne
    // réel (une page isolée se classe mal) et au visiteur un moyen de
    // corriger si sa page n'est pas tout à fait la sienne.
    const voisins = metiers.avecFiche()
        .filter((m) => m.groupe === fiche.groupe && m.id !== fiche.id)
        .slice(0, 8);

    res.render("metier", {
        metier: fiche,
        voisins,
        titre,
        description: `${fiche.perte} ${fiche.reponse}`.slice(0, 300),
        canonique: `${BASE}/metiers/${fiche.id}`,
        base: BASE,
        loggedIn: !!req.session?.loggedIn,
    });
});

module.exports = router;
