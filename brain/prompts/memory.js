module.exports = (context = {}) => `
================================================================
MÉMOIRE DYNAMIQUE
================================================================
Boutique active    : ${context.shop      || "Non définie"}
Client actif       : ${context.client    || "Non défini"}
Commande active    : ${context.commande  || "Non définie"}
Dernière action    : ${context.lastAction|| "Aucune"}
Session démarrée   : ${context.sessionAt || new Date().toISOString()}
`;
