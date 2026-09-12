// ==========================================================================
// SAMII OS — LES CRÉDITS DE CONVERSATION
// ==========================================================================
//
// La couche mince entre « parler à SAMII » et le registre comptable. Elle ne
// tient AUCUN compteur à elle : un solde est toujours une somme de mouvements
// dans portefeuille_mouvements, recalculée à la demande. Un second compteur
// aurait dérivé du registre au premier incident, et il aurait fallu choisir
// lequel croire.
//
// ── L'ORDRE DES CHOSES, ET IL COMPTE ──────────────────────────────────────
//
// On débite APRÈS avoir obtenu une réponse, jamais avant. Débiter d'abord
// paraît plus sûr comptablement et c'est un très mauvais marché : le jour où
// Gemini tombe, on facture des messages sans réponse, et la personne paie
// pour une panne qui est chez nous. Elle ne revient pas.
//
// L'inverse — répondre puis ne pas réussir à débiter — coûte un centime.
// C'est le bon sens du risque.
//
// ── LA GRATUITÉ D'ABORD ───────────────────────────────────────────────────
//
// Les crédits n'entrent en jeu QUE lorsque le quota gratuit est épuisé. Tant
// qu'il reste des messages gratuits, personne ne paie, et ce service n'est
// même pas appelé. C'est l'appelant qui décide, parce que lui seul connaît
// l'état du quota (services/samiiQuota.js pour les membres, le limiteur par
// IP pour les visiteurs).
const CREDITS = require("../config/credits");
const portefeuille = require("./portefeuille");
const devises = require("./devises");

// L'identifiant de compte dans le registre. Préfixé, pour la même raison que
// « anon: » dans samii_conversations : un identifiant d'utilisateur ne doit
// jamais pouvoir se confondre avec un compte de la place de marché, qui vit
// dans la même table.
function compteDe(userId) {
    return userId ? `u:${userId}` : null;
}

// Ce qu'il reste, en dollars ET en messages. Les deux, parce que personne ne
// pense en dollars quand il s'agit de parler : « il me reste 143 messages »
// se comprend tout de suite, « il me reste 1,43 $ » demande une division.
async function etat(userId) {
    const compte = compteDe(userId);
    if (!compte) return { credite: false, soldeUSD: 0, messages: 0 };
    const soldeUSD = await portefeuille.soldeDisponible(compte, CREDITS.DEVISE_COMPTE);
    return {
        credite: soldeUSD > 0,
        soldeUSD,
        messages: CREDITS.messagesPour(soldeUSD),
    };
}

// Le même solde, exprimé dans la monnaie de quelqu'un. Sert à l'affichage
// seulement — la comptabilité reste en dollars, sinon chaque variation du
// taux réécrirait la valeur des soldes déjà achetés.
async function etatAffiche(userId, devise) {
    const e = await etat(userId);
    const cible = devises.normaliser ? devises.normaliser(devise) : devise;
    const converti = devises.convertir(e.soldeUSD, CREDITS.DEVISE_COMPTE, cible || "USD");
    return { ...e, affiche: converti.ok ? converti : null };
}

// Y a-t-il de quoi payer UN message ? Ne bloque rien : c'est une question,
// pas une réservation. La vraie autorisation a lieu dans la transaction qui
// débite, sinon deux messages simultanés passeraient tous les deux.
async function peutPayer(userId) {
    const e = await etat(userId);
    return e.soldeUSD >= CREDITS.PRIX_MESSAGE_USD;
}

// Débite un message. Renvoie toujours un objet, ne lève jamais : l'appelant
// vient de rendre un service et ne doit pas perdre sa réponse parce que la
// comptabilité a hoqueté.
//
// `ref` rend l'opération rejouable sans risque — deux envois du même message
// ne le facturent qu'une fois.
async function debiterMessage(userId, { ref = null, motif = "message SAMII" } = {}) {
    const compte = compteDe(userId);
    if (!compte) return { ok: false, raison: "aucun compte" };
    try {
        const r = await portefeuille.consommer({
            compte,
            montant: CREDITS.PRIX_MESSAGE_USD,
            devise: CREDITS.DEVISE_COMPTE,
            motif,
            transactionRef: ref,
        });
        if (r.dejaCompte) return { ok: true, dejaCompte: true };
        return { ok: true, solde: r.solde, messages: CREDITS.messagesPour(r.solde) };
    } catch (err) {
        // SOLDE_INSUFFISANT est un cas normal, pas une panne : la personne a
        // simplement épuisé sa recharge. On le distingue pour que la page
        // propose de recharger au lieu d'afficher une erreur.
        const insuffisant = /solde|insuffis/i.test(err.message || "");
        if (!insuffisant) console.error("❌ creditsSamii.debiterMessage :", err.message);
        return { ok: false, raison: insuffisant ? "solde épuisé" : err.message };
    }
}

// Crédite une recharge payée. Appelé UNIQUEMENT depuis la confirmation d'un
// paiement réellement encaissé — jamais depuis une page, jamais sur la foi
// de ce qu'un navigateur raconte.
async function crediter(userId, montantUSD, { rail = "chargily", detail = "" } = {}) {
    const compte = compteDe(userId);
    if (!compte) throw new Error("Compte manquant.");
    const n = Number(montantUSD);
    if (!(n > 0)) throw new Error("Montant invalide.");
    const r = await portefeuille.deposer({
        compte, montant: n, devise: CREDITS.DEVISE_COMPTE, rail, detail,
    });
    return { ok: true, solde: r.solde, messages: CREDITS.messagesPour(r.solde) };
}

module.exports = { compteDe, etat, etatAffiche, peutPayer, debiterMessage, crediter };
