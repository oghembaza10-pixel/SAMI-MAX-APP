// ==========================================================================
// SAMII OS — API PARTENAIRES : clés d'accès et webhooks sortants
//
// Permet à un système externe (n8n, Make, Zapier, un ERP maison) de lire et
// de créer des commandes et des rendez-vous dans un espace SAMII, et d'être
// prévenu en temps réel de ce qui s'y passe.
//
// Deux portées, jamais les deux à la fois :
//   • MARCHAND — la clé est liée à un espace et n'atteint que celui-là ;
//   • AGENCE   — la clé est liée à un compte agence et couvre tous les
//                espaces de son portefeuille. Une agence branche son n8n une
//                seule fois pour l'ensemble de ses clients ; un espace qui
//                quitte l'agence sort du périmètre de la clé sans qu'il y ait
//                quoi que ce soit à révoquer, puisque l'appartenance est
//                revérifiée à chaque appel (workspaces.agence_id).
//
// Deux principes de sécurité :
//   1. la clé n'est jamais stockée en clair — seule son empreinte SHA-256
//      l'est, donc une fuite de la base ne donne aucune clé utilisable ;
//   2. chaque appel sortant est signé (HMAC-SHA256) pour que le destinataire
//      puisse vérifier que la requête vient bien de nous et n'a pas été
//      modifiée en route.
// ==========================================================================
const crypto = require("crypto");
const axios = require("axios");
const db = require("../services/db");

const PREFIXE = "sk_samii_";

function empreinte(cle) {
    return crypto.createHash("sha256").update(cle).digest("hex");
}

// ── CLÉS ─────────────────────────────────────────────────────────────────

async function creerCleAvecPortee({ workspaceId = null, agenceId = null }, nom) {
    const cle = PREFIXE + crypto.randomBytes(24).toString("hex");
    await db.query(
        `INSERT INTO api_cles (workspace_id, agence_id, nom, cle_hash, cle_prefixe)
         VALUES ($1, $2, $3, $4, $5)`,
        [workspaceId, agenceId, String(nom || "Clé API").slice(0, 60), empreinte(cle), cle.slice(0, 16)],
    );
    return cle;
}

/**
 * Crée une clé de marchand. La valeur en clair n'est retournée qu'ICI, une
 * seule fois — elle n'est plus jamais consultable ensuite.
 */
function creerCle(workspaceId, nom = "Clé API") {
    return creerCleAvecPortee({ workspaceId }, nom);
}

/** Crée une clé d'agence, valable sur tout son portefeuille. */
function creerCleAgence(agenceId, nom = "Clé agence") {
    return creerCleAvecPortee({ agenceId: String(agenceId) }, nom);
}

function listerCles(workspaceId) {
    return db.query(
        `SELECT id, nom, cle_prefixe, actif, derniere_utilisation, created_at
           FROM api_cles WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId],
    );
}

function listerClesAgence(agenceId) {
    return db.query(
        `SELECT id, nom, cle_prefixe, actif, derniere_utilisation, created_at
           FROM api_cles WHERE agence_id = $1 ORDER BY created_at DESC`,
        [String(agenceId)],
    );
}

async function revoquerCle(workspaceId, id) {
    const rows = await db.query(
        `UPDATE api_cles SET actif = FALSE
          WHERE id = $1 AND workspace_id = $2 RETURNING id`,
        [id, workspaceId],
    );
    return rows.length > 0;
}

async function revoquerCleAgence(agenceId, id) {
    const rows = await db.query(
        `UPDATE api_cles SET actif = FALSE
          WHERE id = $1 AND agence_id = $2 RETURNING id`,
        [id, String(agenceId)],
    );
    return rows.length > 0;
}

/**
 * Résout une clé en portée d'accès : { workspaceId, agenceId } — l'un des
 * deux est renseigné, jamais les deux. Retourne null si la clé est inconnue
 * ou révoquée ; l'appelant doit alors répondre 401 sans autre détail.
 */
async function resoudreCle(cle) {
    if (!cle || !cle.startsWith(PREFIXE)) return null;
    try {
        const rows = await db.query(
            `SELECT id, workspace_id, agence_id FROM api_cles
              WHERE cle_hash = $1 AND actif = TRUE`,
            [empreinte(cle)],
        );
        if (!rows[0]) return null;
        // Trace de dernière utilisation, utile au propriétaire pour repérer
        // une clé oubliée ou un usage inattendu. Jamais bloquant.
        db.query(`UPDATE api_cles SET derniere_utilisation = NOW() WHERE id = $1`, [rows[0].id])
            .catch(() => {});
        return {
            workspaceId: rows[0].workspace_id || null,
            agenceId: rows[0].agence_id || null,
        };
    } catch (err) {
        console.error("❌ apiPartenaire.resoudreCle :", err.message);
        return null;
    }
}

/**
 * Vérifie qu'un espace appartient bien au portefeuille d'une agence, et
 * retourne son identifiant si oui. C'est le seul point qui autorise une clé
 * d'agence à toucher un espace : l'appartenance est revérifiée à chaque
 * appel, jamais mise en cache ni déduite de la clé.
 */
async function espaceDeLAgence(agenceId, workspaceId) {
    if (!workspaceId) return null;
    try {
        const rows = await db.query(
            `SELECT id FROM workspaces WHERE id = $1 AND agence_id = $2`,
            [workspaceId, String(agenceId)],
        );
        return rows[0]?.id || null;
    } catch (err) {
        console.error("❌ apiPartenaire.espaceDeLAgence :", err.message);
        return null;
    }
}

function listerEspacesAgence(agenceId) {
    return db.query(
        `SELECT id, nom, metier, pays, devise FROM workspaces
          WHERE agence_id = $1 ORDER BY nom`,
        [String(agenceId)],
    );
}

// ── WEBHOOKS SORTANTS ────────────────────────────────────────────────────

const EVENEMENTS = [
    "commande.creee",
    "commande.confirmee",
    "commande.annulee",
    "rendezvous.cree",
    "rendezvous.confirme",
    // Une annulation compte autant qu'une prise : sans elle, l'agenda d'un
    // partenaire dérive silencieusement — il garde un créneau que le
    // marchand a libéré.
    "rendezvous.annule",
    "message.recu",
];

async function creerWebhookAvecPortee({ workspaceId = null, agenceId = null }, { url, evenements }) {
    const propres = (Array.isArray(evenements) ? evenements : [])
        .filter(e => EVENEMENTS.includes(e));
    if (!propres.length) throw new Error("Aucun événement valide sélectionné.");

    const secret = "whsec_" + crypto.randomBytes(20).toString("hex");
    const rows = await db.query(
        `INSERT INTO webhooks_sortants (workspace_id, agence_id, url, evenements, secret)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, secret`,
        [workspaceId, agenceId, url, propres, secret],
    );
    return rows[0];
}

function creerWebhook(workspaceId, options) {
    return creerWebhookAvecPortee({ workspaceId }, options);
}

function creerWebhookAgence(agenceId, options) {
    return creerWebhookAvecPortee({ agenceId: String(agenceId) }, options);
}

function listerWebhooks(workspaceId) {
    return db.query(
        `SELECT id, url, evenements, actif, dernier_essai, dernier_statut, echecs, created_at
           FROM webhooks_sortants WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId],
    );
}

