// ==========================================================================
// SAMII OS — LE GRAND LIVRE DES PAIEMENTS
//
// CE QUE FAIT CE FICHIER. Il tient la trace de chaque paiement, calcule qui
// touche quoi, et confie l'encaissement au prestataire choisi par l'acheteur.
// Il ne connaît aucun prestataire par son nom : il lit config/paiements.js
// et appelle l'adaptateur correspondant.
//
// ─────────────────────────────────────────────────────────────────────────
// LA RÈGLE QUI COMMANDE TOUT LE RESTE : ON ÉCRIT AVANT D'APPELER
//
// La ligne en base est créée AVANT que le prestataire soit contacté, avec
// le statut « en attente ». Ça paraît inutile — c'est l'inverse.
//
// Si on appelait d'abord et écrivait ensuite, il suffirait que le serveur
// redémarre, que le réseau coupe ou que le processus soit tué entre les deux
// pour qu'un acheteur ait payé sans qu'aucune trace n'existe chez nous. Il
// aurait débité son Mobile Money, et notre base dirait qu'il ne s'est rien
// passé. On ne peut pas rendre un argent dont on ignore l'existence.
//
// Dans l'autre sens, une ligne « en attente » qui ne se confirme jamais est
// bénigne : elle se nettoie, elle ne coûte rien à personne.
//
// ─────────────────────────────────────────────────────────────────────────
// LE PARTAGE EST CALCULÉ ICI, ET NULLE PART AILLEURS
//
// Sur une vente faite dans une communauté partenaire, trois personnes sont
// concernées : le vendeur, la partenaire qui a amené l'acheteur, la maison.
// Le calcul est fait une fois, au moment de la vente, et ÉCRIT dans la ligne.
//
// On ne le recalcule jamais après coup. Les taux changent — une renégociation,
// une promotion, une erreur corrigée — et un calcul refait six mois plus tard
// donnerait un autre résultat que celui qui a été convenu le jour de la
// vente. Un partage recalculé, c'est un désaccord avec une partenaire qui a
// 8,5 millions de vues par mois. La ligne dit ce qui a été convenu ce jour-là.
//
// ─────────────────────────────────────────────────────────────────────────
// CE QUI N'EST PAS ENCORE LÀ
//
// L'adaptateur Mobile Money (SebPay) n'est pas écrit : sa documentation n'est
// pas entre nos mains. Il échoue donc en le DISANT, plutôt que d'envoyer une
// requête inventée. Un adaptateur deviné se découvre en production, sur
// l'argent d'un vrai client.
// ==========================================================================
const db = require("./db");
const fournisseurs = require("../config/paiements");
const communautes = require("../config/communautes");

// Deux chiffres après la virgule, sans jamais passer par les flottants pour
// l'arrondi final : 0.1 + 0.2 ne fait pas 0.3 en JavaScript, et sur de
// l'argent ça finit par se voir.
function sous(montant) {
    return Math.round(Number(montant) * 100) / 100;
}

// ── QUI TOUCHE QUOI ─────────────────────────────────────────────────────
// Le reste au vendeur : c'est lui qui livre. La commission se prend sur la
// vente, puis se partage entre la partenaire et la maison.
//
// Le vendeur est calculé par SOUSTRACTION, jamais par un second pourcentage :
// c'est la seule façon que les trois parts fassent exactement le total. Avec
// deux pourcentages arrondis chacun de leur côté, il manque ou il reste un
// centime — et un centime qui traîne dans un grand livre, c'est un grand
// livre auquel on ne peut plus se fier.
function partager(montant, slugCommunaute) {
    const COM = communautes.get(slugCommunaute);
    const regle = COM.commission || { taux: 0, partPartenaire: 0 };

    const total = sous(montant);
    const commission = sous(total * regle.taux);
    const partenaire = sous(commission * regle.partPartenaire);

    return {
        total,
        commission,
        partenaire,                          // ce que touche la partenaire
        maison: sous(commission - partenaire), // ce que touche la maison
        vendeur: sous(total - commission),   // le reste, par soustraction
        taux: regle.taux,
        tauxPartenaire: regle.partPartenaire,
    };
}

// Une référence lisible à l'œil nu. Elle finira dans un relevé Mobile Money,
// dans un message WhatsApp de client mécontent, dans une capture d'écran
// floue : elle doit pouvoir être recopiée à la main sans se tromper.
function reference() {
    const t = Date.now().toString(36).toUpperCase();
    const h = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `SAM-${t}-${h}`;
}

