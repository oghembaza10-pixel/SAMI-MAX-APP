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
const db = require("./db");

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
    return debiterTour(userId, { actes: [], ref, motif });
}

// ── LE TOUR COMPLET : LE MESSAGE ET CE QUE SAMII A FAIT ──────────────────
//
// Le solde ne paie pas que des phrases. Il paie une commande confirmée, un
// rendez-vous posé, une facture partie — c'est là qu'est la valeur pour un
// marchand. Un tour où SAMII enregistre une commande coûte donc plus qu'un
// tour où il dit bonjour, et c'est la seule façon que ce soit juste dans les
// deux sens.
//
// UN SEUL MOUVEMENT POUR TOUT LE TOUR. On additionne d'abord, on écrit
// ensuite. Débiter le message puis chaque acte séparément ouvrirait une
// fenêtre où le message est payé et l'acte non — et il faudrait alors
// décider quoi rembourser. Une somme, une écriture, une référence.
//
// `avecMessage` à false sur les canaux clients (Telegram, WhatsApp) : le
// marchand y paie ce que SAMII FAIT pour lui, pas chaque phrase que ses
// clients échangent. Sinon une boutique qui marche bien serait punie par le
// volume de sa propre clientèle.
async function debiterTour(userId, { actes = [], ref = null, motif = "", avecMessage = true } = {}) {
    const compte = compteDe(userId);
    if (!compte) return { ok: false, raison: "aucun compte" };

    const facture = CREDITS.factureDuTour(actes, { avecMessage });
    // Rien à facturer : un tour sans message facturable et sans acte payant.
    // Ce n'est pas un échec, c'est simplement gratuit.
    if (facture.montant <= 0) return { ok: true, gratuit: true, montant: 0, lignes: [] };

    // Le motif dit CE QUI a été payé, pas seulement combien. C'est ce qu'on
    // relira le jour où quelqu'un demandera pourquoi son solde a baissé de
    // 6 centimes d'un coup.
    const detaille = facture.lignes
        .map((l) => l.libelle || l.quoi)
        .join(" + ");

    try {
        const r = await portefeuille.consommer({
            compte,
            montant: facture.montant,
            devise: CREDITS.DEVISE_COMPTE,
            motif: motif ? `${motif} — ${detaille}` : detaille,
            transactionRef: ref,
        });
        if (r.dejaCompte) return { ok: true, dejaCompte: true, montant: facture.montant, lignes: facture.lignes };
        return {
            ok: true,
            montant: facture.montant,
            lignes: facture.lignes,
            solde: r.solde,
            messages: CREDITS.messagesPour(r.solde),
        };
    } catch (err) {
        // SOLDE_INSUFFISANT est un cas normal, pas une panne : la personne a
        // simplement épuisé sa recharge. On le distingue pour que la page
        // propose de recharger au lieu d'afficher une erreur.
        const insuffisant = /solde|insuffis/i.test(err.message || "");
        if (!insuffisant) console.error("❌ creditsSamii.debiterTour :", err.message);
        return { ok: false, raison: insuffisant ? "solde épuisé" : err.message, montant: facture.montant };
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

// ── QUI PAIE POUR UN QG ──────────────────────────────────────────────────
//
// Sur Telegram, WhatsApp ou Messenger, c'est le CLIENT du marchand qui parle
// à SAMII. Ce client n'a pas de compte chez nous et n'a rien à payer : c'est
// le marchand qui reçoit la commande, donc c'est lui qui règle l'acte.
//
// Le registre indexe les soldes par utilisateur, et un QG ne connaît que
// l'e-mail de son propriétaire. La jointure est donc obligatoire — et elle
// est faite ICI, une seule fois, pour qu'aucun canal ne la réinvente à sa
// façon.
async function proprietaireDuWorkspace(workspaceId) {
    if (!workspaceId) return null;
    try {
        const rows = await db.query(
            `SELECT u.id
               FROM workspaces w
               JOIN utilisateurs u ON u.email = w.owner_email
              WHERE w.id = $1
              LIMIT 1`,
            [String(workspaceId)],
        );
        return rows[0]?.id || null;
    } catch (err) {
        console.error("❌ creditsSamii.proprietaireDuWorkspace :", err.message);
        return null;
    }
}

// ── FACTURER LES ACTES D'UN CANAL CLIENT ─────────────────────────────────
//
// ON NE BLOQUE JAMAIS LA CONVERSATION D'UN CLIENT. L'acte est déjà accompli
// quand on arrive ici : la commande est enregistrée, le rendez-vous est
// posé. Si le marchand n'a plus de solde, on ne défait rien et on ne coupe
// personne — un client laissé sans réponse parce que son marchand est à sec,
// c'est une vente perdue pour lui et un service qui a l'air cassé pour tout
// le monde.
//
// On note simplement que l'acte n'a pas pu être payé. Une perte visible vaut
// mieux qu'un client perdu.
// Prélever une somme précise sur le solde d'un QG, pour un acte dont le prix
// est fixé ailleurs — aujourd'hui la confirmation de commande, dont le tarif
// vit dans services/confirmationsQuota.js depuis bien avant la recharge.
//
// On ne recopie surtout pas ce prix ici : deux copies d'un prix finissent
// toujours par diverger, et c'est l'utilisateur qui découvre laquelle
// s'applique. L'appelant apporte son montant.
async function debiterMontantWorkspace(workspaceId, montantUSD, { ref = null, motif = "" } = {}) {
    const n = Number(montantUSD);
    if (!(n > 0)) return { ok: false, raison: "montant invalide" };

    const userId = await proprietaireDuWorkspace(workspaceId);
    if (!userId) return { ok: false, raison: "propriétaire introuvable" };

    const compte = compteDe(userId);
    try {
        const r = await portefeuille.consommer({
            compte, montant: n, devise: CREDITS.DEVISE_COMPTE,
            motif, transactionRef: ref,
        });
        if (r.dejaCompte) return { ok: true, dejaCompte: true };
        return { ok: true, solde: r.solde, messages: CREDITS.messagesPour(r.solde) };
    } catch (err) {
        // Solde vide : ce n'est pas une panne. L'appelant reprend son filet
        // habituel (l'ardoise) — et surtout, il ne bloque rien.
        const insuffisant = /solde|insuffis/i.test(err.message || "");
        if (!insuffisant) console.error("❌ creditsSamii.debiterMontantWorkspace :", err.message);
        return { ok: false, raison: insuffisant ? "solde épuisé" : err.message };
    }
}

async function facturerActesWorkspace(workspaceId, actes, { ref = null, motif = "" } = {}) {
    if (!Array.isArray(actes) || !actes.length) return { ok: true, gratuit: true };
    const facture = CREDITS.factureDuTour(actes, { avecMessage: false });
    if (facture.montant <= 0) return { ok: true, gratuit: true };

    const userId = await proprietaireDuWorkspace(workspaceId);
    if (!userId) return { ok: false, raison: "propriétaire introuvable", montant: facture.montant };

    const r = await debiterTour(userId, { actes, ref, motif, avecMessage: false });
    if (!r.ok) {
        console.warn(
            `⚠️ Acte non facturé (${facture.montant} $) pour le QG ${workspaceId} : ${r.raison}. ` +
            "L'acte reste accompli — on ne coupe pas la conversation d'un client.",
        );
    }
    return r;
}

module.exports = {
    compteDe, etat, etatAffiche, peutPayer,
    debiterMessage, debiterTour, crediter,
    proprietaireDuWorkspace, facturerActesWorkspace, debiterMontantWorkspace,
};
