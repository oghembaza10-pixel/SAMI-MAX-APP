// ======================================================
// SAMII OS — Connector Service
// ======================================================
// Source de vérité pour les connecteurs par workspace.
// Table Airtable : CONNECTEURS
// Champs : workspace_id, type, config (JSON), actif
// ======================================================

const Airtable = require("airtable");
const CONFIG   = require("../config");

const base  = new Airtable({ apiKey: CONFIG.AIRTABLE.API_KEY }).base(CONFIG.AIRTABLE.BASE_ID);
const TABLE = "CONNECTEURS";

// ── Helpers formule ───────────────────────────────────
function escapeFormula(str) {
    return String(str || "").replace(/'/g, "\\'");
}

// ── Helpers JSON ──────────────────────────────────────
function parseConfig(raw) {
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
}

function stringifyConfig(config) {
    if (typeof config === "string") return config;
    try { return JSON.stringify(config); } catch { return "{}"; }
}

// ── Formater un record Airtable ───────────────────────
function format(r) {
    return {
        id          : r.id,
        workspaceId : r.fields.workspace_id || "",
        type        : r.fields.type         || "",
        config      : parseConfig(r.fields.config),
        actif       : r.fields.actif        === true,
    };
}

// ── Récupérer tous les connecteurs d'un workspace ─────
async function getByWorkspace(workspaceId) {
    try {
        const records = await base(TABLE).select({
            filterByFormula: `{workspace_id} = '${escapeFormula(workspaceId)}'`,
        }).all();

        return records.map(format);

    } catch (err) {
        console.error("❌ connectorService.getByWorkspace :", err);
        return [];
    }
}

// ── Récupérer un connecteur par workspace + type ──────
async function getOne(workspaceId, type) {
    try {
        const records = await base(TABLE).select({
            filterByFormula: `AND({workspace_id} = '${escapeFormula(workspaceId)}', {type} = '${escapeFormula(type)}')`,
            maxRecords     : 1,
        }).all();

        if (!records.length) return null;
        return format(records[0]);

    } catch (err) {
        console.error("❌ connectorService.getOne :", err);
        return null;
    }
}

// ── Créer un connecteur ───────────────────────────────
async function create(workspaceId, type, config = {}) {
    try {
        const record = await base(TABLE).create({
            workspace_id : workspaceId,
            type         : type,
            config       : stringifyConfig(config),
            actif        : true,
        });

        return format(record);

    } catch (err) {
        console.error("❌ connectorService.create :", err);
        return null;
    }
}

// ── Mettre à jour un connecteur ───────────────────────
async function update(recordId, fields) {
    try {
        if (fields.config) fields.config = stringifyConfig(fields.config);

        const record = await base(TABLE).update(recordId, fields);
        return format(record);

    } catch (err) {
        console.error("❌ connectorService.update :", err);
        return null;
    }
}

// ── Sauvegarder (create ou update) ───────────────────
async function save(workspaceId, type, config = {}) {
    try {
        const existing = await getOne(workspaceId, type);

        if (existing) {
            // ✅ Fusionner config existante + nouvelle
            const mergedConfig = { ...existing.config, ...config };
            return await update(existing.id, {
                config : mergedConfig,
                actif  : true,
            });
        } else {
            return await create(workspaceId, type, config);
        }

    } catch (err) {
        console.error("❌ connectorService.save :", err);
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
        console.error("❌ connectorService.disconnect :", err);
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
