// ==========================================================================
// SAMII OS — Ce que Meta déclare vraiment, comparé à ce que le code croit
//
// POURQUOI CE SCRIPT EXISTE.
//
// Le texte des modèles vit chez Meta, pas ici. Nous n'envoyons qu'un nom et
// un tableau de valeurs ordonné. Deux erreurs sont donc possibles, et
// aucune des deux ne se voit depuis le code :
//
//   LE NOM — mal orthographié, ou le modèle a été refusé, renommé, supprimé.
//   L'envoi échoue. C'est le cas le moins grave : il laisse une trace.
//
//   L'ORDRE DES VARIABLES — le code envoie [montant, prenom] là où le modèle
//   attend [prenom, montant]. Meta ACCEPTE (les deux sont du texte) et le
//   client reçoit « Bonjour 15 000 FCFA, votre commande Marlyse est
//   confirmée ». Aucune erreur nulle part. On ne l'apprend que par un
//   marchand humilié devant son client.
//
// Ce script demande la liste à Meta et la compare au catalogue
// (config/modeles-whatsapp.js). Il ne consomme aucun quota de message : il
// lit, il n'envoie rien.
//
// Usage :  node scripts/test-whatsapp.js
// ==========================================================================
const axios = require("axios");
const CONFIG = require("../config");
const catalogue = require("../config/modeles-whatsapp");

const GRAPH = "https://graph.facebook.com/v23.0";

