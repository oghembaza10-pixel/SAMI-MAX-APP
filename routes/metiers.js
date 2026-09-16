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
        // Le hub n'en avait pas, alors que ses trente-quatre fiches en ont
        // une. Mesuré : /metiers, /metiers?lang=en et /metiers?lang=ar
        // répondaient 200 avec le même contenu et aucune canonique — trois
        // adresses indexables pour une seule page, et c'est celle qui porte
        // la priorité la plus haute du plan du site après l'accueil.
        canonique: `${BASE}/metiers`,
    });
});

// ── LE TITRE, LE H1, ET POURQUOI CE SONT DEUX CHOSES ─────────────────────
//
// Ils étaient la même chaîne, servie aux deux endroits. Deux conséquences
// mesurées sur les trente-quatre fiches :
//
//   1. Le <h1> affiché se terminait par « — SAMII ». C'est un suffixe de
//      balise title ; dans un titre de page, ça se lit comme une coquille.
//   2. Trente titres sur trente-quatre dépassaient 60 caractères (médiane
//      67, maximum 83) : Google les coupait dans ses résultats.
//
// Les deux ne servent pas la même personne. Le <title> s'adresse à quelqu'un
// qui lit une liste de résultats et doit choisir en une seconde : il doit
// tenir. Le <h1> s'adresse à quelqu'un qui vient d'arriver sur la page : il
// peut respirer.
//
// Aucune phrase de métier n'est touchée ici — perte, défaut et réponse
// restent mot pour mot ce que services/metiers.js déclare. Ce qui change est
// la formule de l'enrobage, et elle vit déjà dans ce fichier.
const PROMESSE_LONGUE = {
    rdv: "remplir son agenda sans décrocher le téléphone",
    produit: "vendre en ligne sans perdre ses colis",
};
const PROMESSE_COURTE = {
    rdv: "agenda rempli sans téléphone",
    produit: "vendre sans perdre ses colis",
};
// Trois libellés sont trop longs pour la formule courte — « Électronique /
// Téléphonie » (25 caractères), « Laboratoire d'analyses » et « Hôtel /
// Maison d'hôtes » (22). Plutôt que de raboter le libellé du métier, qui est
// son nom, on raccourcit la promesse pour eux seuls.
const PROMESSE_BREVE = {
    rdv: "agenda en ligne",
    produit: "vendre en ligne",
};
const LIMITE_TITRE = 60;

function titreEtH1(fiche, L) {
    const label = L(fiche.label);
    const parcours = fiche.parcours === "rdv" ? "rdv" : "produit";
    const court = `${label} : ${L(PROMESSE_COURTE[parcours])} — SAMII`;
    return {
        titre: court.length <= LIMITE_TITRE
            ? court
            : `${label} : ${L(PROMESSE_BREVE[parcours])} — SAMII`,
        // Le H1 garde la phrase complète, et perd « — SAMII ».
        h1: `${label} : ${L(PROMESSE_LONGUE[parcours])}`,
    };
}

// ── LA META DESCRIPTION, TAILLÉE POUR CE QUE GOOGLE AFFICHE ──────────────
//
// Elle était `perte + reponse` coupée à 300 caractères — huit fiches sur
// trente-quatre dépassaient 155, jusqu'à 204. Au-delà, Google coupe et
// choisit lui-même la fin, souvent au milieu d'un mot.
//
// On garde la même matière, dans le même ordre. « perte » passe toujours en
// entier : c'est la phrase qui fait se reconnaître le lecteur. « reponse »
// suit tant qu'elle tient ; sinon elle s'arrête au dernier mot complet.
// Rien n'est réécrit, rien n'est inventé.
const LIMITE_DESCRIPTION = 155;

function descriptionDe(fiche) {
    const complet = `${fiche.perte} ${fiche.reponse}`;
    if (complet.length <= LIMITE_DESCRIPTION) return complet;
    // −1 pour l'espace qui suit `perte`, −1 pour le caractère de suite.
    const place = LIMITE_DESCRIPTION - fiche.perte.length - 2;
    const bout = fiche.reponse.slice(0, place);
    const coupe = bout.lastIndexOf(" ");
    return `${fiche.perte} ${coupe > 0 ? bout.slice(0, coupe) : bout}…`;
}

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
    const { titre, h1 } = titreEtH1(fiche, L);

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
        h1,
        description: descriptionDe(fiche),
        canonique: `${BASE}/metiers/${fiche.id}`,
        base: BASE,
        loggedIn: !!req.session?.loggedIn,
    });
});

module.exports = router;
