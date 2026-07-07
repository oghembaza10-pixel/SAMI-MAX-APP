// =========================
// Google
// =========================
registry.register("google", require("./google"));
registry.register("gmail", require("./gmail"));
registry.register("calendar", require("./googleCalendar"));
registry.register("maps", require("./googleMaps"));

// =========================
// Stockage
// =========================
registry.register("airtable", require("./airtable"));

// =========================
// Paiement
// =========================
registry.register("paypal", require("./paypal"));
registry.register("stripe", require("./stripe"));

// =========================
// Commerce
// =========================
registry.register("shopify", require("./shopify"));

// =========================
// Réseaux sociaux
// =========================
registry.register("meta", require("./meta"));
registry.register("facebook", require("./facebook"));
registry.register("instagram", require("./instagram"));
registry.register("whatsapp", require("./whatsapp"));
registry.register("telegram", require("./telegram"));

// =========================
// Livraison
// =========================
registry.register("yalidine", require("./yalidine"));
registry.register("guepex", require("./guepex"));
registry.register("zr", require("./zr"));
registry.register("ems", require("./ems"));

// =========================
// Intelligence Artificielle
// =========================
registry.register("gemini", require("./gemini"));
registry.register("openai", require("./openai"));
registry.register("mistral", require("./mistral"));
registry.register("nvidia", require("./nvidia"));
registry.register("ollama", require("./ollama"));

module.exports = registry;
