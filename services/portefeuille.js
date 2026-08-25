// ==========================================================================
// SAMII OS — LE PORTEFEUILLE
//
// POURQUOI IL EXISTE. Sans carte bancaire, le séquestre d'une place de marché
// ne peut pas être une autorisation bancaire qu'on capture à la livraison :
// il n'y a pas de carte à autoriser. Il devient donc un solde retenu chez
// nous. L'acheteur alimente par ce qui existe chez lui — CCP, mobile money,
// virement, espèces — l'argent est bloqué le temps du travail, le vendeur est
// crédité à la livraison et retire par son propre moyen. C'est ainsi que les
// places de marché africaines fonctionnent réellement, et c'est ce qui rend
// les 10 % encaissables là où Malt ne pourrait pas encaisser un centime.
//
// ── LA RÈGLE QUI TIENT TOUT ────────────────────────────────────────────────
// Le registre est en PARTIE DOUBLE et en AJOUT SEULEMENT. Aucun solde n'est
// stocké : un solde est une somme de mouvements, recalculée à la demande. Un
// solde stocké dérive au premier incident et on ne sait plus jamais reconstituer
// ce qui s'est passé — alors qu'une somme de lignes immuables ne ment pas.
//
// Chaque opération écrit AU MOINS deux lignes dont la somme signée fait zéro.
// Le monde extérieur est un compte comme un autre (EXTERIEUR) : un dépôt n'est
// pas de l'argent qui apparaît, c'est de l'argent qui vient de dehors. D'où
// l'invariant, vrai sur la table entière, à tout instant :
//
//     SUM(sens * montant) = 0
//
// S'il est faux un jour, c'est qu'on a perdu de l'argent quelque part. Un test
// le vérifie (tests/portefeuille.test.js) et rien ne doit jamais le contourner.
//
// ── TROIS POCHES ───────────────────────────────────────────────────────────
//   disponible — ce qui peut être dépensé ou retiré maintenant
//   sequestre  — bloqué au titre d'un travail en cours, ni à l'un ni à l'autre
//   retrait    — demandé en retrait, plus dépensable, pas encore parti
//
// La troisième existe pour une raison précise : entre la demande de retrait et
// le virement réel (souvent manuel chez nous), l'argent ne doit plus être
// dépensable. Sans elle, un vendeur retire et achète avec la même somme.
//
// ── CE QUE CE FICHIER NE FAIT PAS ──────────────────────────────────────────
// Il ne parle à aucun opérateur de paiement. Constater qu'un versement CCP est
// arrivé ou qu'un Wave est parti, c'est le rôle d'un rail (config/rails.js) ou
// d'un humain. Ici on n'enregistre que des faits déjà constatés. C'est ce qui
// permet d'ouvrir un pays sans toucher à la comptabilité.
// ==========================================================================
const crypto = require("crypto");
const db = require("./db");
const academie = require("../config/academie");

// Le compte qui représente tout ce qui est hors de la plateforme. Ce n'est pas
// un membre : c'est ce qui rend chaque opération équilibrée.
const EXTERIEUR = "EXTERIEUR";
// Le compte de la plateforme, celui qui reçoit les commissions.
const MAISON = "SAMII";

const POCHES = ["disponible", "sequestre", "retrait"];

const TYPES = {
    depot: "Dépôt",
    blocage: "Mise sous séquestre",
    liberation: "Libération au vendeur",
    commission: "Commission SAMII",
    remboursement: "Remboursement à l'acheteur",
    retrait_demande: "Retrait demandé",
    retrait_paye: "Retrait payé",
    retrait_annule: "Retrait annulé",
};

function reference(prefixe) {
    return `${prefixe}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function centimes(montant) {
    const n = Math.round(Number(montant) * 100) / 100;
    return Number.isFinite(n) ? n : NaN;
}

// ── Écriture ─────────────────────────────────────────────────────────────

// Écrit une opération : plusieurs lignes, toutes ou aucune. La somme signée
// est vérifiée AVANT d'écrire — une écriture déséquilibrée ne doit jamais
// atteindre la base, même une seconde.
async function ecrire(q, { operation, type, devise, lignes, transactionRef = null, rail = null, detail = "" }) {
    const total = lignes.reduce((s, l) => s + l.sens * centimes(l.montant), 0);
    if (Math.abs(total) > 0.001) {
        throw new Error(`Écriture déséquilibrée (${total}) — opération refusée.`);
    }
    for (const l of lignes) {
        if (!POCHES.includes(l.poche)) throw new Error(`Poche inconnue : ${l.poche}`);
        if (!(centimes(l.montant) > 0)) throw new Error("Montant invalide.");
        await q(
            `INSERT INTO portefeuille_mouvements
                (operation, compte, poche, sens, montant, devise, type, transaction_ref, rail, detail)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [operation, l.compte, l.poche, l.sens, centimes(l.montant), devise,
             type, transactionRef, rail, String(detail || "").slice(0, 300)],
        );
    }
    return operation;
}

