// ==========================================================================
// SAMII OS — LE CENTRE D'ACTIVITÉ
//
// « Demander un travail long à SAMII est un acte sans écho. La mission part,
// tourne, se reprend après une panne, se termine — et personne ne le voit
// jamais. »
//
// Cette route est une LECTURE, et rien d'autre. Aucun POST, aucune écriture,
// aucun journal créé : tout est déjà écrit ailleurs, par les moteurs et par
// `services/journalService.js`. Voir `services/activite.js` pour le détail
// des trois sources.
//
// ── L'IDENTITÉ VIENT DE LA SESSION, JAMAIS DU CORPS NI DE L'URL ──────────
//
// Règle 5 du projet, qui a coûté quatre pannes ici (discussions, actions du
// fil, publications, messages privés). Cette page ne lit AUCUN paramètre :
// ni `?workspace=`, ni `?user=`. Il n'y a rien à valider parce qu'il n'y a
// rien à accepter.
// ==========================================================================
const express = require("express");
const router = express.Router();
const activite = require("../services/activite");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/", requireAuth, async (req, res) => {
    // ── POURQUOI ON NE REDIRIGE PAS QUAND IL N'Y A PAS DE QG ─────────────
    //
    // Les autres pages du QG renvoient vers /hub quand la session n'en porte
    // pas. Ici ce serait faux : une mission longue appartient au COMPTE
    // (`user_id`), pas seulement à l'espace — `missionsLongues.lister()`
    // filtre sur les deux et sait travailler avec l'un des deux. Quelqu'un
    // sans QG peut donc avoir des missions à voir, et le renvoyer ailleurs
    // lui cacherait son propre travail.
    //
    // S'il n'a vraiment rien, la page le dit. C'est plus honnête qu'un
    // rebond vers une page qu'il n'a pas demandée.
    let donnees;
    try {
        donnees = await activite.pour({
            workspaceId: req.session.workspaceId || null,
            userId: req.session.userId || null,
        });
    } catch (err) {
        // `activite.pour` avale déjà ses propres pannes source par source.
        // Ce filet-ci couvre ce qui resterait — et il rend une page vide
        // plutôt qu'une erreur 500 : une page qui dit « rien pour l'instant »
        // se comprend, une page blanche ne se comprend pas.
        console.error("❌ /activite :", err.message);
        donnees = { enCours: [], termine: [], echec: [], recent: [], samii: [], vide: true };
    }

    res.render("activite", {
        ...donnees,
        aUnQG: !!req.session.workspaceId,
    });
});

module.exports = router;
