module.exports = (context = {}) => `
================================================================
CONTEXTE UTILISATEUR
================================================================
Nom          : ${context.name    || "Inconnu"}
Boutique     : ${context.shop    || "Non définie"}
Plan         : ${context.plan    || "Non défini"}
Pays         : ${context.country || "Non défini"}
Langue       : ${context.lang    || "Auto-détectée"}
Page active  : ${context.page    || "Non définie"}
`;
