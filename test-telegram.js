// test-telegram.js — à la racine du projet
const telegram = require("./services/telegramService");

telegram.sendButtons("8930667710 ",
    "🧪 *Test SAMII OS*\nBoutons fonctionnels ?",
    [[
        { text: "✅ OUI", callback_data: "test_oui" },
        { text: "❌ NON", callback_data: "test_non" },
    ]]
).then(console.log).catch(console.error);
