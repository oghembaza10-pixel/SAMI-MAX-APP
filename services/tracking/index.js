// ==========================================================================
// SAMII OS — TRACKING REGISTRY — interface universelle multi-transporteurs
// ==========================================================================
const providers = {};

function register(id, module) {
    providers[id] = module;
}

async function checkStatus(providerId, trackingNumber, workspaceId) {
    const provider = providers[providerId];
    if (!provider) {
        return { success: false, error: `Transporteur inconnu : ${providerId}` };
    }
    return await provider.checkStatus(trackingNumber, workspaceId);
}

function list() {
    return Object.keys(providers);
}

module.exports = { register, checkStatus, list };
