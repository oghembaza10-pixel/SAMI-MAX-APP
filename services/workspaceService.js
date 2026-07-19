// ======================================================
// SAMII OS — Workspace Service
// ======================================================
// Source de vérité des Workspaces.
// Toutes les routes doivent passer par ce service.
// Interdiction d'appeler Airtable directement
// pour la table WORKSPACES.
// ======================================================

const axios = require("axios");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_WORKSPACES = process.env.TABLE_WORKSPACES || "WORKSPACES";

const url     = () => `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_WORKSPACES}`;
const headers = () => ({ Authorization: `Bearer ${AIRTABLE_API_KEY}` });

// ── Helper — échapper les valeurs dans les formules ──
function escapeFormula(value = "") {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
}

// ── Mapper un record Airtable ─────────────────────────
function mapRecord(r) {
    const f = r.fields;
    return {
        workspaceId : f.workspace_id || "",
        recordId    : r.id,
        owner       : f.owner        || "",
        nom         : f.nom          || "",
        metier      : f.metier       || "",
        logo        : f.logo         || "",
        langue      : f.langue       || "fr",
        devise      : f.devise       || "DZD",
        timezone    : f.timezone     || "Africa/Algiers",
        statut      : f.statut       || "actif",
        actif       : f.statut       === "actif",
        created_at  : f.created_at   || "",
        updated_at  : f.updated_at   || "",
    };
}

// ── Tous les workspaces d'un owner ───────────────────
async function getByOwner(email) {
    try {
        const res = await axios.get(url(), {
            headers: headers(),
            params : {
                filterByFormula: `{owner}="${escapeFormula(email)}"`,
                maxRecords     : 50,
            },
        });
        return res.data.records.map(mapRecord);
    } catch (err) {
        console.error("❌ workspaceService.getByOwner :", err.message);
        return [];
    }
}

// ── Un workspace par workspaceId ─────────────────────
async function getById(workspaceId) {
    try {
        const res = await axios.get(url(), {
            headers: headers(),
            params : {
                filterByFormula: `{workspace_id}="${escapeFormula(workspaceId)}"`,
                maxRecords     : 1,
            },
        });
        const record = res.data.records[0];
        return record ? mapRecord(record) : null;
    } catch (err) {
        console.error("❌ workspaceService.getById :", err.message);
        return null;
    }
}

// ── Workspace actif d'un owner ────────────────────────
// Disponible mais non appelé en V1 (session suffit)
async function getActiveWorkspace(email) {
    try {
        const res = await axios.get(url(), {
            headers: headers(),
            params : {
                filterByFormula: `AND({owner}="${escapeFormula(email)}",{statut}="actif")`,
                maxRecords     : 1,
            },
        });
        const record = res.data.records[0];
        if (!record) return null;
        const w = mapRecord(record);
        return { workspaceId: w.workspaceId, nom: w.nom, metier: w.metier };
    } catch (err) {
        console.error("❌ workspaceService.getActiveWorkspace :", err.message);
        return null;
    }
}

// ── Workspace par métier ──────────────────────────────
async function getByMetier(email, metier) {
    try {
        const res = await axios.get(url(), {
            headers: headers(),
            params : {
                filterByFormula: `AND({owner}="${escapeFormula(email)}",{metier}="${escapeFormula(metier)}")`,
                maxRecords     : 1,
            },
        });
        const record = res.data.records[0];
        return record ? mapRecord(record) : null;
    } catch (err) {
        console.error("❌ workspaceService.getByMetier :", err.message);
        return null;
    }
}

// ── Vérifier si un workspace existe ──────────────────
async function exists(workspaceId) {
    const workspace = await getById(workspaceId);
    return workspace !== null;
}

// ── ✅ Sécurité — vérifier ownership (1 seule requête)
async function belongsToOwner(workspaceId, owner) {
    try {
        const res = await axios.get(url(), {
            headers: headers(),
            params : {
                filterByFormula: `AND({workspace_id}="${escapeFormula(workspaceId)}",{owner}="${escapeFormula(owner)}")`,
                maxRecords     : 1,
            },
        });
        return res.data.records.length > 0;
    } catch (err) {
        console.error("❌ workspaceService.belongsToOwner :", err.message);
        return false;
    }
}

// ── Créer un workspace ───────────────────────────────
async function create({ workspaceId, owner, nom, metier, logo = "" }) {
    try {
        const res = await axios.post(
            url(),
            {
                fields: {
                    workspace_id: workspaceId,
                    owner,
                    nom,
                    metier,
                    logo,
                    statut    : "actif",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
            },
            { headers: { ...headers(), "Content-Type": "application/json" } }
        );
        return mapRecord(res.data);
    } catch (err) {
        console.error("❌ workspaceService.create :", err.message);
        return null;
    }
}

// ── Mettre à jour un workspace ───────────────────────
async function update(recordId, fields) {
    try {
        const res = await axios.patch(
            `${url()}/${recordId}`,
            { fields: { ...fields, updated_at: new Date().toISOString() } },
            { headers: { ...headers(), "Content-Type": "application/json" } }
        );
        return mapRecord(res.data);
    } catch (err) {
        console.error("❌ workspaceService.update :", err.message);
        return null;
    }
}

// ── Supprimer un workspace ───────────────────────────
async function remove(recordId) {
    try {
        await axios.delete(`${url()}/${recordId}`, { headers: headers() });
        return true;
    } catch (err) {
        console.error("❌ workspaceService.delete :", err.message);
        return false;
    }
}

module.exports = {
    getByOwner,
    getById,
    getActiveWorkspace,
    getByMetier,
    exists,
    belongsToOwner,
    create,
    update,
    delete: remove,
};
