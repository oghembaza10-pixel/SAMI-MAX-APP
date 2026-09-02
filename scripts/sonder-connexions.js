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

// ── WHATSAPP (GREEN API) ──────────────────────────────────────────────────
//
// `getStateInstance` dit si le téléphone est réellement appairé.
// « authorized » = ça marche. Tout le reste veut dire que WhatsApp n'enverra
// rien, même si la configuration a l'air complète.
async function whatsapp(workspaceId) {
    titre("WHATSAPP");
    const c = await connecteur(workspaceId, "whatsapp");
    const CONFIG = require("../config");
    const source = c?.config?.apiId
        ? { id: c.config.apiId, jeton: c.config.apiToken, ou: "connecteur du marchand" }
        : { id: CONFIG.WHATSAPP?.INSTANCE, jeton: CONFIG.WHATSAPP?.API_KEY, ou: "canal partagé SAMII" };

    console.log(`  source     : ${source.ou}`);
    console.log(`  instance   : ${source.id || "(absente)"}`);
    console.log(`  jeton      : ${empreinte(source.jeton)}`);
    if (!source.id || !source.jeton) return console.log("  ❌ instance ou jeton manquant — aucun envoi possible");

    const r = await lire(`https://api.green-api.com/waInstance${source.id}/getStateInstance/${source.jeton}`);
    if (r.code !== 200) {
        return console.log(`  ❌ HTTP ${r.code} — ${r.corps?.message || r.erreur || r.brut}`);
    }
    const etat = r.corps?.stateInstance;
    console.log(`  état       : ${etat}`);
    console.log(etat === "authorized"
        ? "  ✅ le téléphone est appairé — WhatsApp peut envoyer"
        : "  ⛔ NON appairé : rien ne partira. Rescanne le QR dans Green API.");
}

(async () => {
    const workspaceId = process.env.SOCIAL_WORKSPACE || process.argv[2] || null;
    console.log(`workspace : ${workspaceId || "(SOCIAL_WORKSPACE non posée)"}`);
    if (!workspaceId) {
        console.log("Passe-le en argument : node scripts/sonder-connexions.js WS-xxxx");
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
