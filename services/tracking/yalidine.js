// ==========================================================================
// SAMII OS — Yalidine — clé API par marchand + écriture PostgreSQL
// ==========================================================================
const axios = require("axios");
const orchestrator = require("../../brain/orchestrator");
const db = require("../db");

async function send({ to, message }) {
    console.log(`🚚 Yalidine → ${to} : ${message}`);
    return { success: true };
}

async function getApiKeys(workspaceId) {
    try {
        const rows = await db.query(
            `SELECT config FROM connecteurs WHERE workspace_id = $1 AND type = 'yalidine' AND actif = true`,
            [workspaceId]
        );
        if (!rows[0]) return null;
        const config = JSON.parse(rows[0].config || "{}");
        return { apiId: config.apiId, apiToken: config.apiToken };
    } catch {
        return null;
    }
}

async function track(trackingNumber, workspaceId) {
    try {
        const keys = workspaceId ? await getApiKeys(workspaceId) : null;
        if (!keys) return { success: false, error: "no_key", useUniversal: true };

        const res = await axios.get(
            `https://api.yalidine.app/v1/parcels/${trackingNumber}`,
            { headers: { "X-API-ID": keys.apiId, "X-API-TOKEN": keys.apiToken } }
        );
        return { success: true, data: res.data };
    } catch (err) {
        console.error("❌ Yalidine :", err.message);
        return { success: false, error: err.message };
    }
}

async function saveOrUpdateTracking({ orderId, trackingNumber, provider, status, destination, customerName, workspaceId }) {
    try {
        const existing = await db.query(`SELECT id FROM shipments WHERE tracking_number = $1`, [trackingNumber]);
        if (existing.length > 0) {
            await db.query(`UPDATE shipments SET status = $1, last_updated = NOW() WHERE id = $2`, [status, existing[0].id]);
            return { success: true, id: existing[0].id };
        }
        const created = await db.query(
            `INSERT INTO shipments (order_id, tracking_number, provider, status, destination, customer_name, workspace_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [String(orderId), trackingNumber, provider, status, destination || "DZ", customerName || "Inconnu", workspaceId || null]
        );
        return { success: true, id: created[0]?.id };
    } catch (err) {
        console.error("❌ shipments PostgreSQL :", err.message);
        return { success: false, error: err.message };
    }
}

async function receive(event) {
    await orchestrator.process({ type: "yalidine.update", shop: event.shop || "", payload: event });
}

module.exports = { send, receive, track, saveOrUpdateTracking, getApiKeys };