// LE VERROU QUI EMPÊCHE DE CRÉER DE L'ARGENT.
//
// Sans lui, deux opérations simultanées sur le même compte lisent toutes deux
// l'ancien solde, se croient toutes deux couvertes, et écrivent toutes deux.
// Ce n'est pas une hypothèse d'école : mesuré sur un vrai PostgreSQL, huit
// blocages de 100 lancés ensemble sur un solde de 100 en ont fait passer cinq
// et laissé le compte à −400. Une simple relecture du solde ne protège de rien,
// parce que le danger n'est pas de lire trop tôt, c'est que l'autre écrive
// entre la lecture et l'écriture.
//
// pg_advisory_xact_lock sérialise les opérations d'UN compte et d'une devise —
// les autres comptes continuent en parallèle. Le verrou est rendu tout seul au
// COMMIT comme au ROLLBACK : rien à libérer à la main, donc rien à oublier.
//
// UN SEUL VERROU PAR TRANSACTION, TOUJOURS. Toutes nos opérations ne débitent
// qu'un compte (les crédits, eux, ne peuvent pas devenir négatifs). Tant que
// cette règle tient, aucun interblocage n'est possible. Le jour où une
// opération devrait débiter deux comptes, il faudra les verrouiller dans un
// ordre fixe — sans quoi deux transactions s'attendront l'une l'autre.
async function verrouiller(q, compte, devise) {
    await q(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [`pf:${compte}:${devise}`]);
}

// Solde d'une poche, lu dans la transaction en cours. Toujours relu juste
// avant un débit : un solde lu il y a trois lignes n'est plus une garantie.
async function soldePoche(q, compte, poche, devise) {
    const rows = await q(
        `SELECT COALESCE(SUM(sens * montant), 0) AS solde
           FROM portefeuille_mouvements
          WHERE compte = $1 AND poche = $2 AND devise = $3`,
        [compte, poche, devise],
    );
    return Number(rows[0]?.solde || 0);
}

async function exigerSolde(q, compte, poche, devise, montant) {
    // Le verrou d'abord, la lecture ensuite. Dans l'autre sens, il ne servirait
    // à rien : on aurait déjà lu une valeur périmée.
    await verrouiller(q, compte, devise);
    const solde = await soldePoche(q, compte, poche, devise);
    if (solde + 0.001 < centimes(montant)) {
        const err = new Error(`Solde insuffisant : ${solde.toFixed(2)} ${devise} disponible, ${centimes(montant).toFixed(2)} demandé.`);
        err.code = "SOLDE_INSUFFISANT";
        throw err;
    }
}

// ── Les opérations ───────────────────────────────────────────────────────

// L'argent entre. `rail` dit par où (voir config/rails.js) ; il n'est pas
// vérifié ici — on n'enregistre qu'un versement DÉJÀ constaté, par un
// opérateur automatique ou par l'équipe.
async function deposer({ compte, montant, devise = "USD", rail = "virement", detail = "" }) {
    if (!compte) throw new Error("Compte manquant.");
    const op = reference("DEP");
    return db.transaction(async (q) => {
        await ecrire(q, {
            operation: op, type: "depot", devise, rail, detail,
            lignes: [
                { compte: EXTERIEUR, poche: "disponible", sens: -1, montant },
                { compte, poche: "disponible", sens: +1, montant },
            ],
        });
        return { operation: op, solde: await soldePoche(q, compte, "disponible", devise) };
    });
}

// L'acheteur met la somme sous séquestre pour une transaction précise. Ni lui
// ni le vendeur ne peuvent y toucher tant que le travail n'est pas validé.
async function bloquer({ compte, transactionRef, montant, devise = "USD", detail = "" }) {
    if (!transactionRef) throw new Error("Référence de transaction manquante.");
    const op = reference("SEQ");
    return db.transaction(async (q) => {
        // Idempotence : deux clics sur « payer » ne doivent pas bloquer deux fois.
        const deja = await q(
            `SELECT 1 FROM portefeuille_mouvements WHERE transaction_ref = $1 AND type = 'blocage' LIMIT 1`,
            [transactionRef],
        );
        if (deja.length) {
            const err = new Error("Cette transaction est déjà sous séquestre.");
            err.code = "DEJA_BLOQUE";
            throw err;
        }
        await exigerSolde(q, compte, "disponible", devise, montant);
        await ecrire(q, {
            operation: op, type: "blocage", devise, transactionRef, detail,
            lignes: [
                { compte, poche: "disponible", sens: -1, montant },
                { compte, poche: "sequestre", sens: +1, montant },
            ],
        });
        return { operation: op };
    });
}

