// ======================================================
// brain/sovereign/tables.js
// Les 33 lois souveraines de SAMII — chargées depuis samii_lois
// (Supabase), mises en cache en mémoire (231 lois, contenu figé).
// ======================================================
const db = require("../../../services/db");

let cache = null;      // { T01: { titre_table, lois: [{titre_loi, texte, mots_cles}] }, ... }
let loading = null;    // Promise en cours, pour éviter les chargements concurrents

function normalizeKey(tableRef) {
    const n = parseInt(String(tableRef).replace("T-", ""), 10);
    return "T" + String(n).padStart(2, "0");
}

async function loadFromDb() {
    const rows = await db.query(
        `SELECT table_ref, titre_table, titre_loi, texte, mots_cles
         FROM samii_lois WHERE actif = true ORDER BY numero, id`
    );
    const grouped = {};
    for (const row of rows) {
        const key = normalizeKey(row.table_ref);
        if (!grouped[key]) grouped[key] = { titre_table: row.titre_table, lois: [] };
        grouped[key].lois.push({
            titre_loi: row.titre_loi,
            texte: row.texte,
            mots_cles: row.mots_cles || [],
        });
    }
    return grouped;
}

async function ensureLoaded() {
    if (cache) return cache;
    if (!loading) {
        loading = loadFromDb().catch(err => {
            console.error("❌ Chargement samii_lois :", err.message);
            loading = null;
            return null;
        });
    }
    cache = await loading;
    return cache;
}

// ── ROUTEUR INTELLIGENT (par sujet) ───────────────────────────────
const ROUTES = {
    business    : ["T04", "T20", "T23", "T31"],
    strategie   : ["T20", "T23", "T30", "T31", "T32"],
    personnel   : ["T02", "T06", "T08"],
    programmation: ["T04", "T06", "T17"],
    marketing   : ["T19", "T23", "T26", "T27"],
    finance     : ["T23", "T24", "T31"],
    logistique  : ["T12", "T17", "T29"],
    securite    : ["T09", "T21", "T22"],
    crm         : ["T03", "T06", "T19"],
    default     : ["T01", "T04", "T08", "T16", "T33"],
};

function detect(message) {
    const m = message.toLowerCase();

    // ── CE QUI EST EN PANNE PASSE AVANT CE QUI SE VEND ───────────────────
    //
    // MESURÉ, PAS SUPPOSÉ. « J'ai 20 commandes en retard » ressortait en
    // `business`, parce que le mot « commande » est sur la ligne du dessous
    // et que cette fonction rend à la première correspondance. SAMII
    // répondait donc par une stratégie de vente à quelqu'un qui est en train
    // de perdre ses clients par la livraison.
    //
    // Ce n'est pas un neuvième domaine : c'est un ORDRE. Une commande dont
    // on dit qu'elle est en retard, bloquée, non livrée ou en rupture n'est
    // pas un sujet commercial, c'est un sujet opérationnel — et l'urgence
    // n'est pas la même.
    //
    // Les mots retenus sont ceux qui ne veulent dire que ça : on ne dit pas
    // « en retard » d'une campagne publicitaire qui se vend bien.
    if (m.match(/en retard|retards?\b|bloqu|pas (encore )?(livr|re[çc]u)|non livr|jamais (re[çc]u|arriv)|rupture|stock (vide|epuis|épuis)|plus de stock|annul[ée]e?s? (par|pour) (le |la )?(livr|transport)/)) {
        return "logistique";
    }

    if (m.match(/vente|client|commande|shopify|boutique|produit/))  return "business";
    if (m.match(/stratégie|plan|vision|empire|objectif|croissance/)) return "strategie";
    if (m.match(/code|programme|javascript|node|api|bug|erreur/))   return "programmation";
    if (m.match(/pub|marketing|contenu|tiktok|instagram|meta/))     return "marketing";
    if (m.match(/argent|capital|investissement|finance|budget/))    return "finance";
    if (m.match(/livraison|transporteur|tracking|logistique/))      return "logistique";
    if (m.match(/sécurité|attaque|menace|protection/))              return "securite";
    if (m.match(/client|conversation|sav|message|whatsapp/))        return "crm";
    return "default";
}

// Parmi les 7 lois d'une table, choisit celle dont les mots-clés
// correspondent le mieux au message ; à défaut, la loi 1 (l'essence de la table).
function pickLaw(table, messageLower) {
    let best = table.lois[0];
    let bestScore = -1;
    for (const loi of table.lois) {
        const score = (loi.mots_cles || []).reduce(
            (acc, kw) => acc + (messageLower.includes(String(kw).toLowerCase()) ? 1 : 0),
            0
        );
        if (score > bestScore) { bestScore = score; best = loi; }
    }
    return best;
}

async function getTables(message) {
    const lois = await ensureLoaded();
    if (!lois) return "";

    const route = detect(message);
    const keys = ROUTES[route] || ROUTES.default;
    const messageLower = (message || "").toLowerCase();

    return keys
        .map(key => lois[key])
        .filter(Boolean)
        .map(table => {
            const loi = pickLaw(table, messageLower);
            return `${table.titre_table} — ${loi.titre_loi}\n${loi.texte}`;
        })
        .join("\n\n");
}

// `detect` est exporté pour que le choix automatique du niveau de réflexion
// (services/niveauAuto.js) réutilise CE routeur de domaine au lieu d'en
// écrire un second. Deux routeurs finiraient par ne plus classer le même
// message dans le même domaine, et personne ne saurait lequel fait foi.
module.exports = { getTables, detect };
