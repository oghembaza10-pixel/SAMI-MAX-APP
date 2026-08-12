// Vérifie que CHARGILY_API_KEY fonctionne vraiment (crée un vrai checkout de
// test chez Chargily et affiche l'URL) avant de brancher un vrai parcours de
// paiement. Usage : node scripts/test-chargily.js
const chargily = require("../services/chargily");

async function main() {
    if (!chargily.isEnabled()) {
        throw new Error("CHARGILY_API_KEY manquante — vérifie qu'elle est bien définie sur Render.");
    }

    const result = await chargily.createCheckout({
        amount: 100,
        currency: "dzd",
        description: "Test SAMII OS — vérification clé Chargily",
        successUrl: "https://samii.souverain-store.com/",
        failureUrl: "https://samii.souverain-store.com/",
    });

    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
        console.log(`\n✅ Clé valide. Ouvre cette URL pour voir la page de paiement Chargily (test) :\n${result.checkoutUrl}`);
    } else {
        console.log(`\n❌ Échec — vérifie la clé et le mode (test/live) : ${result.error}`);
    }
}

main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
});
