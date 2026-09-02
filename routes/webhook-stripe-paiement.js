// ==========================================================================
// SAMII OS — STRIPE CONFIRME UN PAIEMENT
//
// POURQUOI CE FICHIER EXISTE. Le grand livre savait créer un paiement et
// savait le confirmer — mais personne n'appelait jamais `confirmer()`.
// Concrètement : Stripe encaissait l'argent du client, et chez nous la ligne
// restait « en attente » pour toujours. Rien n'était livré, aucune
// commission n'était enregistrée, et la partenaire n'aurait vu aucune vente.
//
// Un moyen de paiement qui prend l'argent sans rien confirmer est pire qu'un
// moyen de paiement absent : le client a payé et croit avoir acheté.
//
// ─────────────────────────────────────────────────────────────────────────
// LA SIGNATURE N'EST PAS UNE FORMALITÉ
//
// Cette adresse est publique. Sans vérification, n'importe qui peut l'appeler
// et prétendre qu'un paiement de 500 000 est passé — et repartir avec le
// produit. La signature est ce qui distingue « Stripe nous parle » de
// « quelqu'un prétend être Stripe ».
//
// Elle exige le corps BRUT, octet pour octet : `express.raw` est monté sur
// /webhook dans index.js, avant tout analyseur JSON. Un corps ré-encodé, même
// identique à la lecture, ne produit plus la même empreinte.
//
// Sans STRIPE_WEBHOOK_SECRET, on REFUSE. Accepter « juste en attendant » est
// exactement la porte qu'on ne referme jamais.
//
// ─────────────────────────────────────────────────────────────────────────
// REJOUER SANS DANGER
//
// Stripe réémet ses notifications — sur un délai, une erreur réseau, ou
// simplement parce qu'il n'a pas vu notre 200. `confirmer()` ne bascule la
// ligne que si elle est encore « en attente » et renvoie null sinon : le
// deuxième passage ne livre pas une deuxième fois.
// ==========================================================================
const express = require("express");
const router = express.Router();
const paiements = require("../services/paiements");

router.post("/", async (req, res) => {
    // ── DEUX ADRESSES, DEUX SECRETS ──────────────────────────────────────────
    //
    // SAMII expose DEUX webhooks Stripe, montés à des adresses différentes :
    //
    //     /billing/webhook           les abonnements
    //     /webhook/stripe-paiement   les achats à l'unité (cartes, produits)
    //
    // Chez Stripe, chaque adresse est un « endpoint » distinct avec son PROPRE
    // secret de signature. Les deux routes lisaient pourtant la même variable
    // `STRIPE_WEBHOOK_SECRET` : une seule valeur pouvait y tenir, donc l'une des
    // deux aurait rejeté chaque notification avec « signature invalide ».
    //
    // Et cet échec est le pire qui soit : le client PAIE VRAIMENT, Stripe
    // encaisse, et SAMII ne débloque rien. Silencieux des deux côtés.
    //
    // Chaque route lit donc désormais SA variable, avec repli sur la variable
    // commune — pour qu'une installation qui n'a qu'un seul webhook branché
    // continue de marcher sans rien changer.
    const secret = process.env.STRIPE_WEBHOOK_SECRET_PAIEMENT
                || process.env.STRIPE_WEBHOOK_SECRET;
    const cle = process.env.STRIPE_SECRET_KEY;

    if (!secret || !cle) {
        // On le dit fort : cette absence est silencieuse autrement, et c'est
        // alors chaque paiement qui reste en attente sans que personne sache
        // pourquoi.
        console.error("❌ Stripe : STRIPE_WEBHOOK_SECRET ou STRIPE_SECRET_KEY manquante — aucun paiement ne peut être confirmé.");
        return res.status(500).json({ recu: false, raison: "webhook non configuré" });
    }

    let evenement;
    try {
        const stripe = require("stripe")(cle);
        evenement = stripe.webhooks.constructEvent(
            req.body,                              // le corps BRUT, voir l'en-tête
            req.headers["stripe-signature"],
            secret,
        );
    } catch (err) {
        // 400 volontaire : Stripe doit savoir qu'on a rejeté, et un appelant
        // qui n'est pas Stripe doit repartir sans rien.
        console.warn("⚠️ Stripe : signature refusée —", err.message);
        return res.status(400).json({ recu: false, raison: "signature invalide" });
    }

    try {
        if (evenement.type === "checkout.session.completed") {
            const s = evenement.data.object;
            // C'est NOTRE référence, posée à la création du paiement. Sans
            // elle on ne saurait pas quelle ligne confirmer.
            const ref = s.client_reference_id || s.metadata?.reference;
            if (!ref) {
                console.warn("⚠️ Stripe : paiement confirmé sans notre référence —", s.id);
                return res.status(200).json({ recu: true });
            }

            const ligne = await paiements.confirmer(ref, {
                fournisseur: "stripe",
                session: s.id,
                paiement: s.payment_intent || null,
                montant_encaisse: s.amount_total != null ? s.amount_total / 100 : null,
                devise_encaissee: (s.currency || "").toUpperCase(),
                email: s.customer_details?.email || null,
            });

            if (ligne) {
                console.log(`💳 Paiement confirmé — ${ref} · ${ligne.montant} ${ligne.devise} · communauté ${ligne.communaute}`);
            } else {
                // Ni une erreur ni un incident : Stripe a simplement réémis.
                console.log(`💳 Stripe a réémis ${ref} — déjà confirmé, rien à refaire.`);
            }
        }
    } catch (err) {
        // On note, et on répond 200 quand même. Un 500 ferait réessayer
        // Stripe pendant des heures pour un problème qui est chez nous, et
        // la ligne reste « en attente » — donc rattrapable à la main.
        console.error("❌ Stripe : confirmation non enregistrée —", err.message);
    }

    res.status(200).json({ recu: true });
});

module.exports = router;
