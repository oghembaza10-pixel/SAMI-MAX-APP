// Vérifie que CHARGILY_API_KEY fonctionne vraiment (crée un vrai checkout de
// test chez Chargily et affiche l'URL) avant de brancher un vrai parcours de
// paiement. Usage : node scripts/test-chargily.js
const chargily = require("../services/chargily");
const CONFIG = require("../config");

async function main() {
    if (!chargily.isEnabled()) {
        throw new Error("CHARGILY_API_KEY manquante — vérifie qu'elle est bien définie sur Render.");
    }

    // Diagnostic : affiche ce que Node a réellement chargé (clé masquée) pour
    // repérer un mauvais préfixe (pk_ au lieu de sk_), des espaces/guillemets
    // collés par erreur au copier-coller, ou un mode test/live mal réglé.
    const key = CONFIG.CHARGILY.API_KEY;
    console.log("── Diagnostic clé Chargily ──");
    console.log("Mode        :", CONFIG.CHARGILY.MODE);
    console.log("Longueur clé:", key.length, key !== key.trim() ? "⚠️ espaces en trop détectés !" : "(pas d'espace superflu)");
    console.log("Début clé   :", key.slice(0, 8) + "…");
    console.log("Fin clé     :", "…" + key.slice(-4));
    if (!key.startsWith("test_sk_") && !key.startsWith("sk_")) {
        console.log("⚠️  Ta clé ne commence pas par test_sk_ ou sk_ — c'est peut-être la PUBLIC key (test_pk_) collée par erreur dans CHARGILY_API_KEY.");
    }
    console.log("──────────────────────────────\n");

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
