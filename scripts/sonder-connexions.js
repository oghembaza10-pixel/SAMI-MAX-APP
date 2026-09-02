// ==========================================================================
// SONDER LES CONNEXIONS — META, INSTAGRAM, WHATSAPP
// ==========================================================================
//
//     node scripts/sonder-connexions.js
//
// ── POURQUOI CE SCRIPT EXISTE ─────────────────────────────────────────────
//
// Trois fois dans ce chantier, j'ai affirmé qu'une permission « n'était pas
// accordée » sans l'avoir vérifiée. C'était faux, et ça a envoyé chercher
// des autorisations déjà disponibles.
//
// Ce script demande à Meta CE QU'IL A RÉELLEMENT ACCORDÉ, plutôt que de le
// déduire d'une capture d'écran ou d'un souvenir. Il ne publie rien, ne
// modifie rien : uniquement des lectures.
//
// ── IL NE FAIT JAMAIS FUIR UN JETON ───────────────────────────────────────
//
// Les jetons vivent en base et dans l'environnement. Ce script en affiche la
// LONGUEUR et les quatre derniers caractères, jamais la valeur. Un jeton
// recopié dans un journal, une capture ou une conversation est un jeton à
// changer.

const db = require("../services/db");
const https = require("https");

const GRAPH = "https://graph.facebook.com/v25.0";

function empreinte(v) {
    const s = String(v || "").trim();
    if (!s) return "(absent)";
    return `${s.length} caractères, finit par …${s.slice(-4)}`;
}

// Une requête HTTPS qui ne lève jamais : une panne réseau ne doit pas
// masquer les résultats des autres sondes.
function lire(url) {
    return new Promise((resolve) => {
        const r = https.get(url, (res) => {
            let b = "";
            res.on("data", (d) => { b += d; });
            res.on("end", () => {
                let j = null;
                try { j = JSON.parse(b); } catch { /* réponse illisible */ }
                resolve({ code: res.statusCode, corps: j, brut: b.slice(0, 300) });
            });
        });
        r.on("error", (e) => resolve({ code: 0, erreur: e.message }));
        r.setTimeout(20000, () => { r.destroy(); resolve({ code: 0, erreur: "délai dépassé" }); });
    });
}

function titre(t) { console.log(`\n══════ ${t} ══════`); }

async function connecteur(workspaceId, type) {
    if (!workspaceId) return null;
    try {
        const rows = await db.query(
            `SELECT * FROM connecteurs WHERE workspace_id = $1 AND type = $2 LIMIT 1`,
            [workspaceId, type]);
        if (!rows.length) return null;
        const c = rows[0];
        let config = c.config;
        if (typeof config === "string") { try { config = JSON.parse(config); } catch { config = {}; } }
        return { actif: c.actif, config: config || {} };
    } catch (err) {
        console.log(`  ❌ lecture du connecteur ${type} : ${err.message}`);
        return null;
    }
}

// ── META : CE QUI EST VRAIMENT ACCORDÉ ────────────────────────────────────
//
// `/me/permissions` rend la liste avec, pour chacune, « granted » ou
// « declined ». C'est la seule réponse qui fasse autorité — l'écran du
// tableau de bord Meta montre ce qui est DEMANDÉ, pas ce qui est ACCORDÉ.
async function meta(workspaceId) {
    titre("META");
    const c = await connecteur(workspaceId, "facebook");
    if (!c) return console.log("  ⚠️  aucun connecteur « facebook » pour ce workspace");
    console.log(`  connecteur actif : ${c.actif}`);
    console.log(`  pageId           : ${c.config.pageId || "(absent)"}`);
    console.log(`  pageAccessToken  : ${empreinte(c.config.pageAccessToken)}`);
    const jeton = c.config.pageAccessToken;
    if (!jeton) return console.log("  ❌ sans jeton de page, rien n'est interrogeable");

    const perms = await lire(`${GRAPH}/me/permissions?access_token=${encodeURIComponent(jeton)}`);
    if (perms.code !== 200) {
        return console.log(`  ❌ HTTP ${perms.code} — ${perms.corps?.error?.message || perms.erreur || perms.brut}`);
    }
    const liste = perms.corps?.data || [];
    const accordees = liste.filter((p) => p.status === "granted").map((p) => p.permission);
    const refusees = liste.filter((p) => p.status !== "granted").map((p) => p.permission);
    console.log(`\n  ✅ ACCORDÉES (${accordees.length}) : ${accordees.join(", ") || "aucune"}`);
    if (refusees.length) console.log(`  ⛔ NON ACCORDÉES : ${refusees.join(", ")}`);

    // Celles dont SAMII a besoin, nommées une par une : « il manque une
    // permission » n'aide personne, « il manque pages_manage_posts » si.
    const requises = {
        pages_manage_posts: "publier sur la Page",
        pages_read_engagement: "lire les statistiques d'un post",
        pages_show_list: "trouver la Page",
        instagram_basic: "publier sur Instagram",
        instagram_manage_insights: "lire les statistiques Instagram",
    };
    console.log("\n  Ce dont SAMII a besoin :");
    for (const [p, quoi] of Object.entries(requises)) {
        console.log(`    ${accordees.includes(p) ? "✅" : "⛔"} ${p.padEnd(28)} ${quoi}`);
    }

    // Les Pages réellement administrées par ce jeton.
    const pages = await lire(`${GRAPH}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(jeton)}`);
    if (pages.code === 200) {
        const l = pages.corps?.data || [];
        console.log(`\n  Pages administrées (${l.length}) :`);
        for (const p of l) console.log(`    ${p.id}  ${p.name}  jeton: ${empreinte(p.access_token)}`);
    } else {
        console.log(`\n  ⚠️  /me/accounts : HTTP ${pages.code} — ${pages.corps?.error?.message || pages.erreur}`);
    }
}

