// ==========================================================================
// SAMII OS — Socket Service
// ==========================================================================

let _io = null;

module.exports = {
    init(io) {
        _io = io;
    },

    emitToShop(shop, event, data) {
        if (!_io) return console.warn("⚠️ Socket.IO non initialisé");
        if (!shop) return console.warn("⚠️ emitToShop : shop manquant");
        _io.to(shop).emit(event, data);
        console.log(`📡 Socket → [${shop}] ${event}`);
    },
};
