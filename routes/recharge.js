// ==========================================================================
// SAMII OS — RECHARGER SAMII
// ==========================================================================
//
// Le geste que tout le monde connaît déjà ici : on charge, on dépense, et ce
// qui reste reste. Pas d'abonnement à résilier, pas de solde qui s'efface en
// fin de mois.
//
// ── CE QUI SE PASSE, DANS L'ORDRE ─────────────────────────────────────────
//
//   1. La personne choisit un montant EN DOLLARS (l'unité de compte).
//   2. On le convertit dans sa monnaie au taux du moment — marché PARALLÈLE
//      pour le dinar, faute de quoi on vendrait à perte à chaque recharge.
//   3. Chargily encaisse dans sa monnaie.
//   4. Le webhook confirme, ET SEULEMENT LÀ le solde est crédité.
//
// LE POINT 4 N'EST PAS NÉGOCIABLE. Aucune page, aucun retour de navigateur,
// aucun paramètre d'URL ne crédite quoi que ce soit : tout ça se fabrique
// depuis la barre d'adresse. Seul un paiement relu chez Chargily crédite.
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");
const CONFIG = require("../config");
const CREDITS = require("../config/credits");
const chargily = require("../services/chargily");
const devises = require("../services/devises");
const creditsSamii = require("../services/creditsSamii");

function exigeConnexion(req, res, next) {
    if (!req.session?.loggedIn || !req.session?.userId) {
        // On garde où la personne allait : elle revient ici après s'être
        // identifiée, au lieu d'être déposée sur une page qu'elle n'a pas
        // demandée et de devoir tout recommencer.
        return res.redirect("/login?suite=" + encodeURIComponent("/recharge"));
    }
    next();
}

// La monnaie dans laquelle on encaisse. Chargily encaisse en dinars ; pour
// tout le reste on affiche la monnaie du pays et on encaisse en dinars aussi,
// parce que c'est ce que l'opérateur sait faire. Le jour où un autre rail
// s'ouvre (mobile money en XOF), cette fonction sera le seul endroit à
// changer.
function monnaieDePaiement() {
    return "DZD";
}

// ── LA PAGE ──────────────────────────────────────────────────────────────
// Le pays de la personne, lu LÀ OÙ IL EST. Première version : je lisais
// `req.session.pays`. Mesuré sur l'application qui tourne — cette clé n'est
// écrite NULLE PART dans le code. Elle valait donc toujours undefined, la
// devise retombait sur « USD » pour tout le monde, et la conversion en
// monnaie locale que je venais d'écrire était du code mort : un marchand
// malien voyait son prix en dinars algériens avec, en dessous, « ≈ 2 USD ».
//
// C'est exactement l'erreur facturée à Bourama Traoré, à Ségou (voir
// routes/marketplace.js) : 200 dinars ALGÉRIENS pour un Malien. La leçon
// tient en une ligne — le pays se lit en base, pas dans une clé de session
// qu'on suppose remplie.
async function paysDe(req) {
    if (req.session?.pays) return req.session.pays;   // si un jour elle existe
    try {
        const rows = await db.query(`SELECT pays FROM utilisateurs WHERE id = $1`, [String(req.session.userId)]);
        return rows[0]?.pays || "";
    } catch (err) {
        // Pays inconnu = on affiche le montant en dinars, celui qui sera
        // réellement encaissé. Jamais un chiffre inventé.
        console.error("❌ GET /recharge (pays) :", err.message);
        return "";
    }
}