// ── LES ADAPTATEURS ─────────────────────────────────────────────────────
// Chacun reçoit la même chose et rend la même chose : { url } — l'adresse
// où envoyer l'acheteur. Tout ce qui est propre à un prestataire reste
// enfermé ici.
const ADAPTATEURS = {
    async chargily({ paiement, retourOk, retourEchec, rappel, description }) {
        const chargily = require("./chargily");
        if (!chargily.isEnabled()) throw new Error("Chargily n'est pas configuré.");
        const r = await chargily.createCheckout({
            // Chargily compte en dinars entiers, pas en centimes.
            amount: Math.round(paiement.montant),
            currency: String(paiement.devise).toLowerCase(),
            description,
            successUrl: retourOk,
            failureUrl: retourEchec,
            webhookUrl: rappel,
            metadata: { reference: paiement.reference },
        });
        if (!r.success) throw new Error("Chargily a refusé la création du paiement.");
        return { url: r.checkoutUrl, referenceFournisseur: r.checkoutId };
    },

    async stripe({ paiement, retourOk, retourEchec, description }) {
        if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe n'est pas configuré.");
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [{
                price_data: {
                    currency: String(paiement.devise).toLowerCase(),
                    product_data: { name: description },
                    // Stripe compte en centimes.
                    unit_amount: Math.round(paiement.montant * 100),
                },
                quantity: 1,
            }],
            success_url: retourOk,
            cancel_url: retourEchec,
            client_reference_id: paiement.reference,
            metadata: { reference: paiement.reference },
        });
        return { url: session.url, referenceFournisseur: session.id };
    },

    async sebpay() {
        // Voir l'en-tête du fichier. Ce n'est pas un oubli, c'est un refus
        // d'inventer. Le message doit permettre de comprendre sans lire le
        // code : il apparaîtra dans les journaux, pas devant un acheteur.
        throw new Error(
            "Mobile Money n'est pas encore branché : la documentation du prestataire " +
            "(adresse de création d'un paiement, noms des champs, signature des " +
            "notifications) n'a pas encore été fournie."
        );
    },
};

// ── CRÉER UN PAIEMENT ───────────────────────────────────────────────────
async function creer({
    fournisseur, montant, devise, description,
    acheteurId, vendeurId, communaute, objetType, objetId,
    retourOk, retourEchec, rappel,
}) {
    const f = fournisseurs.get(fournisseur);
    if (!f) throw new Error("Moyen de paiement inconnu.");
    if (!f.pret) throw new Error(`${f.nom} n'est pas encore disponible.`);
    if (!fournisseurs.configure(f)) throw new Error(`${f.nom} n'est pas configuré sur ce serveur.`);
    if (!f.devises.includes(String(devise).toUpperCase())) {
        // Le piège XOF/XAF : deux monnaies au même nom courant. Mieux vaut
        // refuser ici que verser dans la mauvaise zone.
        throw new Error(`${f.nom} n'accepte pas les paiements en ${devise}.`);
    }
    const total = sous(montant);
    if (!(total > 0)) throw new Error("Montant invalide.");

    const parts = partager(total, communaute);
    const ref = reference();

    // On écrit d'abord — voir l'en-tête du fichier.
    await db.query(
        `INSERT INTO paiements
           (reference, fournisseur, statut, montant, devise,
            acheteur_id, vendeur_id, communaute, objet_type, objet_id,
            part_vendeur, part_partenaire, part_maison, commission, taux_commission)
         VALUES ($1,$2,'en_attente',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [ref, f.id, total, String(devise).toUpperCase(),
         acheteurId || null, vendeurId || null,
         communaute || communautes.DEFAUT, objetType || null,
         objetId ? String(objetId) : null,
         parts.vendeur, parts.partenaire, parts.maison, parts.commission, parts.taux],
    );

    const paiement = { reference: ref, montant: total, devise: String(devise).toUpperCase() };

    try {
        const r = await ADAPTATEURS[f.id]({
            paiement, retourOk, retourEchec, rappel,
            description: description || "Achat",
        });
        if (r.referenceFournisseur) {
            await db.query(
                `UPDATE paiements SET reference_fournisseur = $1 WHERE reference = $2`,
                [r.referenceFournisseur, ref],
            );
        }
        return { reference: ref, url: r.url, parts };
    } catch (err) {
        // Le prestataire a refusé : la ligne reste, marquée. On saura
        // combien de paiements échouent avant même de commencer, et
        // pourquoi — c'est exactement ce qu'on veut savoir au lancement.
        await db.query(
            `UPDATE paiements SET statut = 'echec', note = $1 WHERE reference = $2`,
            [String(err.message).slice(0, 500), ref],
        ).catch(() => {});
        throw err;
    }
}

// ── CONFIRMER ───────────────────────────────────────────────────────────
// Appelée par un webhook, UNE FOIS LA SIGNATURE VÉRIFIÉE — jamais avant.
// Sans signature vérifiée, une notification n'est qu'une affirmation faite
// par un inconnu sur Internet : n'importe qui peut appeler notre adresse et
// prétendre qu'un paiement de 500 000 est passé.
//
// Le `statut = 'en_attente'` dans le WHERE n'est pas décoratif : les
// prestataires réémettent leurs notifications, parfois des dizaines de fois.
// Sans lui, une livraison serait déclenchée à chaque réémission.
async function confirmer(ref, details = {}) {
    const rows = await db.query(
        `UPDATE paiements
            SET statut = 'paye', paye_le = now(), note = $2
          WHERE reference = $1 AND statut = 'en_attente'
      RETURNING *`,
        [ref, JSON.stringify(details).slice(0, 2000)],
    );
    // Aucune ligne : soit la référence n'existe pas, soit c'est un doublon.
    // Dans les deux cas il n'y a rien à livrer une seconde fois.
    return rows[0] || null;
}

module.exports = { creer, confirmer, partager, reference, sous, ADAPTATEURS };
