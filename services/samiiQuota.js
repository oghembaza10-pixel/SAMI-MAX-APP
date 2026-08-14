// ==========================================================================
// SAMII OS — QUOTA DE MESSAGES (chat in-app /api/chat)
// ==========================================================================
// La mémoire de conversation (samii_conversations) ne doit JAMAIS être
// coupée selon l'abonnement — un client gratuit qui revient demain doit
// retrouver SAMII qui se souvient de tout, sinon il n'a aucune raison de
// croire qu'un abonnement payant vaut le coup. Le vrai levier commercial,
// c'est le volume de messages autorisés par jour, pas la mémoire.
const db = require("../services/db");

const QUOTA_GRATUIT_PAR_FENETRE = 30;
const FENETRE_HEURES = 7;
const PRIX_PREMIUM_USD = 5; // déjà le montant réel facturé par /client-qg/premium (Stripe)
// Dépassement du quota messages sur un workspace payant (standard/pro) :
// jamais bloqué, mais facturé — même principe que confirmationsQuota.js.
// Chargily/CCP ne débitent pas en temps réel, donc ça s'accumule sur
// workspaces.messages_depassement_mois et se règle au renouvellement.
const PRIX_DEPASSEMENT_MESSAGE_USD = 0.5;

// Quotas alignés sur le palier d'abonnement du WORKSPACE marchand
// (routes/billing.js) — remplace le "illimité" qui dépendait uniquement du
// micro-abonnement personnel à 5$. "societe" reste illimité (contrat sur-mesure).
const QUOTA_PAR_PALIER = { free: QUOTA_GRATUIT_PAR_FENETRE, standard: 70, pro: 150 };

async function getAbonnement(userId) {
    if (!userId) return "gratuit";
    try {
        const rows = await db.query(`SELECT abonnement FROM utilisateurs WHERE id = $1`, [userId]);
        return rows[0]?.abonnement || "gratuit";
    } catch {
        return "gratuit";
    }
}

async function getPalierWorkspace(workspaceId) {
    if (!workspaceId) return null;
    try {
        const rows = await db.query(`SELECT palier_abonnement FROM workspaces WHERE id = $1`, [workspaceId]);
        return rows[0]?.palier_abonnement || null;
    } catch {
        return null;
    }
}

async function compterMessagesFenetre(userId) {
    try {
        const rows = await db.query(
            `SELECT count(*)::int AS n FROM samii_conversations
             WHERE user_id = $1 AND role = 'user' AND created_at > now() - interval '${FENETRE_HEURES} hours'`,
            [userId]
        );
        return rows[0]?.n || 0;
    } catch {
        return 0;
    }
}

// Retourne l'état du quota pour ce compte — utilisé à la fois pour bloquer
// l'envoi côté /api/chat et pour l'afficher côté /client-qg/quota.
// workspaceId (optionnel) : quand fourni (un marchand connecté), le palier
// du workspace prime sur le micro-abonnement personnel à 5$ dès qu'il
// dépasse le gratuit — sinon (un client final sans workspace, ou un
// marchand encore au palier gratuit) on retombe sur l'ancien comportement.
// depassementFacturable : true si ce compte a un moyen de paiement lié
// (workspace standard/pro) donc peut continuer au-delà du quota moyennant
// facturation, au lieu d'être bloqué net.
async function getEtatQuota(userId, workspaceId) {
    if (!userId) return { illimite: true, restant: null, total: null, utilises: 0 };

    const palier = await getPalierWorkspace(workspaceId);
    if (palier === "societe") return { illimite: true, restant: null, total: null, utilises: 0 };
    if (palier && QUOTA_PAR_PALIER[palier] && palier !== "free") {
        const utilises = await compterMessagesFenetre(userId);
        const total = QUOTA_PAR_PALIER[palier];
        return {
            illimite: false, total, utilises, restant: Math.max(0, total - utilises),
            fenetreHeures: FENETRE_HEURES, depassementFacturable: true,
        };
    }

    const abonnement = await getAbonnement(userId);
    if (abonnement !== "gratuit") {
        return { illimite: true, restant: null, total: null, utilises: 0 };
    }

    const utilises = await compterMessagesFenetre(userId);
    return {
        illimite: false,
        total: QUOTA_GRATUIT_PAR_FENETRE,
        utilises,
        restant: Math.max(0, QUOTA_GRATUIT_PAR_FENETRE - utilises),
        fenetreHeures: FENETRE_HEURES,
        depassementFacturable: false,
    };
}

// Enregistre un message envoyé au-delà du quota sur un workspace payant —
// jamais de débit en temps réel (voir en-tête), juste un compteur mensuel
// remis à zéro automatiquement au changement de mois calendaire.
async function enregistrerMessageDepassement(workspaceId) {
    if (!workspaceId) return;
    try {
        await db.query(
            `UPDATE workspaces SET
                messages_depassement_mois = CASE
                    WHEN messages_depassement_reset_le IS NULL OR messages_depassement_reset_le < date_trunc('month', now())
                    THEN 1 ELSE messages_depassement_mois + 1
                END,
                messages_depassement_reset_le = now()
             WHERE id = $1`,
            [workspaceId]
        );
    } catch (err) {
        console.warn("⚠️ enregistrerMessageDepassement :", err.message);
    }
}

// Lu par engines/abonnementEngine.js pour ajouter le dépassement du mois au
// prochain lien de renouvellement — ignore le compteur s'il date d'un mois
// calendaire déjà passé (jamais remis à zéro explicitement, juste périmé).
async function getDepassementMessagesMois(workspaceId) {
    if (!workspaceId) return { count: 0, montantDu: 0 };
    try {
        const rows = await db.query(
            `SELECT messages_depassement_mois, messages_depassement_reset_le FROM workspaces WHERE id = $1`,
            [workspaceId]
        );
        const w = rows[0];
        const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
        if (!w?.messages_depassement_reset_le || new Date(w.messages_depassement_reset_le) < debutMois) {
            return { count: 0, montantDu: 0 };
        }
        const count = w.messages_depassement_mois || 0;
        return { count, montantDu: Math.round(count * PRIX_DEPASSEMENT_MESSAGE_USD * 100) / 100 };
    } catch {
        return { count: 0, montantDu: 0 };
    }
}

module.exports = {
    QUOTA_GRATUIT_PAR_JOUR: QUOTA_GRATUIT_PAR_FENETRE, // alias conservé pour compat (routes existantes)
    QUOTA_GRATUIT_PAR_FENETRE, QUOTA_PAR_PALIER, FENETRE_HEURES, PRIX_PREMIUM_USD, PRIX_DEPASSEMENT_MESSAGE_USD,
    getAbonnement, getPalierWorkspace, compterMessagesFenetre, getEtatQuota,
    enregistrerMessageDepassement, getDepassementMessagesMois,
};