router.get("/", exigeConnexion, async (req, res) => {
    const devisePref = devises.pourPays(await paysDe(req)) || "USD";
    let etat = { soldeUSD: 0, messages: 0, credite: false };
    try {
        etat = await creditsSamii.etat(req.session.userId);
    } catch (err) {
        // Un solde illisible ne doit pas empêcher de recharger — c'est même
        // le moment où quelqu'un en a le plus besoin.
        console.error("❌ GET /recharge (solde) :", err.message);
    }

    // Chaque montant est converti à l'avance : la personne voit ce qu'elle
    // paiera dans SA monnaie avant de cliquer, pas après.
    const montants = CREDITS.MONTANTS.map((m) => {
        const local = devises.convertir(m.usd, "USD", devisePref);
        const paiement = devises.convertir(m.usd, "USD", monnaieDePaiement());
        return {
            ...m,
            local: local.ok ? { montant: devises.arrondir(local.montant, devisePref), devise: devisePref } : null,
            paiement: paiement.ok ? { montant: devises.arrondir(paiement.montant, monnaieDePaiement()), devise: monnaieDePaiement() } : null,
        };
    });

    res.render("recharge", {
        etat,
        montants,
        devisePref,
        prixMessage: CREDITS.PRIX_MESSAGE_USD,
        minimum: CREDITS.MINIMUM_RECHARGE_USD,
        chargilyPret: chargily.isEnabled(),
        // Les deux retours de l'opérateur de paiement. Ils n'affirment rien
        // sur le solde — c'est le webhook qui crédite, et il peut arriver
        // quelques secondes plus tard.
        paye: req.query.paye === "1",
        echec: req.query.echec === "1",
        loggedIn: true,
        typeCompte: req.session?.typeCompte || "client",
    });
});

// ── DÉMARRER UN PAIEMENT ─────────────────────────────────────────────────
router.post("/checkout", exigeConnexion, async (req, res) => {
    try {
        const controle = CREDITS.verifierMontant(req.body?.montantUsd);
        if (!controle.ok) return res.json({ success: false, error: controle.raison });
        if (!chargily.isEnabled()) {
            return res.json({ success: false, error: "Le paiement n'est pas encore branché. Réessaie bientôt." });
        }

        const montantUSD = controle.montant;
        const monnaie = monnaieDePaiement();
        const converti = devises.convertir(montantUSD, "USD", monnaie);
        if (!converti.ok) {
            // Un taux manquant ne doit JAMAIS devenir un montant plausible :
            // on refuse plutôt que d'encaisser un chiffre qu'on ne sait pas
            // justifier. C'est la même règle que pour les commandes.
            return res.json({ success: false, error: `Conversion impossible (${converti.raison}).` });
        }
        const montantLocal = Math.round(converti.montant);
        const taux = montantUSD > 0 ? montantLocal / montantUSD : 0;

        const base = String(CONFIG.APP_URL || "").replace(/\/+$/, "");
        const resultat = await chargily.createCheckout({
            amount: montantLocal,
            currency: monnaie.toLowerCase(),
            successUrl: `${base}/recharge?paye=1`,
            failureUrl: `${base}/recharge?echec=1`,
            webhookUrl: `${base}/webhook/chargily`,
            description: `SAMII — ${CREDITS.messagesPour(montantUSD)} messages`,
            // Le webhook ne reçoit qu'un identifiant de paiement : c'est ici
            // qu'on attache QUI recharge et COMBIEN, pour le retrouver après.
            metadata: {
                type: "recharge_samii",
                user_id: String(req.session.userId),
                montant_usd: String(montantUSD),
            },
        });

        if (!resultat.success) return res.json({ success: false, error: resultat.error });

        // La ligne est écrite EN ATTENTE, avant de renvoyer l'adresse de
        // paiement. Si on l'écrivait après le retour de la personne, un
        // paiement réussi dont le navigateur se ferme ne laisserait aucune
        // trace — et le webhook ne saurait pas à qui créditer.
        await db.query(
            `INSERT INTO recharges_samii (user_id, checkout_id, montant_usd, montant_paye, devise_payee, taux_applique, statut)
             VALUES ($1, $2, $3, $4, $5, $6, 'en_attente')
             ON CONFLICT (checkout_id) DO NOTHING`,
            [String(req.session.userId), resultat.checkoutId, montantUSD, montantLocal, monnaie, taux],
        );

        res.json({ success: true, url: resultat.checkoutUrl });
    } catch (err) {
        console.error("❌ POST /recharge/checkout :", err.message);
        res.json({ success: false, error: "Le paiement n'a pas pu démarrer. Réessaie dans un instant." });
    }
});

// ── LE SOLDE, POUR LA PAGE DE CHAT ───────────────────────────────────────
router.get("/solde", exigeConnexion, async (req, res) => {
    try {
        const etat = await creditsSamii.etat(req.session.userId);
        res.json({ success: true, ...etat });
    } catch (err) {
        console.error("❌ GET /recharge/solde :", err.message);
        res.json({ success: false, soldeUSD: 0, messages: 0 });
    }
});

module.exports = router;
