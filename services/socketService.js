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

    // Même mécanisme qu'emitToShop, nom générique — utilisé pour des salons
    // qui ne sont pas un workspace (ex: "livreurs-online", rejoint côté
    // client avec le même event "join" déjà géré dans index.js).
    emitToRoom(room, event, data) {
        if (!_io) return console.warn("⚠️ Socket.IO non initialisé");
        if (!room) return console.warn("⚠️ emitToRoom : room manquant");
        _io.to(room).emit(event, data);
        console.log(`📡 Socket → [${room}] ${event}`);
    },
};
