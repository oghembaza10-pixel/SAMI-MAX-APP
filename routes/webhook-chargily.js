// ==========================================================================
// SAMII OS — WEBHOOK CHARGILY PAY (confirmation de paiement réel)
// Monté sous /webhook, où express.raw() laisse le body en Buffer brut —
// nécessaire pour vérifier la signature HMAC-SHA256 sur le payload exact.
// ==========================================================================
const express    = require("express");
const chargily   = require("../services/chargily");
const { confirmChargilyPayment, confirmChargilyCartePurchase, confirmChargilyAbonnement, confirmChargilyRecharge } = require("../services/orders");

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const signature = req.get("signature") || "";
        const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

        if (!chargily.verifySignature(raw, signature)) {
            console.warn("⚠️ Webhook Chargily : signature invalide");
            return res.sendStatus(403);
        }

        const event = JSON.parse(raw.toString("utf8"));
        const checkoutId = event.id || event.data?.id;
        if (!checkoutId) return res.sendStatus(200);

        // ── UN SEUL AGIRA, MAIS AUCUN NE DOIT FAIRE TAIRE LES AUTRES ────
        //
        // Un seul des quatre fera réellement quelque chose : chacun vérifie
        // ses propres champs de metadata et ne touche rien s'ils sont absents.
        //
        // Ils étaient enchaînés par de simples `await` dans ce try. Mesuré :
        // une panne dans le PREMIER sautait au catch, les trois suivants
        // n'étaient jamais appelés, et le catch répondait 200 — donc Chargily
        // ne réessayait pas. Un paiement de recharge encaissé pendant que
        // `confirmChargilyPayment` se heurtait à un réseau lent (il appelle
        // Chargily, c'est un appel réseau : ça tombe pour de vrai) partait en
        // silence : argent pris, solde jamais crédité, aucune trace.
        //
        // Donc : chacun dans son propre filet, tous appelés, et si l'un tombe
        // on renvoie une ERREUR pour que Chargily réessaie. Le rejeu est sans
        // danger — les quatre ne prennent que si le statut n'est pas déjà
        // final (`statut != 'payée'`, `statut = 'en_attente'`), c'est la base
        // qui l'arbitre, pas nous.
        const travaux = [
            ["commande", confirmChargilyPayment],
            ["carte", confirmChargilyCartePurchase],
            ["abonnement", confirmChargilyAbonnement],
            ["recharge", confirmChargilyRecharge],
        ];
        let tombes = [];
        for (const [nom, confirmer] of travaux) {
            try {
                await confirmer(checkoutId);
            } catch (err) {
                tombes.push(nom);
                console.error(`❌ Webhook Chargily [${nom}] ${checkoutId} :`, err.message);
            }
        }

        if (tombes.length) {
            // 500 et non 200 : c'est la seule façon de demander un rejeu. Un
            // 200 ici signerait « c'est bon » sur un paiement non traité.
            console.error(`❌ Webhook Chargily ${checkoutId} : ${tombes.join(", ")} en échec — on demande un rejeu.`);
            return res.sendStatus(500);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Webhook Chargily :", err.message);
        res.sendStatus(200);
    }
});

module.exports = router;
