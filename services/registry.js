registry.register("google", require("./google"));
registry.register("gmail", require("./gmail"));
registry.register("calendar", require("./googleCalendar"));
registry.register("maps", require("./googleMaps"));

registry.register("paypal", require("./paypal"));
registry.register("stripe", require("./stripe"));

registry.register("yalidine", require("./yalidine"));
registry.register("guepex", require("./guepex"));
registry.register("zr", require("./zr"));
registry.register("ems", require("./ems"));
registry.register("gemini", require("./gemini"));
registry.register("openai", require("./openai"));
registry.register("mistral", require("./mistral"));
registry.register("nvidia", require("./nvidia"));
registry.register("ollama", require("./ollama"));