// ── INSTAGRAM ─────────────────────────────────────────────────────────────
async function instagram(workspaceId) {
    titre("INSTAGRAM");
    const c = await connecteur(workspaceId, "instagram");
    if (!c) return console.log("  ⚠️  aucun connecteur « instagram » pour ce workspace");
    console.log(`  connecteur actif : ${c.actif}`);
    const id = c.config.igUserId || c.config.instagramId;
    console.log(`  compte IG        : ${id || "(absent)"}`);
    console.log(`  jeton            : ${empreinte(c.config.pageAccessToken)}`);
    if (!id || !c.config.pageAccessToken) return;

    const r = await lire(`${GRAPH}/${id}?fields=username,followers_count,media_count`
                       + `&access_token=${encodeURIComponent(c.config.pageAccessToken)}`);
    if (r.code === 200) {
        console.log(`  ✅ ${r.corps.username} — ${r.corps.followers_count} abonnés, ${r.corps.media_count} publications`);
    } else {
        console.log(`  ❌ HTTP ${r.code} — ${r.corps?.error?.message || r.erreur}`);
    }
}

// ── WHATSAPP ──────────────────────────────────────────────────────────────
//
// TROIS fournisseurs possibles, et ils ne se sondent pas pareil. Ma première
// version ne testait que Green API et concluait « instance supprimée » —
// une réponse juste sur le mauvais fournisseur, donc inutile.
//
//   cloud      l'API WhatsApp Cloud de META, en direct. Le WABA est à nous,
//              on parle au Graph avec un phoneNumberId et un jeton.
//   360dialog  même format de corps, autre hôte.
//   green      Green API : un téléphone appairé par QR code.
//
// `services/whatsappFournisseurs.js` sait déjà envoyer par les trois. Ce qui
// manquait, c'était de savoir LEQUEL est configuré et s'il répond.
async function whatsapp(workspaceId) {
    titre("WHATSAPP");
    const c = await connecteur(workspaceId, "whatsapp");
    const fournisseurs = require("../services/whatsappFournisseurs");
    const CONFIG = require("../config");

    let config = c?.config || {};
    let ou = "connecteur du marchand";

    if (!fournisseurs.estComplete(config)) {
        // Le canal partagé SAMII, toujours du Green API.
        config = { fournisseur: "green", apiId: CONFIG.WHATSAPP?.INSTANCE, apiToken: CONFIG.WHATSAPP?.API_KEY };
        ou = "canal partagé SAMII (variables d'environnement)";
    }

    const f = fournisseurs.fournisseurDe(config);
    console.log(`  source      : ${ou}`);
    console.log(`  fournisseur : ${f}`);

    if (!fournisseurs.estComplete(config)) {
        const attendus = fournisseurs.FOURNISSEURS[f]?.champs || [];
        console.log(`  ❌ configuration incomplète — il manque : `
                  + attendus.filter((x) => !config[x]).join(", "));
        console.log(`\n  Pour l'API Cloud de Meta, le connecteur doit porter :`);
        console.log(`     { "fournisseur": "cloud", "phoneNumberId": "…", "token": "…" }`);
        return;
    }

    // ── L'API CLOUD DE META ──────────────────────────────────────────────
    //
    // On interroge le numéro lui-même : s'il répond, le jeton est valide ET
    // le numéro appartient bien à ce WABA. `quality_rating` est le chiffre
    // qui compte vraiment — un numéro en RED est limité par Meta, et rien
    // dans l'application ne le dirait.
    if (f === "cloud" || f === "360dialog") {
        console.log(`  phoneNumberId : ${config.phoneNumberId}`);
        console.log(`  jeton         : ${empreinte(config.token)}`);
        const r = await lire(`${GRAPH}/${config.phoneNumberId}`
                           + `?fields=display_phone_number,verified_name,quality_rating,code_verification_status`
                           + `&access_token=${encodeURIComponent(config.token)}`);
        if (r.code !== 200) {
            return console.log(`  ❌ HTTP ${r.code} — ${r.corps?.error?.message || r.erreur || r.brut}`);
        }
        console.log(`  ✅ ${r.corps.display_phone_number} — « ${r.corps.verified_name} »`);
        console.log(`     qualité : ${r.corps.quality_rating}   vérification : ${r.corps.code_verification_status}`);
        if (String(r.corps.quality_rating).toUpperCase() === "RED") {
            console.log(`     ⛔ qualité RED : Meta limite ce numéro. Les envois seront bridés.`);
        }
        return;
    }

    // ── GREEN API ────────────────────────────────────────────────────────
    //
    // `getStateInstance` dit si le téléphone est réellement appairé.
    // « authorized » = ça marche. Tout le reste veut dire que rien ne partira,
    // même avec une configuration qui a l'air complète.
    console.log(`  instance    : ${config.apiId}`);
    console.log(`  jeton       : ${empreinte(config.apiToken)}`);
    const r = await lire(`https://api.green-api.com/waInstance${config.apiId}/getStateInstance/${config.apiToken}`);
    if (r.code !== 200) {
        return console.log(`  ❌ HTTP ${r.code} — ${r.corps?.message || r.erreur || r.brut}`);
    }
    console.log(`  état        : ${r.corps?.stateInstance}`);
    console.log(r.corps?.stateInstance === "authorized"
        ? "  ✅ le téléphone est appairé — WhatsApp peut envoyer"
        : "  ⛔ NON appairé : rien ne partira. Rescanne le QR dans Green API.");
}

