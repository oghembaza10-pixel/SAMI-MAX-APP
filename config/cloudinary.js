// ==========================================================================
// SAMII OS — CLOUDINARY, LES DEUX VALEURS PUBLIQUES
// ==========================================================================
//
// POURQUOI CE FICHIER EXISTE.
//
// Le nom du nuage et le préréglage d'envoi étaient recopiés à l'identique
// dans routes/verification.js, routes/marketplace.js et
// public/js/samii-page.js. Trois copies, et une quatrième allait naître avec
// le chat de la page d'accueil. Le jour où le préréglage change — parce qu'on
// resserre les formats acceptés, ou qu'on change de compte — il faudrait s'en
// souvenir à quatre endroits, et l'oubli ne se verrait qu'au premier envoi
// raté d'un utilisateur.
//
// CES DEUX VALEURS NE SONT PAS DES SECRETS. Un préréglage « non signé » est
// fait pour voyager dans le navigateur : n'importe qui peut le lire dans le
// code de la page. Ce qui reste secret, c'est l'API secret de Cloudinary, qui
// ne figure NULLE PART côté client et n'a rien à faire ici.
//
// Les variables d'environnement passent devant : un déploiement peut pointer
// vers un autre compte sans toucher au code.
module.exports = {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "ojwx5hft",
    UPLOAD_PRESET: process.env.CLOUDINARY_UPLOAD_PRESET || "MARKETPLACE OG",
};