// Le travail est validé : le séquestre se partage entre le vendeur et la
// maison. Le partage est lu sur la ligne de transaction, jamais recalculé —
// c'est elle qui porte le taux figé au jour de l'accord (services/academie.js).
async function liberer({ transactionRef }) {
    const op = reference("LIB");
    return db.transaction(async (q) => {
        const rows = await q(
            `SELECT reference, acheteur_id, vendeur_id, montant_brut, commission, net_vendeur, devise, statut
               FROM academie_transactions WHERE reference = $1`,
            [transactionRef],
        );
        const t = rows[0];
        if (!t) throw new Error("Transaction introuvable.");

        const deja = await q(
            `SELECT 1 FROM portefeuille_mouvements WHERE transaction_ref = $1 AND type = 'liberation' LIMIT 1`,
            [transactionRef],
        );
        if (deja.length) {
            const err = new Error("Cette transaction a déjà été libérée.");
            err.code = "DEJA_LIBERE";
            throw err;
        }

        const brut = Number(t.montant_brut);
        await exigerSolde(q, t.acheteur_id, "sequestre", t.devise, brut);

        await ecrire(q, {
            operation: op, type: "liberation", devise: t.devise, transactionRef,
            detail: `Libération ${t.reference}`,
            lignes: [
                { compte: t.acheteur_id, poche: "sequestre", sens: -1, montant: brut },
                { compte: t.vendeur_id, poche: "disponible", sens: +1, montant: Number(t.net_vendeur) },
                { compte: MAISON, poche: "disponible", sens: +1, montant: Number(t.commission) },
            ],
        });

        await q(
            `UPDATE academie_transactions SET statut = 'reversee', reversee_le = now()
              WHERE reference = $1`,
            [transactionRef],
        );
        return { operation: op, net: Number(t.net_vendeur), commission: Number(t.commission) };
    });
}

// Rien n'a été livré : tout revient à l'acheteur. Aucune commission — la part
// de SAMII naît d'une vente, pas d'une tentative (contrat, article 5).
async function rembourser({ transactionRef, detail = "" }) {
    const op = reference("REM");
    return db.transaction(async (q) => {
        const rows = await q(
            `SELECT acheteur_id, montant_brut, devise FROM academie_transactions WHERE reference = $1`,
            [transactionRef],
        );
        const t = rows[0];
        if (!t) throw new Error("Transaction introuvable.");

        const deja = await q(
            `SELECT 1 FROM portefeuille_mouvements WHERE transaction_ref = $1 AND type = 'remboursement' LIMIT 1`,
            [transactionRef],
        );
        if (deja.length) throw new Error("Cette transaction a déjà été remboursée.");

        const brut = Number(t.montant_brut);
        await exigerSolde(q, t.acheteur_id, "sequestre", t.devise, brut);
        await ecrire(q, {
            operation: op, type: "remboursement", devise: t.devise, transactionRef, detail,
            lignes: [
                { compte: t.acheteur_id, poche: "sequestre", sens: -1, montant: brut },
                { compte: t.acheteur_id, poche: "disponible", sens: +1, montant: brut },
            ],
        });
        await q(`UPDATE academie_transactions SET statut = 'remboursee' WHERE reference = $1`, [transactionRef]);
        return { operation: op };
    });
}

// ── Retraits ─────────────────────────────────────────────────────────────
// Chez nous, un virement part souvent à la main (CCP, mobile money, espèces).
// La somme quitte donc « disponible » dès la demande — sinon le vendeur
// dépenserait un argent déjà promis — et ne quitte la plateforme qu'au
// moment où le versement est réellement constaté.

async function demanderRetrait({ compte, montant, devise = "USD", rail, destination, detail = "" }) {
    if (!compte) throw new Error("Compte manquant.");
    if (!rail) throw new Error("Choisis par où tu veux être payé.");
    const op = reference("RET");
    return db.transaction(async (q) => {
        await exigerSolde(q, compte, "disponible", devise, montant);
        await ecrire(q, {
            operation: op, type: "retrait_demande", devise, rail,
            detail: `${detail} ${destination || ""}`.trim(),
            lignes: [
                { compte, poche: "disponible", sens: -1, montant },
                { compte, poche: "retrait", sens: +1, montant },
            ],
        });
        await q(
            `INSERT INTO portefeuille_retraits (reference, compte, montant, devise, rail, destination, statut)
             VALUES ($1,$2,$3,$4,$5,$6,'demande')`,
            [op, compte, centimes(montant), devise, rail, String(destination || "").slice(0, 160)],
        );
        return { operation: op };
    });
}