function listerWebhooksAgence(agenceId) {
    return db.query(
        `SELECT id, url, evenements, actif, dernier_essai, dernier_statut, echecs, created_at
           FROM webhooks_sortants WHERE agence_id = $1 ORDER BY created_at DESC`,
        [String(agenceId)],
    );
}

async function supprimerWebhook(workspaceId, id) {
    const rows = await db.query(
        `DELETE FROM webhooks_sortants WHERE id = $1 AND workspace_id = $2 RETURNING id`,
        [id, workspaceId],
    );
    return rows.length > 0;
}

async function supprimerWebhookAgence(agenceId, id) {
    const rows = await db.query(
        `DELETE FROM webhooks_sortants WHERE id = $1 AND agence_id = $2 RETURNING id`,
        [id, String(agenceId)],
    );
    return rows.length > 0;
}

/**
 * Notifie les systèmes externes abonnés à cet événement : ceux du marchand,
 * ET ceux de l'agence qui pilote cet espace le cas échéant. Une agence
 * reçoit donc tout son portefeuille sur une seule URL, et sait de quel
 * client il s'agit grâce au bloc `espace` du corps envoyé.
 *
 * Volontairement "au mieux" : on n'attend pas la réponse et un échec ne
 * remonte jamais à l'appelant. Une commande ne doit jamais échouer parce
 * que le n8n d'une agence est momentanément hors service.
 */
async function emettre(workspaceId, evenement, donnees) {
    if (!workspaceId || !EVENEMENTS.includes(evenement)) return;

    let espace = null;
    let cibles = [];
    try {
        const rows = await db.query(
            `SELECT id, nom, agence_id FROM workspaces WHERE id = $1`,
            [workspaceId],
        );
        if (!rows[0]) return;
        espace = rows[0];

        cibles = await db.query(
            `SELECT id, url, secret FROM webhooks_sortants
              WHERE actif = TRUE AND $3 = ANY(evenements)
                AND (workspace_id = $1 OR (agence_id IS NOT NULL AND agence_id = $2))`,
            [workspaceId, espace.agence_id ? String(espace.agence_id) : null, evenement],
        );
    } catch (err) {
        console.error("❌ apiPartenaire.emettre (lecture) :", err.message);
        return;
    }
    if (!cibles.length) return;

    const corps = JSON.stringify({
        evenement,
        workspaceId,
        espace: { id: espace.id, nom: espace.nom },
        donnees,
        emisLe: new Date().toISOString(),
    });

    for (const cible of cibles) {
        const signature = crypto.createHmac("sha256", cible.secret).update(corps).digest("hex");
        axios.post(cible.url, corps, {
            headers: {
                "Content-Type": "application/json",
                "X-SAMII-Event": evenement,
                "X-SAMII-Espace": espace.id,
                "X-SAMII-Signature": `sha256=${signature}`,
            },
            timeout: 8000,
        })
            .then(res => {
                db.query(
                    `UPDATE webhooks_sortants SET dernier_essai = NOW(), dernier_statut = $2, echecs = 0 WHERE id = $1`,
                    [cible.id, res.status],
                ).catch(() => {});
            })
            .catch(err => {
                const statut = err.response?.status || 0;
                console.warn(`⚠️ Webhook ${cible.url} → ${statut || err.code || "échec"}`);
                // Après 20 échecs consécutifs, on désactive : une URL morte ne
                // doit pas être rappelée indéfiniment à chaque commande.
                db.query(
                    `UPDATE webhooks_sortants
                        SET dernier_essai = NOW(), dernier_statut = $2, echecs = echecs + 1,
                            actif = (echecs + 1 < 20)
                      WHERE id = $1`,
                    [cible.id, statut],
                ).catch(() => {});
            });
    }
}

module.exports = {
    PREFIXE, EVENEMENTS,
    creerCle, listerCles, revoquerCle, resoudreCle,
    creerCleAgence, listerClesAgence, revoquerCleAgence,
    espaceDeLAgence, listerEspacesAgence,
    creerWebhook, listerWebhooks, supprimerWebhook,
    creerWebhookAgence, listerWebhooksAgence, supprimerWebhookAgence,
    emettre,
};
