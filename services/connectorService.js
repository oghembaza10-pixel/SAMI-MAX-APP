// ======================================================
// SAMII OS — Connector Service — PostgreSQL
// ======================================================
// Source de vérité pour les connecteurs par workspace.
// Table PostgreSQL : connecteurs
// Colonnes : id, workspace_id, type, config (JSON texte), actif, created_at
// ======================================================
const db = require("../services/db");
const paliers = require("../config/paliers");

// ── Helpers JSON ──────────────────────────────────────
function parseConfig(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try { return JSON.parse(raw); } catch { return {}; }
}

function stringifyConfig(config) {
    if (typeof config === "string") return config;
    try { return JSON.stringify(config); } catch { return "{}"; }
}

// ── Formater une ligne PostgreSQL ─────────────────────
function format(r) {
    return {
        id: r.id,
        workspaceId: r.workspace_id || "",
        type: r.type || "",
        config: parseConfig(r.config),
        actif: r.actif === true,
    };
}

// ── Récupérer tous les connecteurs d'un workspace ─────
async function getByWorkspace(workspaceId) {
    try {
        const rows = await db.query(
            `SELECT * FROM connecteurs WHERE workspace_id = $1 ORDER BY created_at DESC`,
            [workspaceId]
        );
        return rows.map(format);
    } catch (err) {
        console.error("❌ connectorService.getByWorkspace :", err.message);
        return [];
    }
}

// ── Récupérer un connecteur par workspace + type ──────
async function getOne(workspaceId, type) {
    try {
        const rows = await db.query(
            `SELECT * FROM connecteurs WHERE workspace_id = $1 AND type = $2 LIMIT 1`,
            [workspaceId, type]
        );
        if (!rows.length) return null;
        return format(rows[0]);
    } catch (err) {
        console.error("❌ connectorService.getOne :", err.message);
        return null;
    }
}

// ── Créer un connecteur ───────────────────────────────
async function create(workspaceId, type, config = {}) {
    try {
        const rows = await db.query(
            `INSERT INTO connecteurs (workspace_id, type, config, actif) VALUES ($1, $2, $3, true) RETURNING *`,
            [workspaceId, type, stringifyConfig(config)]
        );
        return format(rows[0]);
    } catch (err) {
        console.error("❌ connectorService.create :", err.message);
        return null;
    }
}

// ── Mettre à jour un connecteur ───────────────────────
async function update(recordId, fields) {
    try {
        const sets = [];
        const values = [];
        let i = 1;

        if (fields.config !== undefined) {
            sets.push(`config = $${i++}`);
            values.push(stringifyConfig(fields.config));
        }
        if (fields.actif !== undefined) {
            sets.push(`actif = $${i++}`);
            values.push(fields.actif);
        }
        if (fields.type !== undefined) {
            sets.push(`type = $${i++}`);
            values.push(fields.type);
        }

        if (!sets.length) {
            const rows = await db.query(`SELECT * FROM connecteurs WHERE id = $1`, [recordId]);
            return rows[0] ? format(rows[0]) : null;
        }

        values.push(recordId);
        const rows = await db.query(
            `UPDATE connecteurs SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
            values
        );
        return rows[0] ? format(rows[0]) : null;
    } catch (err) {
        console.error("❌ connectorService.update :", err.message);
        return null;
    }
}

// ── Quota de canaux par palier ────────────────────────
// Le nombre de canaux est ce qu'on vend : 1 au palier gratuit, 3 à Actif,
// sans limite au-dessus (config/paliers.js). Le contrôle est ici, dans le
// service, et pas dans chaque route de connexion — il y en a une par outil,
// et il en manquerait forcément une.
//
// Deux règles voulues :
//  • rebrancher un canal DÉJÀ connecté ne consomme rien (sinon un marchand
//    au quota ne pourrait plus corriger son propre jeton) ;
//  • les canaux déjà en place au moment d'un changement de palier ne sont
//    jamais coupés — seule une NOUVELLE connexion est refusée.
async function quotaCanaux(workspaceId, type) {
    if (!paliers.CANAUX_COMPTES.includes(type)) return { ok: true };

    // Le quota ne concerne QUE les espaces marchands. Les espaces clients
    // (routes/client-connect.js passe un identifiant d'utilisateur, pas de
    // workspace) n'ont pas de palier et ne doivent jamais être bloqués ici.
    // Une panne de base ne bloque pas non plus : brancher un canal n'est pas
    // une frontière de sécurité, WhatsApp et l'API ont leurs propres contrôles.
    let palier;
    try {
        const rows = await db.query(`SELECT palier_abonnement FROM workspaces WHERE id = $1`, [workspaceId]);
        if (!rows.length) return { ok: true };
        palier = rows[0].palier_abonnement || "free";
    } catch {
        return { ok: true };
    }

    const max = paliers.canauxMax(palier);
    if (max === null) return { ok: true };

    const actuels = (await getByWorkspace(workspaceId))
        .filter(c => c.actif && paliers.CANAUX_COMPTES.includes(c.type));
    if (actuels.some(c => c.type === type)) return { ok: true };
    if (actuels.length < max) return { ok: true };

    return { ok: false, max, palier, utilises: actuels.map(c => c.type) };
}

// ── Sauvegarder (create ou update, avec fusion config) ──
async function save(workspaceId, type, config = {}) {
    try {
        // L'essai WhatsApp de 3 jours sur le numéro partagé n'est pas un canal :
        // c'est un aperçu, promis à tous les paliers sur la page de tarifs. Le
        // compter dans le quota reviendrait à le refuser au palier gratuit dès
        // qu'un Telegram est branché — exactement à qui il est destiné.
        const quota = config.mode === "depannage"
            ? { ok: true }
            : await quotaCanaux(workspaceId, type);
        if (!quota.ok) {
            const err = new Error(
                `Ton palier autorise ${quota.max} canal${quota.max > 1 ? "aux" : ""} `
                + `(déjà utilisé${quota.utilises.length > 1 ? "s" : ""} : ${quota.utilises.join(", ")}). `
                + `Passe au palier supérieur pour en brancher un de plus.`,
            );
            err.code = "QUOTA_CANAUX";
            throw err;
        }
        const existing = await getOne(workspaceId, type);
        if (existing) {
            const mergedConfig = { ...existing.config, ...config };
            return await update(existing.id, {
                config: mergedConfig,
                actif: true,
            });
        } else {
            return await create(workspaceId, type, config);
        }
    } catch (err) {
        // Un refus de quota est une réponse, pas une panne : il doit remonter
        // à la route pour être expliqué au marchand, alors qu'une vraie erreur
        // technique reste avalée comme avant (les appelants testent `null`).
        if (err.code === "QUOTA_CANAUX") throw err;
        console.error("❌ connectorService.save :", err.message);
        return null;
    }
}

// ── Désactiver un connecteur ──────────────────────────
async function disconnect(workspaceId, type) {
    try {
        const existing = await getOne(workspaceId, type);
        if (!existing) return null;
        return await update(existing.id, { actif: false });
    } catch (err) {
        console.error("❌ connectorService.disconnect :", err.message);
        return null;
    }
}

module.exports = {
    quotaCanaux,
    getByWorkspace,
    getOne,
    create,
    update,
    save,
    disconnect,
};
