// ======================================================
// SAMII OS — Workspace Service — PostgreSQL
// ======================================================
// Source de vérité des Workspaces.
// Toutes les routes doivent passer par ce service.
// ======================================================
const db = require("../services/db");

function parseJSON(raw, fallback) {
    if (!raw) return fallback;
    if (typeof raw === "object") return raw;
    try {
        return { ...fallback, ...JSON.parse(raw) };
    } catch {
        return fallback;
    }
}

function parseMissions(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function mapRow(r) {
    return {
        workspaceId: r.id || "",
        recordId: r.id || "",
        owner: r.owner || r.owner_email || "",
        nom: r.nom || "",
        metier: r.metier || "",
        logo: r.logo || "",
        langue: r.langue || "fr",
        devise: r.devise || "DZD",
        pays: r.pays || "",
        description: r.description || "",
        samii: parseJSON(r.samii, { mode: "auto" }),
        coffre: parseJSON(r.coffre, { forteresse: { charges: 0, activeUntil: null }, boost: { charges: 0, activeUntil: null } }),
        automatisations: parseJSON(r.automatisations, { ambassadeur: true, serenite: true, bouclierAntiFraude: true }),
        missions: parseMissions(r.missions),
        metaAccessToken: r.meta_access_token || "",
        metaAdAccountId: r.meta_ad_account_id || "",
        metaPageId: r.meta_page_id || "",
        timezone: r.timezone || "Africa/Algiers",
        palierAbonnement: r.palier_abonnement || "free",
        agenceId: r.agence_id || null,
        agenceStatut: r.agence_statut || "actif",
        statut: r.statut || "actif",
        actif: r.statut === "actif" || !r.statut,
        created_at: r.created_at || "",
        updated_at: r.updated_at || "",
    };
}

async function getByOwner(email) {
    try {
        const rows = await db.query(
            `SELECT * FROM workspaces WHERE owner = $1 OR owner_email = $1 LIMIT 50`,
            [email]
        );
        return rows.map(mapRow);
    } catch (err) {
        console.error("❌ workspaceService.getByOwner :", err.message);
        return [];
    }
}

async function getAllActive() {
    try {
        const rows = await db.query(
            `SELECT * FROM workspaces WHERE statut = 'actif' OR statut IS NULL LIMIT 100`
        );
        return rows.map(mapRow);
    } catch (err) {
        console.error("❌ workspaceService.getAllActive :", err.message);
        return [];
    }
}

async function getById(workspaceId) {
    try {
        const rows = await db.query(`SELECT * FROM workspaces WHERE id = $1 LIMIT 1`, [workspaceId]);
        return rows[0] ? mapRow(rows[0]) : null;
    } catch (err) {
        console.error("❌ workspaceService.getById :", err.message);
        return null;
    }
}

async function getActiveWorkspace(email) {
    try {
        const rows = await db.query(
            `SELECT * FROM workspaces WHERE (owner = $1 OR owner_email = $1) AND (statut = 'actif' OR statut IS NULL) LIMIT 1`,
            [email]
        );
        if (!rows[0]) return null;
        const w = mapRow(rows[0]);
        return { workspaceId: w.workspaceId, nom: w.nom, metier: w.metier };
    } catch (err) {
        console.error("❌ workspaceService.getActiveWorkspace :", err.message);
        return null;
    }
}

async function getByMetier(email, metier) {
    try {
        const rows = await db.query(
            `SELECT * FROM workspaces WHERE (owner = $1 OR owner_email = $1) AND metier = $2 LIMIT 1`,
            [email, metier]
        );
        return rows[0] ? mapRow(rows[0]) : null;
    } catch (err) {
        console.error("❌ workspaceService.getByMetier :", err.message);
        return null;
    }
}

async function exists(workspaceId) {
    const workspace = await getById(workspaceId);
    return workspace !== null;
}

async function belongsToOwner(workspaceId, owner) {
    try {
        const rows = await db.query(
            `SELECT id FROM workspaces WHERE id = $1 AND (owner = $2 OR owner_email = $2) LIMIT 1`,
            [workspaceId, owner]
        );
        return rows.length > 0;
    } catch (err) {
        console.error("❌ workspaceService.belongsToOwner :", err.message);
        return false;
    }
}

async function create({ workspaceId, owner, nom, metier, logo = "", pays = "", devise = "", langue = "fr", agenceId = null }) {
    try {
        await db.query(
            `INSERT INTO workspaces (id, owner, owner_email, nom, metier, logo, pays, devise, langue, statut, agence_id)
             VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, 'actif', $9)`,
            [workspaceId, owner, nom, metier, logo, pays, devise || "DZD", langue, agenceId]
        );
        return await getById(workspaceId);
    } catch (err) {
        console.error("❌ workspaceService.create :", err.message);
        return null;
    }
}

// Boutiques créées par une agence donnée, pour son "QG Agence".
async function getByAgence(agenceId) {
    try {
        const rows = await db.query(
            `SELECT * FROM workspaces WHERE agence_id = $1 ORDER BY created_at DESC`,
            [agenceId]
        );
        return rows.map(mapRow);
    } catch (err) {
        console.error("❌ workspaceService.getByAgence :", err.message);
        return [];
    }
}

async function update(recordId, fields) {
    try {
        const colonnesAutorisees = [
            "nom", "metier", "logo", "langue", "devise", "pays", "description",
            "samii", "coffre", "automatisations", "missions", "rdv_config", "auto_post_config",
            "meta_access_token", "meta_ad_account_id", "meta_page_id",
            "timezone", "statut",
        ];

        const sets = [];
        const values = [];
        let i = 1;

        for (const [key, value] of Object.entries(fields)) {
            const colonne = key.replace(/([A-Z])/g, "_$1").toLowerCase(); // camelCase → snake_case
            if (!colonnesAutorisees.includes(colonne)) continue;
            const valeurFinale = typeof value === "object" ? JSON.stringify(value) : value;
            sets.push(`${colonne} = $${i++}`);
            values.push(valeurFinale);
        }

        if (!sets.length) return await getById(recordId);

        sets.push(`updated_at = NOW()`);
        values.push(recordId);

        await db.query(`UPDATE workspaces SET ${sets.join(", ")} WHERE id = $${i}`, values);
        return await getById(recordId);
    } catch (err) {
        console.error("❌ workspaceService.update :", err.message);
        return null;
    }
}

async function remove(recordId) {
    try {
        await db.query(`DELETE FROM workspaces WHERE id = $1`, [recordId]);
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
    getByAgence,
    delete: remove,
};
