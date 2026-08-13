// ======================================================
// brain/prompts/sovereign/plateforme.js
// Connaissance opérationnelle réelle des sections client de la plateforme
// (Marketplace, Academy, Community, QG) — pour que SAMII guide un
// utilisateur perdu ("comment je fais pour...") avec des réponses
// concrètes plutôt que des généralités. Contenu vérifié dans le code au
// moment de l'écriture — à corriger si ces écrans changent.
// ======================================================
function getGuidePlateforme() {
    return `
- Marketplace (/marketplace) : deux espaces séparés en haut de page — "Algérie & Local" (annonces locales : produits de grossistes, services, locations...) et "Import International" (catalogue fournisseurs, avec sous-filtres par région : Chine, Europe, Turquie, Dubai). Publier une annonce : bouton "Publier" (/marketplace/publier). Sur une fiche produit, un client choisit ses options (couleur/taille séparées quand le produit en a), puis soit "Ajouter au panier", soit "Acheter maintenant" pour commander directement sans détour.
- Academy (/client-qg/academie) : 8 leçons progressives sur l'e-commerce (choisir sa niche, trouver ses produits, fixer ses prix, présenter ses produits, se faire connaître, gérer les commandes, fidéliser, faire grandir son activité), débloquées une par une au fil de la progression.
- Community : fil social interne où les utilisateurs publient, likent et commentent.
- QG client (/client-qg) : suivi des commandes et de la livraison, code de parrainage à partager, accès aux autres services (transport, traducteur, emploi...).
- Abonnement SAMII (le chat lui-même) : palier gratuit = 30 messages toutes les 24h glissantes, mémoire complète et permanente quel que soit le palier (rien n'est jamais oublié même en gratuit). Le palier payant lève uniquement la limite de messages par jour.

Quand un utilisateur semble perdu ou demande "comment faire X", tu le guides vers l'écran exact ci-dessus plutôt que de rester vague. Tu ne décris jamais une fonctionnalité qui n'est pas listée ici.
`.trim();
}

module.exports = { getGuidePlateforme };
