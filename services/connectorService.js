// ======================================================
// SAMII OS — Connector Service — PostgreSQL
// ======================================================
// Source de vérité pour les connecteurs par workspace.
// Table PostgreSQL : connecteurs
// Colonnes : id, workspace_id, type, config (JSON texte), actif, created_at
// ======================================================
const db = require("../services/db");

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

// ── Sauvegarder (create ou update, avec fusion config) ──
async function save(workspaceId, type, config = {}) {
    try {
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
    getByWorkspace,
    getOne,
    create,
    update,
    save,
    disconnect,
};
