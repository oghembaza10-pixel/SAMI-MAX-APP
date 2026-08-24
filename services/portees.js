// ==========================================================================
// SAMII OS — PORTÉES D'ACCÈS (Policy Engine)
//
// Jusqu'ici une clé pouvait tout faire dans son espace : lire les clients,
// créer des commandes, tout. Acceptable quand le marchand fabrique la clé
// pour lui-même ; intenable dès qu'il la confie à une agence, et impossible
// le jour où un développeur inconnu publie un agent sur la plateforme.
//
// Une portée est une permission nommée, lisible par un non-technicien —
// c'est le marchand qui coche, pas un développeur. La règle est donc
// volontairement grossière : quatre domaines, deux niveaux (lire / écrire).
// Un découpage plus fin ne serait pas mieux : il serait juste incochable.
//
// COMPATIBILITÉ : une clé sans portées enregistrées (toutes celles créées
// avant ce mécanisme) garde l'accès complet. Ne jamais inverser ce défaut —
// une clé en production qui perd ses droits du jour au lendemain, c'est le
// flux d'un partenaire qui s'arrête sans prévenir.
// ==========================================================================

const PORTEES = [
    { id: "commandes:lire",    domaine: "Commandes",    niveau: "lire",   label: "Lire les commandes" },
    { id: "commandes:ecrire",  domaine: "Commandes",    niveau: "ecrire", label: "Créer et modifier des commandes" },
    { id: "rendezvous:lire",   domaine: "Rendez-vous",  niveau: "lire",   label: "Lire les rendez-vous" },
    { id: "rendezvous:ecrire", domaine: "Rendez-vous",  niveau: "ecrire", label: "Créer et modifier des rendez-vous" },
    { id: "clients:lire",      domaine: "Clients",      niveau: "lire",   label: "Lire la liste des clients" },
    { id: "espaces:lire",      domaine: "Espace",       niveau: "lire",   label: "Voir l'identité de l'espace" },
];

const IDS = PORTEES.map(p => p.id);
const PAR_ID = new Map(PORTEES.map(p => [p.id, p]));

/** Ne garde que des portées existantes — jamais ce qui arrive du navigateur. */
function nettoyer(liste) {
    if (!Array.isArray(liste)) return [];
    return [...new Set(liste.map(String).filter(id => PAR_ID.has(id)))];
}

/**
 * La clé a-t-elle le droit demandé ?
 *
 * `accordees` vide ou absent = clé d'avant les portées : accès complet.
 * C'est le seul cas où l'absence vaut autorisation, et il est volontaire.
 */
function autorise(accordees, requise) {
    if (!requise) return true;
    if (!Array.isArray(accordees) || accordees.length === 0) return true;
    return accordees.includes(requise);
}

/** Regroupe pour l'affichage : le marchand raisonne par domaine, pas par identifiant. */
function parDomaine() {
    const groupes = [];
    for (const p of PORTEES) {
        let g = groupes.find(x => x.domaine === p.domaine);
        if (!g) { g = { domaine: p.domaine, portees: [] }; groupes.push(g); }
        g.portees.push(p);
    }
    return groupes;
}

function label(id) {
    return PAR_ID.get(id)?.label || id;
}

module.exports = { PORTEES, IDS, nettoyer, autorise, parDomaine, label };