// Compte le nombre de variables réellement déclarées dans le corps d'un
// modèle : c'est {{1}}, {{2}}... dans le texte approuvé, la seule source de
// vérité sur ce que Meta attend.
function variablesDuCorps(composants = []) {
    const corps = composants.find((c) => c.type === "BODY");
    if (!corps?.text) return 0;
    const trouvees = [...String(corps.text).matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    return trouvees.length ? Math.max(...trouvees) : 0;
}

function variablesDuBouton(composants = []) {
    const boutons = composants.find((c) => c.type === "BUTTONS");
    if (!boutons?.buttons) return 0;
    let n = 0;
    for (const b of boutons.buttons) {
        const trouvees = [...String(b.url || "").matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
        if (trouvees.length) n = Math.max(n, ...trouvees);
    }
    return n;
}

async function main() {
    const token = CONFIG.META?.WHATSAPP_CLOUD?.TOKEN;
    // En argument d'abord : on peut alors essayer un identifiant tout de
    // suite, sans poser une variable sur Render et attendre un redéploiement
    // pour découvrir qu'on s'est trompé de numéro.
    const wabaId = (process.argv[2] || "").trim() || process.env.META_WABA_ID;

    if (!token) throw new Error("META_WHATSAPP_TOKEN absent — impossible d'interroger Meta.");
    if (!wabaId) {
        throw new Error(
            "Identifiant du compte WhatsApp Business (WABA) manquant.\n\n"
            + "  Essayez tout de suite, sans rien poser sur Render :\n"
            + "      node scripts/test-whatsapp.js <WABA_ID>\n\n"
            + "  OÙ LE TROUVER — c'est un numéro à part, et trois identifiants\n"
            + "  se ressemblent ici :\n"
            + "    • business_id=… dans l'URL  → le PORTEFEUILLE Business Manager. Ce n'est PAS lui.\n"
            + "    • PHONE_NUMBER_ID           → le numéro d'envoi. Ce n'est pas lui non plus.\n"
            + "    • WABA ID                   → celui-ci. Gestionnaire WhatsApp →\n"
            + "      Paramètres du compte, ligne « Identifiant du compte WhatsApp Business ».\n"
            + "      Ou : developers.facebook.com → votre app → WhatsApp → Configuration de l'API,\n"
            + "      champ « WhatsApp Business Account ID ».\n\n"
            + "  Une fois le bon trouvé, posez-le sur Render : META_WABA_ID",
        );
    }

    let modelesMeta = [];
    try {
        const r = await axios.get(`${GRAPH}/${wabaId}/message_templates`, {
            params: { limit: 200, access_token: token },
            timeout: 20000,
        });
        modelesMeta = r.data?.data || [];
    } catch (err) {
        const meta = err.response?.data?.error || {};
        const d = meta.message || err.message;
        // Meta répond la même chose — « Unsupported get request » — qu'on lui
        // donne un identifiant de portefeuille, un identifiant de numéro, ou
        // un WABA auquel le token n'a pas droit. Trois causes, un seul
        // message : sans cette explication, on tourne en rond à changer le
        // token alors que c'est l'identifiant qui est faux.
        if (/Unsupported get request|does not exist|cannot be loaded/i.test(d)) {
            throw new Error(
                `Meta ne reconnaît pas « ${wabaId} » comme un compte WhatsApp Business.\n\n`
                + `  Trois causes possibles, et Meta ne les distingue pas :\n`
                + `    1. C'est un identifiant de PORTEFEUILLE (business_id de l'URL), pas un WABA.\n`
                + `    2. C'est le PHONE_NUMBER_ID, qui désigne le numéro et non le compte.\n`
                + `    3. C'est le bon WABA, mais le token système n'a pas accès à ce compte\n`
                + `       (Business Settings → Utilisateurs système → Ajouter des actifs →\n`
                + `        cocher le compte WhatsApp, droit « Gérer »).\n\n`
                + `  Message brut de Meta : ${d}`,
            );
        }
        throw new Error(`Meta a refusé la lecture des modèles : ${d}`);
    }

    console.log(`── ${modelesMeta.length} modèle(s) déclaré(s) chez Meta ──\n`);

    const parNom = {};
    for (const m of modelesMeta) parNom[m.name] = m;

    // ── 1. Ce que Meta a, et que le code ignore ──────────────────────────
    for (const m of modelesMeta) {
        const connu = Object.values(catalogue.MODELES).some((c) => c.nom === m.name);
        const varsCorps = variablesDuCorps(m.components);
        const varsBouton = variablesDuBouton(m.components);
        const etat = m.status === "APPROVED" ? "✅" : (m.status === "PENDING" ? "⏳" : "❌");
        console.log(
            `${etat} ${m.name.padEnd(26)} ${String(m.category || "?").padEnd(10)} ${String(m.language || "?").padEnd(6)}`
            + ` ${varsCorps} variable(s)${varsBouton ? ` + ${varsBouton} bouton` : ""}`
            + (connu ? "" : "   ← non déclaré dans le catalogue"),
        );
    }

    // ── 2. Ce que le code croit, et que Meta contredit ───────────────────
    console.log(`\n── Le catalogue face à la réalité ──\n`);
    const problemes = [];

    for (const [cle, c] of Object.entries(catalogue.MODELES)) {
        const chezMeta = parNom[c.nom];

        if (!chezMeta) {
            problemes.push(`« ${c.nom} » n'existe pas chez Meta — tout envoi qui l'utilise échouera.`);
            console.log(`❌ ${c.nom.padEnd(26)} introuvable chez Meta`);
            continue;
        }
        if (chezMeta.status !== "APPROVED") {
            problemes.push(`« ${c.nom} » n'est pas approuvé (${chezMeta.status}) — il ne partira pas.`);
            console.log(`⏳ ${c.nom.padEnd(26)} statut ${chezMeta.status}`);
            continue;
        }

        const attendues = variablesDuCorps(chezMeta.components);
        const declarees = c.variables.length;

        if (attendues !== declarees) {
            // C'EST L'ERREUR QUI NE SE VOIT PAS. Meta accepte n'importe quel
            // texte dans n'importe quelle variable : il ne dira jamais qu'on
            // s'est trompé d'ordre. Seul ce décompte peut l'attraper avant le
            // client.
            problemes.push(
                `« ${c.nom} » : Meta attend ${attendues} variable(s), le code en envoie ${declarees} `
                + `(${c.variables.join(", ")}). Les valeurs partiront décalées et le client lira n'importe quoi.`,
            );
            console.log(`❌ ${c.nom.padEnd(26)} ${declarees} envoyée(s) ≠ ${attendues} attendue(s)`);
            continue;
        }

        if (c.categorie && chezMeta.category && c.categorie !== chezMeta.category) {
            console.log(`⚠️  ${c.nom.padEnd(26)} catégorie ${chezMeta.category} chez Meta, ${c.categorie} dans le code`);
        } else {
            console.log(`✅ ${c.nom.padEnd(26)} ${declarees} variable(s) — d'accord avec Meta`);
        }

        // Un message transactionnel classé MARKETING n'arrive pas chez un
        // client qui a refusé la publicité. Pour une confirmation de
        // commande, c'est le message le plus important qui disparaît.
        if (chezMeta.category === "MARKETING" && /commande|livr|paiement/i.test(c.nom)) {
            console.log(`   ⚠️  classé MARKETING : un client ayant refusé la pub ne le recevra JAMAIS.`);
            console.log(`      Demandez le passage en UTILITY (⋯ → Modifier la catégorie).`);
        }
    }

    console.log(`\n──────────────────────────────`);
    if (problemes.length) {
        console.log(`${problemes.length} problème(s) :\n`);
        for (const p of problemes) console.log(`  • ${p}`);
        process.exitCode = 1;
    } else {
        console.log(`Le catalogue et Meta sont d'accord.`);
    }
}

main().catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
});
