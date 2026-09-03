// ==========================================================================
// LE SOCLE COMMUN DES AGENTS
// ==========================================================================
//
// Trois choses que les sept agents font tous, et qu'aucun ne doit
// réimplémenter à sa façon :
//
//   1. se laisser couper           (« possibilité de désactiver chaque agent »)
//   2. laisser une trace           (« logs des actions des agents »)
//   3. demander quelque chose à SAMII, et ne pas tomber si elle ne répond pas
//
// ── POURQUOI UN ENVELOPPEUR ET PAS UNE CLASSE ─────────────────────────────
//
// `executer()` prend une fonction et lui met une ceinture : chronomètre,
// trace en base, capture des erreurs. Un agent qui oublie de tracer devient
// impossible — il ne peut pas s'exécuter sans passer par là.

const store = require("../../../services/socialStore");
const gemini = require("../../../services/geminiService");

// ── COUPER UN AGENT DEPUIS RENDER ─────────────────────────────────────────
//
// Lu à chaque appel, pas au chargement : couper le créateur de contenu un
// dimanche soir doit prendre effet, pas attendre un déploiement.
//
//     SOCIAL_AGENTS_COUPES=creator,publisher
function estCoupe(agent) {
    const coupes = String(process.env.SOCIAL_AGENTS_COUPES || "")
        .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return coupes.includes(String(agent || "").toLowerCase());
}

// ── EXÉCUTER UN AGENT ─────────────────────────────────────────────────────
//
// Ne LÈVE jamais. Un agent qui échoue rend `{ ok:false, erreur }` : la
// chaîne décide alors de s'arrêter, pas le moteur qui la porte. Une
// exception qui remonterait ici arrêterait toute la file de publication
// parce qu'un seul post a mal tourné.
async function executer(agent, { workspaceId, postId, entree }, travail) {
    if (estCoupe(agent)) {
        return { ok: false, coupe: true, erreur: `agent « ${agent} » coupé (SOCIAL_AGENTS_COUPES)` };
    }
    const debut = Date.now();
    try {
        const sortie = await travail();
        await store.tracerAgent({
            agent, workspaceId, postId, statut: "ok",
            entree, sortie: resumerPourLaTrace(sortie), dureeMs: Date.now() - debut,
        });
        return { ok: true, ...sortie };
    } catch (err) {
        await store.tracerAgent({
            agent, workspaceId, postId, statut: "erreur",
            entree, erreur: err.message, dureeMs: Date.now() - debut,
        });
        console.error(`❌ Agent ${agent} :`, err.message);
        return { ok: false, erreur: err.message };
    }
}

// ── CE QU'ON GARDE DANS LA TRACE ──────────────────────────────────────────
//
// La sortie complète d'un agent peut peser plusieurs kilo-octets (sept
// variantes de texte). Multiplié par chaque exécution, la table de traces
// devient plus grosse que les données elles-mêmes.
//
// Et surtout : une trace ne doit JAMAIS contenir de jeton. Les agents n'en
// manipulent pas — les providers seuls le font — mais si un jour l'un d'eux
// remonte une configuration de connecteur par erreur, cette coupe l'empêche
// d'atterrir en base.
function resumerPourLaTrace(sortie) {
    if (!sortie || typeof sortie !== "object") return null;
    const propre = {};
    for (const [cle, valeur] of Object.entries(sortie)) {
        // Rien qui ressemble à un secret n'entre dans la trace, jamais.
        if (/token|secret|password|apikey|api_key|access/i.test(cle)) { propre[cle] = "[masqué]"; continue; }
        if (typeof valeur === "string") { propre[cle] = valeur.slice(0, 500); continue; }
        if (Array.isArray(valeur)) { propre[cle] = `[${valeur.length} éléments]`; continue; }
        propre[cle] = valeur;
    }
    return propre;
}

// ── DEMANDER À SAMII ──────────────────────────────────────────────────────
//
// Le même appel que celui déjà utilisé par `autopostEngine` et
// `canalEngine` — pas un deuxième chemin vers le moteur.
//
// `useTools: false` : on veut du texte, pas que SAMII décide d'appeler un
// outil au milieu de la rédaction d'une légende.
// ── UNE NON-RÉPONSE N'EST PAS UN TEXTE ────────────────────────────────────
//
// `gemini.chat()` rend une phrase d'excuse quand plus aucun fournisseur ne
// répond, parce que c'est ce qu'il faut dire à un client dans une
// conversation. Un agent, lui, doit LEVER : sinon la phrase descend la
// chaîne, personne n'arrive à la lire, et l'échec est imputé au maillon
// suivant. C'est exactement ce qui s'est produit le 3 septembre — trace
// `creator/erreur` : « le créateur n'a pas produit de contenu exploitable »,
// alors qu'il n'avait rien reçu du tout.
//
// La distinction se fait sur le drapeau `degrade` posé par geminiService, et
// PAS sur le texte de la phrase : comparer des phrases, c'est se condamner à
// oublier la comparaison le jour où la phrase change.
async function demander(message, { workspaceId, source } = {}) {
    const r = await gemini.chat({
        message,
        context: { source: source || "social-agents", workspaceId, audience: "souverain" },
        useTools: false,
    });
    if (r?.degrade) throw new Error(`aucune réponse de l'IA — ${r.motif || "chaîne épuisée"}`);
    // `useTools:false` est passé juste au-dessus : un appel d'outil ici veut
    // dire que le moteur n'a pas respecté la consigne. Le taire rendrait ""
    // et ferait accuser l'agent d'avoir mal écrit.
    if (r?.type !== "text") throw new Error(`l'IA a répondu « ${r?.type || "rien"} » au lieu d'un texte`);
    const texte = String(r.text || "").trim();
    if (!texte) throw new Error("l'IA a renvoyé un texte vide");
    return texte;
}

// ── LIRE DU JSON QUE L'IA A ÉCRIT ─────────────────────────────────────────
//
// Les modèles enrobent régulièrement leur JSON dans ```json … ``` malgré la
// consigne, ou ajoutent une phrase avant. `autopostEngine` avait déjà son
// `extractJson` pour ça ; on refait le même geste plutôt que d'importer un
// moteur entier pour une fonction de trois lignes.
//
// Rend `null` si rien n'est lisible — JAMAIS un objet vide qui laisserait
// croire que l'IA a répondu quelque chose.
function lireJson(texte) {
    if (!texte) return null;
    const nettoye = String(texte).replace(/```json/gi, "").replace(/```/g, "").trim();
    try { return JSON.parse(nettoye); } catch { /* on tente plus loin */ }
    // Un objet ou un tableau au milieu d'une phrase.
    const debut = nettoye.search(/[[{]/);
    if (debut < 0) return null;
    const fin = Math.max(nettoye.lastIndexOf("}"), nettoye.lastIndexOf("]"));
    if (fin <= debut) return null;
    try { return JSON.parse(nettoye.slice(debut, fin + 1)); } catch { return null; }
}

module.exports = { executer, estCoupe, demander, lireJson, resumerPourLaTrace };