// ── LE WORKSPACE EXISTE-T-IL SEULEMENT ? ──────────────────────────────────
//
// Sans ce contrôle, un identifiant erroné donnait « aucun connecteur
// facebook pour ce workspace » — un message qui envoie chercher un
// connecteur manquant alors que c'est l'IDENTIFIANT qui est faux.
//
// Vu en vrai : SOCIAL_WORKSPACE posée sans le préfixe « WS- ». Les trois
// sondes ont répondu « rien de configuré », et tout était configuré.
async function verifierWorkspace(workspaceId) {
    try {
        const r = await db.query(`SELECT nom FROM workspaces WHERE id = $1`, [workspaceId]);
        if (r.length) { console.log(`  ✅ trouvé : « ${r[0].nom} »`); return true; }

        console.log(`  ❌ AUCUN workspace ne porte cet identifiant.`);

        // L'erreur la plus probable, nommée explicitement.
        const avecPrefixe = await db.query(`SELECT id, nom FROM workspaces WHERE id = $1`,
                                           [`WS-${workspaceId}`]);
        if (avecPrefixe.length) {
            console.log(`\n  💡 « WS-${workspaceId} » existe (« ${avecPrefixe[0].nom} »).`);
            console.log(`     Le préfixe « WS- » manque dans SOCIAL_WORKSPACE.`);
            return false;
        }

        // Sinon : ceux qui ont des connecteurs sociaux, pour choisir sans SQL.
        const candidats = await db.query(
            `SELECT w.id, w.nom, count(c.id)::int AS n
               FROM workspaces w JOIN connecteurs c ON c.workspace_id = w.id
              WHERE c.actif AND c.type IN ('facebook','instagram','whatsapp','telegram')
              GROUP BY w.id, w.nom ORDER BY n DESC LIMIT 5`);
        if (candidats.length) {
            console.log(`\n  Workspaces qui ont des connecteurs sociaux actifs :`);
            for (const c of candidats) console.log(`     ${c.id}  « ${c.nom} »  ${c.n} connecteur(s)`);
        }
        return false;
    } catch (err) {
        console.log(`  ⚠️  vérification impossible : ${err.message}`);
        return true;   // on tente quand même les sondes
    }
}

(async () => {
    const workspaceId = process.env.SOCIAL_WORKSPACE || process.argv[2] || null;
    console.log(`workspace : ${workspaceId || "(SOCIAL_WORKSPACE non posée)"}`);
    if (!workspaceId) {
        console.log("Passe-le en argument : node scripts/sonder-connexions.js WS-xxxx");
        process.exit(1);
    }
    if (!(await verifierWorkspace(workspaceId))) {
        console.log("\nRien d'autre à sonder tant que l'identifiant n'est pas le bon.\n");
        process.exit(1);
    }
    try {
        await meta(workspaceId);
        await instagram(workspaceId);
        await whatsapp(workspaceId);
    } catch (err) {
        console.error("\n❌", err.message);
    }
    console.log("\nAucune publication, aucune modification : ce script ne fait que lire.\n");
    process.exit(0);
})();
