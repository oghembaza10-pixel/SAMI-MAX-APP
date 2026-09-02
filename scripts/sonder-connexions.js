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

// Le motif d'une réponse ratée, qui ne dit JAMAIS « undefined ».
// Meta répond parfois du JSON structuré, parfois du texte brut (un proxy,
// une page d'erreur). Un motif vide envoie chercher à l'aveugle — et c'est
// exactement ce qu'une sonde de diagnostic ne doit pas faire.
function motif(r) {
    return r?.corps?.error?.message
        || r?.corps?.message
        || r?.erreur
        || (r?.brut && String(r.brut).trim())
        || "aucun détail rendu";
}

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

// ── META ──────────────────────────────────────────────────────────────────
//
// ── L'ERREUR QUE CETTE FONCTION A FAITE, ET CE QU'ELLE APPREND ────────────
//
// Première version : `/me/permissions` avec le jeton de PAGE. Meta a répondu
//
//     (#100) Tried accessing nonexisting field (permissions)
//
// et c'est logique. Un jeton de Page fait de `/me` la PAGE elle-même, et une
// Page n'a pas de champ `permissions` — ce champ appartient à l'UTILISATEUR.
// Deux jetons différents, deux questions différentes :
//
//   jeton UTILISATEUR (workspaces.meta_access_token)
//       « qu'est-ce que la personne a accordé à l'app ? » → /me/permissions
//
//   jeton de PAGE (connecteurs.config.pageAccessToken)
//       « qu'est-ce que je peux faire sur CETTE page ? » → /{pageId}
//
// Le second est celui qui publie. On sonde donc les deux, séparément.
async function meta(workspaceId) {
    titre("META");
    const c = await connecteur(workspaceId, "facebook");
    if (!c) return console.log("  ⚠️  aucun connecteur « facebook » pour ce workspace");

    console.log(`  connecteur actif : ${c.actif}`);
    console.log(`  pageId           : ${c.config.pageId || "(absent)"}`);
    console.log(`  jeton de page    : ${empreinte(c.config.pageAccessToken)}`);

    // ── 1. LE JETON UTILISATEUR : CE QUI A ÉTÉ ACCORDÉ ───────────────────
    let jetonUtilisateur = null;
    try {
        const w = await db.query(`SELECT meta_access_token FROM workspaces WHERE id = $1`, [workspaceId]);
        jetonUtilisateur = w[0]?.meta_access_token || null;
    } catch { /* colonne absente sur une base ancienne */ }

    console.log(`  jeton utilisateur: ${empreinte(jetonUtilisateur)}`);

    if (jetonUtilisateur) {
        const perms = await lire(`${GRAPH}/me/permissions?access_token=${encodeURIComponent(jetonUtilisateur)}`);
        if (perms.code === 200) {
            const liste = perms.corps?.data || [];
            const accordees = liste.filter((x) => x.status === "granted").map((x) => x.permission);
            const refusees = liste.filter((x) => x.status !== "granted").map((x) => x.permission);
            console.log(`\n  ✅ ACCORDÉES (${accordees.length}) : ${accordees.join(", ") || "aucune"}`);
            if (refusees.length) console.log(`  ⛔ REFUSÉES : ${refusees.join(", ")}`);

            // Nommées une par une : « il manque une permission » n'aide
            // personne, « il manque pages_manage_posts » si.
            const requises = {
                pages_manage_posts: "publier sur la Page",
                pages_read_engagement: "lire les statistiques d'un post",
                pages_show_list: "trouver la Page",
                instagram_basic: "publier sur Instagram",
                instagram_manage_insights: "lire les statistiques Instagram",
            };
            console.log("\n  Ce dont SAMII a besoin :");
            for (const [k, quoi] of Object.entries(requises)) {
                console.log(`    ${accordees.includes(k) ? "✅" : "⛔"} ${k.padEnd(28)} ${quoi}`);
            }
        } else {
            console.log(`  ⚠️  /me/permissions : HTTP ${perms.code} — `
                      + `${motif(perms)}`);
        }
    } else {
        console.log(`  ⚠️  aucun jeton utilisateur en base (workspaces.meta_access_token)`);
        console.log(`      → la liste des permissions accordées n'est pas lisible.`);
        console.log(`      Reconnecte Meta depuis le QG pour l'enregistrer.`);
    }

    // ── 2. LE JETON DE PAGE : EST-CE QU'IL MARCHE ? ──────────────────────
    //
    // C'est LUI qui publie. On interroge la Page directement — pas `/me`,
    // qui prête à confusion selon le type de jeton.
    if (!c.config.pageAccessToken || !c.config.pageId) {
        return console.log("\n  ❌ sans pageId ET jeton de page, aucune publication n'est possible");
    }
    const page = await lire(`${GRAPH}/${c.config.pageId}`
                          + `?fields=name,category,fan_count,link`
                          + `&access_token=${encodeURIComponent(c.config.pageAccessToken)}`);
    if (page.code === 200) {
        console.log(`\n  ✅ Page joignable : « ${page.corps.name} » — ${page.corps.fan_count} abonnés`);
        console.log(`     ${page.corps.link || ""}`);
    } else {
        console.log(`\n  ❌ Page injoignable : HTTP ${page.code} — `
                  + `${motif(page)}`);
        return;
    }

    // Le jeton de page porte ses propres permissions : c'est la réponse
    // définitive à « est-ce que SAMII peut publier ». Elle vit dans
    // `/me/permissions` côté utilisateur, mais le champ `tasks` de la Page
    // dit ce que CE jeton a le droit de faire.
    const taches = await lire(`${GRAPH}/${c.config.pageId}?fields=tasks`
                            + `&access_token=${encodeURIComponent(c.config.pageAccessToken)}`);
    if (taches.code === 200 && Array.isArray(taches.corps?.tasks)) {
        const t = taches.corps.tasks;
        console.log(`     tâches autorisées : ${t.join(", ")}`);
        console.log(t.includes("CREATE_CONTENT")
            ? "     ✅ CREATE_CONTENT présent — ce jeton peut publier"
            : "     ⛔ CREATE_CONTENT absent — ce jeton ne peut PAS publier");
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
        console.log(`  ❌ HTTP ${r.code} — ${motif(r)}`);
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
            return console.log(`  ❌ HTTP ${r.code} — ${motif(r)}`);
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
        return console.log(`  ❌ HTTP ${r.code} — ${motif(r)}`);
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