// Le versement est parti pour de bon : l'argent sort de la plateforme.
async function confirmerRetrait(referenceRetrait) {
    return db.transaction(async (q) => {
        // Deux confirmations lancées ensemble liraient toutes deux « demande »
        // et sortiraient l'argent deux fois. On verrouille la ligne elle-même.
        const rows = await q(
            `SELECT * FROM portefeuille_retraits WHERE reference = $1 AND statut = 'demande' FOR UPDATE`,
            [referenceRetrait],
        );
        const r = rows[0];
        if (!r) throw new Error("Retrait introuvable ou déjà traité.");

        await ecrire(q, {
            operation: reference("RPY"), type: "retrait_paye", devise: r.devise, rail: r.rail,
            detail: `Retrait ${r.reference}`,
            lignes: [
                { compte: r.compte, poche: "retrait", sens: -1, montant: r.montant },
                { compte: EXTERIEUR, poche: "disponible", sens: +1, montant: r.montant },
            ],
        });
        await q(`UPDATE portefeuille_retraits SET statut = 'paye', traite_le = now() WHERE reference = $1`, [r.reference]);
        return { reference: r.reference };
    });
}

// Le versement n'a pas pu se faire : la somme redevient dépensable.
async function annulerRetrait(referenceRetrait, motif = "") {
    return db.transaction(async (q) => {
        const rows = await q(
            `SELECT * FROM portefeuille_retraits WHERE reference = $1 AND statut = 'demande' FOR UPDATE`,
            [referenceRetrait],
        );
        const r = rows[0];
        if (!r) throw new Error("Retrait introuvable ou déjà traité.");

        await ecrire(q, {
            operation: reference("RAN"), type: "retrait_annule", devise: r.devise, rail: r.rail,
            detail: motif,
            lignes: [
                { compte: r.compte, poche: "retrait", sens: -1, montant: r.montant },
                { compte: r.compte, poche: "disponible", sens: +1, montant: r.montant },
            ],
        });
        await q(`UPDATE portefeuille_retraits SET statut = 'annule', traite_le = now() WHERE reference = $1`, [r.reference]);
        return { reference: r.reference };
    });
}

// ── Lecture ──────────────────────────────────────────────────────────────

// Les soldes d'un compte, par devise. On ne convertit jamais : additionner des
// dinars et des nairas au taux du jour donnerait un chiffre faux demain.
async function soldes(compte) {
    try {
        const rows = await db.query(
            `SELECT devise, poche, COALESCE(SUM(sens * montant), 0) AS solde
               FROM portefeuille_mouvements WHERE compte = $1
              GROUP BY devise, poche`,
            [compte],
        );
        const par = {};
        for (const r of rows) {
            par[r.devise] = par[r.devise] || { disponible: 0, sequestre: 0, retrait: 0 };
            par[r.devise][r.poche] = Number(r.solde);
        }
        return par;
    } catch (err) {
        console.error("❌ portefeuille.soldes :", err.message);
        return {};
    }
}

// Le relevé, tel qu'on le montre au membre. Lisible : une ligne par mouvement
// qui le concerne, la plus récente d'abord.
async function releve(compte, limite = 50) {
    try {
        return await db.query(
            `SELECT operation, poche, sens, montant, devise, type, transaction_ref, rail, detail, created_at
               FROM portefeuille_mouvements WHERE compte = $1
              ORDER BY created_at DESC, id DESC LIMIT $2`,
            [compte, Math.min(Number(limite) || 50, 200)],
        );
    } catch (err) {
        console.error("❌ portefeuille.releve :", err.message);
        return [];
    }
}

// Le contrôle de vérité. Doit toujours renvoyer 0 : si ce n'est pas le cas,
// de l'argent a été créé ou perdu, et il faut arrêter d'encaisser avant de
// comprendre pourquoi.
async function controleEquilibre() {
    const rows = await db.query(
        `SELECT devise, COALESCE(SUM(sens * montant), 0) AS ecart
           FROM portefeuille_mouvements GROUP BY devise`,
    );
    return rows.map((r) => ({ devise: r.devise, ecart: Number(r.ecart) }));
}

module.exports = {
    EXTERIEUR, MAISON, POCHES, TYPES, TAUX: academie.TAUX_COMMISSION,
    deposer, bloquer, liberer, rembourser,
    demanderRetrait, confirmerRetrait, annulerRetrait,
    soldes, releve, controleEquilibre,
};
