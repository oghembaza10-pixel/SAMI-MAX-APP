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

// ── TROUVER LE WABA TOUT SEUL ────────────────────────────────────────────
//
// Trois identifiants se ressemblent dans la console Meta — le portefeuille
// (business_id de l'URL), le numéro d'envoi (PHONE_NUMBER_ID) et le compte
// WhatsApp (WABA) — et Meta ne dit jamais clairement lequel on lui a donné.
// Il répond « Unsupported get request » pour l'un, « (#100) Tried accessing
// nonexisting field » pour l'autre. On perd un quart d'heure par essai.
//
// Alors on arrête de demander. Le token SAIT à quels comptes il a droit :
// `debug_token` les liste dans ses portées granulaires. Et si on nous a
// donné un portefeuille, il porte la liste de ses comptes WhatsApp. On
// essaie donc, dans l'ordre, jusqu'à trouver — plutôt que de renvoyer
// quelqu'un chercher un numéro dans une console à cinq niveaux de menus.
async function trouverWaba(token, candidat) {
    const essais = [];

    // 1. Le candidat EST peut-être déjà un WABA : la seule preuve qui vaille,
    //    c'est qu'il réponde sur la liste des modèles.
    if (candidat) {
        try {
            await axios.get(`${GRAPH}/${candidat}/message_templates`, {
                params: { limit: 1, access_token: token }, timeout: 15000,
            });
            return { id: candidat, via: "fourni" };
        } catch (err) {
            essais.push(`« ${candidat} » n'est pas un compte WhatsApp : ${err.response?.data?.error?.message || err.message}`);
        }

        // 2. C'est peut-être un PORTEFEUILLE — c'est le cas le plus fréquent,
        //    parce que c'est le numéro visible dans l'URL. Un portefeuille
        //    porte la liste de ses comptes WhatsApp.
        for (const arete of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
            try {
                const r = await axios.get(`${GRAPH}/${candidat}/${arete}`, {
                    params: { limit: 25, access_token: token }, timeout: 15000,
                });
                const comptes = r.data?.data || [];
                if (comptes.length) {
                    return { id: comptes[0].id, via: `portefeuille ${candidat}`, tous: comptes };
                }
            } catch { /* on continue : ce n'était pas un portefeuille non plus */ }
        }
    }

    // 3. Le token lui-même sait à quoi il a droit. C'est la source la plus
    //    fiable : ce sont exactement les comptes sur lesquels on pourra
    //    vraiment travailler, pas ceux qu'on peut seulement nommer.
    try {
        const r = await axios.get(`${GRAPH}/debug_token`, {
            params: { input_token: token, access_token: token }, timeout: 15000,
        });
        const portees = r.data?.data?.granular_scopes || [];
        for (const p of portees) {
            if (/whatsapp_business_(messaging|management)/.test(p.scope) && p.target_ids?.length) {
                return { id: p.target_ids[0], via: "droits du token", tous: p.target_ids.map((id) => ({ id })) };
            }
        }
        essais.push("le token ne déclare aucun compte WhatsApp dans ses droits");
    } catch (err) {
        essais.push(`lecture des droits du token impossible : ${err.response?.data?.error?.message || err.message}`);
    }

    return { id: null, essais };
}

async function main() {
    const token = CONFIG.META?.WHATSAPP_CLOUD?.TOKEN;
    // En argument d'abord : on peut alors essayer un identifiant tout de
    // suite, sans poser une variable sur Render et attendre un redéploiement
    // pour découvrir qu'on s'est trompé de numéro.
    const candidat = (process.argv[2] || "").trim() || process.env.META_WABA_ID || "";

    if (!token) throw new Error("META_WHATSAPP_TOKEN absent — impossible d'interroger Meta.");

    // On ne demande plus le bon numéro : on le cherche. Un portefeuille, un
    // WABA, ou rien du tout — le token suffit dans le dernier cas.
    const trouve = await trouverWaba(token, candidat);
    if (!trouve.id) {
        throw new Error(
            "Aucun compte WhatsApp Business trouvé.\n\n"
            + trouve.essais.map((e) => `  • ${e}`).join("\n")
            + "\n\n  Le plus probable : le token système n'a pas encore le compte WhatsApp\n"
            + "  dans ses actifs. Business Settings → Utilisateurs système → votre\n"
            + "  utilisateur → Ajouter des actifs → Comptes WhatsApp → cocher le compte,\n"
            + "  droit « Gérer ». Sans ça, le token peut envoyer mais pas lire.",
        );
    }

    const wabaId = trouve.id;
    console.log(`Compte WhatsApp Business : ${wabaId}  (trouvé via ${trouve.via})`);
    if (trouve.tous && trouve.tous.length > 1) {
        console.log(`⚠️  ${trouve.tous.length} comptes disponibles : ${trouve.tous.map((c) => c.id).join(", ")}`);
        console.log(`   J'utilise le premier. Précisez-en un autre en argument si ce n'est pas le bon.`);
    }
    if (!process.env.META_WABA_ID) {
        console.log(`💡 À poser sur Render pour ne plus avoir à chercher : META_WABA_ID=${wabaId}`);
    }
    console.log("");

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
        if (/Unsupported get request|nonexisting field|does not exist|cannot be loaded/i.test(d)) {
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
