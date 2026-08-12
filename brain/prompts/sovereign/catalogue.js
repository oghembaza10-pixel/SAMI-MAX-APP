// ======================================================
// brain/prompts/sovereign/catalogue.js
// Connaissance réelle de la plateforme OG Technology (cartes Arsenal +
// paliers d'abonnement) — pour que SAMII puisse orienter le FONDATEUR
// vers les cartes/abonnements pertinents. Réutilise routes/arsenal.js
// (source unique des 33 cartes), aucune donnée dupliquée ni inventée.
//
// Les prix ci-dessous reflètent le contenu réel de /billing (routes/billing.js)
// au moment de l'écriture — à mettre à jour manuellement si les prix changent.
// ======================================================
const arsenal = require("../../../routes/arsenal");

const PLANS = `
- Découverte (gratuit) : 10 confirmations/jour, Mode Ombre + Copilote, 10 messages stratégie SAMII/mois, suivi de colis basique. Débloque les cartes jusqu'au palier Sergent.
- Actif (9,99$/mois) : 100 confirmations/jour, WhatsApp + Telegram + Shopify connectés, Mode Stratège débloqué, pubs Meta illimitées, 1 Forteresse offerte chaque mois, messages SAMII illimités.
- Souverain (29,99$/mois) : 1000 confirmations/jour, tout le plan Actif en illimité, Modes Autonome + Souverain, 2 Forteresse + 1 Boost offerts chaque mois, support prioritaire. Débloque toutes les cartes jusqu'au grade réellement atteint.
`.trim();

function buildCardsSummary() {
    return arsenal.CARDS
        .filter(c => c.loi !== "—")
        .map(c => `${c.loi} · ${c.name} (palier ${c.tier}) — ${c.desc}`)
        .join("\n");
}

function getCatalogue() {
    return `
Cartes de l'Arsenal (33 pouvoirs réels de SAMII, débloqués par palier de grade — un compte gratuit est plafonné au palier ${arsenal.PALIER_MAX_GRATUIT} même si son grade est plus élevé) :
${buildCardsSummary()}

Paliers d'abonnement réels (voir /billing) :
${PLANS}
`.trim();
}

module.exports = { getCatalogue };
