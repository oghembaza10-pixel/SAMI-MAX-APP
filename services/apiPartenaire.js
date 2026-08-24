// ==========================================================================
// SAMII OS — API PARTENAIRES : clés d'accès et webhooks sortants
//
// Permet à un système externe (n8n, Make, Zapier, un ERP maison) de lire et
// de créer des commandes et des rendez-vous dans un espace SAMII, et d'être
// prévenu en temps réel de ce qui s'y passe.
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

/**
 * Crée une clé pour un espace. La valeur en clair n'est retournée qu'ICI,
 * une seule fois — elle n'est plus jamais consultable ensuite.
 */
async function creerCle(workspaceId, nom = "Clé API") {
    const cle = PREFIXE + crypto.randomBytes(24).toString("hex");
    await db.query(
        `INSERT INTO api_cles (workspace_id, nom, cle_hash, cle_prefixe)
         VALUES ($1, $2, $3, $4)`,
        [workspaceId, String(nom).slice(0, 60), empreinte(cle), cle.slice(0, 16)],
    );
    return cle;
}

async function listerCles(workspaceId) {
    return db.query(
        `SELECT id, nom, cle_prefixe, actif, derniere_utilisation, created_at
           FROM api_cles WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId],
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

/**
 * Résout une clé en espace de travail. Retourne null si la clé est inconnue
 * ou révoquée — l'appelant doit alors répondre 401 sans autre détail.
 */
async function resoudreCle(cle) {
    if (!cle || !cle.startsWith(PREFIXE)) return null;
    try {
        const rows = await db.query(
            `SELECT id, workspace_id FROM api_cles
              WHERE cle_hash = $1 AND actif = TRUE`,
            [empreinte(cle)],
        );
        if (!rows[0]) return null;
        // Trace de dernière utilisation, utile au marchand pour repérer une
        // clé oubliée ou un usage inattendu. Jamais bloquant.
        db.query(`UPDATE api_cles SET derniere_utilisation = NOW() WHERE id = $1`, [rows[0].id])
            .catch(() => {});
        return rows[0].workspace_id;
    } catch (err) {
        console.error("❌ apiPartenaire.resoudreCle :", err.message);
        return null;
    }
}

// ── WEBHOOKS SORTANTS ────────────────────────────────────────────────────

const EVENEMENTS = [
    "commande.creee",
    "commande.confirmee",
    "commande.annulee",
    "rendezvous.cree",
    "rendezvous.confirme",
    "message.recu",
];

async function creerWebhook(workspaceId, { url, evenements }) {
    const propres = (Array.isArray(evenements) ? evenements : [])
        .filter(e => EVENEMENTS.includes(e));
    if (!propres.length) throw new Error("Aucun événement valide sélectionné.");

    const secret = "whsec_" + crypto.randomBytes(20).toString("hex");
    const rows = await db.query(
        `INSERT INTO webhooks_sortants (workspace_id, url, evenements, secret)
         VALUES ($1, $2, $3, $4) RETURNING id, secret`,
        [workspaceId, url, propres, secret],
    );
    return rows[0];
}

async function listerWebhooks(workspaceId) {
    return db.query(
        `SELECT id, url, evenements, actif, dernier_essai, dernier_statut, echecs, created_at
           FROM webhooks_sortants WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId],
    );
}

async function supprimerWebhook(workspaceId, id) {
    const rows = await db.query(
        `DELETE FROM webhooks_sortants WHERE id = $1 AND workspace_id = $2 RETURNING id`,
        [id, workspaceId],
    );
    return rows.length > 0;
}

/**
 * Notifie les systèmes externes abonnés à cet événement.
 *
 * Volontairement "au mieux" : on n'attend pas la réponse et un échec ne
 * remonte jamais à l'appelant. Une commande ne doit jamais échouer parce
 * que le n8n d'une agence est momentanément hors service.
 */
async function emettre(workspaceId, evenement, donnees) {
    if (!workspaceId || !EVENEMENTS.includes(evenement)) return;

    let cibles = [];
    try {
        cibles = await db.query(
            `SELECT id, url, secret FROM webhooks_sortants
              WHERE workspace_id = $1 AND actif = TRUE AND $2 = ANY(evenements)`,
            [workspaceId, evenement],
        );
    } catch (err) {
        console.error("❌ apiPartenaire.emettre (lecture) :", err.message);
        return;
    }
    if (!cibles.length) return;

    const corps = JSON.stringify({
        evenement,
        workspaceId,
        donnees,
        emisLe: new Date().toISOString(),
    });

    for (const cible of cibles) {
        const signature = crypto.createHmac("sha256", cible.secret).update(corps).digest("hex");
        axios.post(cible.url, corps, {
            headers: {
                "Content-Type": "application/json",
                "X-SAMII-Event": evenement,
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
    creerWebhook, listerWebhooks, supprimerWebhook, emettre,
};
