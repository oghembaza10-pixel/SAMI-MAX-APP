// ==========================================================================
// SAMII OS — PARRAINAGE
// Parrain : 20% de commission récurrente sur les paiements de son filleul,
// pendant 12 mois. Filleul : 5% de réduction sur son propre abonnement,
// pendant ses 12 premiers mois. Fenêtre calculée depuis parrainage_le
// (date à laquelle le lien a été utilisé à l'inscription).
// ==========================================================================
const crypto = require("crypto");
const db = require("./db");
const socketService = require("./socketService");

const TAUX_COMMISSION_PARRAIN = 0.20;
const TAUX_REDUCTION_FILLEUL = 0.05;
const FENETRE_MOIS = 12;
const JOURS_PAR_MOIS = 30.44;

function genererCode() {
    return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function moisEcoules(depuis) {
    const diffMs = Date.now() - new Date(depuis).getTime();
    return diffMs / (1000 * 60 * 60 * 24 * JOURS_PAR_MOIS);
}

// Renvoie le code de parrainage de l'utilisateur, en le générant s'il n'existe pas encore.
async function assurerCodeParrainage(userId) {
    const rows = await db.query(`SELECT code_parrainage FROM utilisateurs WHERE id = $1`, [userId]);
    if (rows[0]?.code_parrainage) return rows[0].code_parrainage;

    for (let tentative = 0; tentative < 5; tentative++) {
        const code = genererCode();
        try {
            await db.query(`UPDATE utilisateurs SET code_parrainage = $1 WHERE id = $2`, [code, userId]);
            return code;
        } catch (err) {
            if (tentative === 4) throw err;
        }
    }
}

// Lie un nouveau compte à son parrain via le code utilisé à l'inscription.
// N'écrit qu'une seule fois : un compte déjà parrainé ne peut pas être réattribué.
async function enregistrerParrainage(nouvelUserId, code) {
    if (!code) return false;
    try {
        const parrainRows = await db.query(`SELECT id FROM utilisateurs WHERE code_parrainage = $1`, [code]);
        const parrainId = parrainRows[0]?.id;
        if (!parrainId || parrainId === nouvelUserId) return false;

        const result = await db.query(
            `UPDATE utilisateurs SET parraine_par = $1, parrainage_le = NOW()
             WHERE id = $2 AND parraine_par IS NULL
             RETURNING id`,
            [parrainId, nouvelUserId]
        );
        return result.length > 0;
    } catch (err) {
        console.error("❌ enregistrerParrainage :", err.message);
        return false;
    }
}

// Applique la réduction de 5% sur le montant d'un abonnement si l'utilisateur
// est un filleul encore dans sa fenêtre de 12 mois.
async function appliquerReductionFilleul(userId, montantBase) {
    try {
        const rows = await db.query(
            `SELECT parraine_par, parrainage_le FROM utilisateurs WHERE id = $1`,
            [userId]
        );
        const user = rows[0];
        if (!user?.parraine_par || !user.parrainage_le) return { montant: montantBase, reduit: false };
        if (moisEcoules(user.parrainage_le) >= FENETRE_MOIS) return { montant: montantBase, reduit: false };

        const montant = Math.round(montantBase * (1 - TAUX_REDUCTION_FILLEUL) * 100) / 100;
        return { montant, reduit: true };
    } catch (err) {
        console.error("❌ appliquerReductionFilleul :", err.message);
        return { montant: montantBase, reduit: false };
    }
}

// Crédite la commission du parrain suite à un paiement confirmé (ou en attente
// de validation manuelle côté CCP) de son filleul. Renvoie la ligne créée,
// ou null si le filleul n'a pas de parrain actif dans sa fenêtre de 12 mois.
async function crediterCommission({ filleulId, montantPaye, devise = "USD", plan, source, statut = "confirmee" }) {
    try {
        const rows = await db.query(
            `SELECT parraine_par, parrainage_le FROM utilisateurs WHERE id = $1`,
            [filleulId]
        );
        const filleul = rows[0];
        if (!filleul?.parraine_par || !filleul.parrainage_le) return null;

        const mois = moisEcoules(filleul.parrainage_le);
        if (mois >= FENETRE_MOIS) return null;

        const moisNumero = Math.min(Math.floor(mois) + 1, FENETRE_MOIS);
        const commission = Math.round(montantPaye * TAUX_COMMISSION_PARRAIN * 100) / 100;

        const inserted = await db.query(
            `INSERT INTO commissions_parrainage
                (parrain_id, filleul_id, plan, montant_paye, devise, commission_montant, mois_numero, source, statut)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [filleul.parraine_par, filleulId, plan || "", montantPaye, devise, commission, moisNumero, source, statut]
        );

        const ligne = inserted[0];
        socketService.emitToShop(filleul.parraine_par, "parrainage:gain", ligne);
        return ligne;
    } catch (err) {
        console.error("❌ crediterCommission :", err.message);
        return null;
    }
}

async function resumeParrain(userId) {
    // Jointure sur workspaces.owner_email : donne au parrain une vraie vue
    // "mes clients" (nom de boutique, métier) plutôt qu'une simple liste de
    // comptes — c'est ce qui transforme la page parrainage en QG partenaire.
    const filleuls = await db.query(
        `SELECT u.id, u.nom, u.prenom, u.email, u.parrainage_le,
                w.nom AS boutique_nom, w.metier AS boutique_metier
         FROM utilisateurs u
         LEFT JOIN workspaces w ON w.owner_email = u.email
         WHERE u.parraine_par = $1
         ORDER BY u.parrainage_le DESC`,
        [userId]
    );
    const commissions = await db.query(
        `SELECT * FROM commissions_parrainage WHERE parrain_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [userId]
    );

    const totalParStatut = commissions.reduce((acc, c) => {
        const montant = parseFloat(c.commission_montant) || 0;
        if (c.statut === "confirmee") acc.confirme += montant;
        else acc.enAttente += montant;
        return acc;
    }, { confirme: 0, enAttente: 0 });

    return { filleuls, commissions, ...totalParStatut };
}

module.exports = {
    TAUX_COMMISSION_PARRAIN,
    TAUX_REDUCTION_FILLEUL,
    FENETRE_MOIS,
    assurerCodeParrainage,
    enregistrerParrainage,
    appliquerReductionFilleul,
    crediterCommission,
    resumeParrain,
};
