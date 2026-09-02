// ==========================================================================
// L'ACCÈS BASE DES AGENTS SOCIAUX
// ==========================================================================
//
// ── POURQUOI LES AGENTS N'ÉCRIVENT PAS DE SQL ─────────────────────────────
//
// Sept agents qui écriraient chacun leurs requêtes, ce sont sept endroits
// où l'on peut oublier `WHERE communaute = $1`. Ce dépôt a déjà connu cette
// fuite cinq fois — du contenu d'une communauté apparaissant chez une autre.
//
// Tout passe donc par ici. Le cloisonnement par communauté et par espace de
// travail est appliqué à UN seul endroit, celui-ci.

const db = require("./db");
const crypto = require("crypto");

// ── L'EMPREINTE ANTI-DOUBLON ──────────────────────────────────────────────
//
// « empêcher les publications dupliquées ».
//
// Comparer deux textes mot à mot laisse passer « Livraison gratuite ! » et
// « Livraison gratuite !! ». On normalise donc avant de hacher : minuscules,
// accents retirés, ponctuation et espaces effacés. Deux textes qui ne
// diffèrent que par la forme donnent la même empreinte, et la base refuse
// le second — par un index unique, pas par une vérification que du code
// pourrait sauter.
function empreinte(texte) {
    const normalise = String(texte || "")
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")   // é → e
        .replace(/[^a-z0-9]/g, "");
    if (!normalise) return null;
    return crypto.createHash("sha256").update(normalise).digest("hex").slice(0, 32);
}

// ── LES STATUTS ───────────────────────────────────────────────────────────
//
// Écrits ici une fois, importés partout. Une chaîne de caractères recopiée
// dans sept fichiers, c'est une faute de frappe qui crée un statut fantôme
// qu'aucun écran n'affiche.
const STATUTS = ["draft", "review", "approved", "scheduled", "publishing", "published", "failed", "cancelled"];
const MODES = ["MANUAL", "SEMI_AUTO", "AUTO"];

function statutValide(s) { return STATUTS.includes(s); }
function modeValide(m) { return MODES.includes(m); }

// ── LES POSTS ─────────────────────────────────────────────────────────────

async function creerPost({ workspaceId, communaute, titre, contenu, objectif, theme, mode, creePar }) {
    const emp = empreinte(contenu);
    try {
        const rows = await db.query(
            `INSERT INTO social_posts
                (workspace_id, communaute, titre, contenu, objectif, theme, empreinte, mode, cree_par, statut)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft')
             RETURNING *`,
            [workspaceId || null, communaute || "samii", titre || null, contenu || null,
             objectif || null, theme || null, emp,
             modeValide(mode) ? mode : "MANUAL", creePar || null]
        );
        return { ok: true, post: rows[0] };
    } catch (err) {
        // 23505 = violation d'unicité. C'est l'index anti-doublon qui a
        // parlé, et c'est un refus attendu, pas une panne : on le traduit en
        // message clair plutôt qu'en « erreur serveur ».
        if (err.code === "23505") {
            return { ok: false, doublon: true, erreur: "Ce contenu existe déjà pour cet espace." };
        }
        throw err;
    }
}

async function getPost(id, { communaute } = {}) {
    const rows = communaute
        ? await db.query(`SELECT * FROM social_posts WHERE id = $1 AND COALESCE(communaute,'samii') = $2`, [id, communaute])
        : await db.query(`SELECT * FROM social_posts WHERE id = $1`, [id]);
    return rows[0] || null;
}

async function listerPosts({ workspaceId, communaute, statut, limite = 50 }) {
    const conditions = ["COALESCE(communaute,'samii') = $1"];
    const params = [communaute || "samii"];
    if (workspaceId) { params.push(workspaceId); conditions.push(`workspace_id = $${params.length}`); }
    if (statut)      { params.push(statut);      conditions.push(`statut = $${params.length}`); }
    params.push(Math.min(Number(limite) || 50, 200));
    return db.query(
        `SELECT * FROM social_posts WHERE ${conditions.join(" AND ")}
          ORDER BY created_at DESC LIMIT $${params.length}`, params);
}

async function majStatutPost(id, statut) {
    if (!statutValide(statut)) throw new Error(`statut inconnu : ${statut}`);
    const rows = await db.query(
        `UPDATE social_posts SET statut = $2, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, statut]);
    return rows[0] || null;
}

// ── LES VARIANTES ─────────────────────────────────────────────────────────

async function enregistrerVariante({ postId, plateforme, texte, hashtags, cta, mediaUrl, mediaType }) {
    // ON CONFLICT : réadapter un post déjà adapté doit REMPLACER la variante,
    // pas en créer une deuxième pour la même plateforme. Sans ça, on
    // publierait deux fois sur Instagram.
    const rows = await db.query(
        `INSERT INTO social_post_variants
            (post_id, plateforme, texte, hashtags, cta, media_url, media_type, statut)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'draft')
         ON CONFLICT (post_id, plateforme) DO UPDATE
            SET texte = EXCLUDED.texte, hashtags = EXCLUDED.hashtags, cta = EXCLUDED.cta,
                media_url = EXCLUDED.media_url, media_type = EXCLUDED.media_type,
                statut = 'draft', revue = NULL
         RETURNING *`,
        [postId, plateforme, texte || null, hashtags || null, cta || null, mediaUrl || null, mediaType || null]);
    return rows[0];
}

async function listerVariantes(postId) {
    return db.query(`SELECT * FROM social_post_variants WHERE post_id = $1 ORDER BY plateforme`, [postId]);
}

async function getVariante(id) {
    const rows = await db.query(`SELECT * FROM social_post_variants WHERE id = $1`, [id]);
    return rows[0] || null;
}

async function majVariante(id, { statut, revue }) {
    if (statut && !statutValide(statut)) throw new Error(`statut inconnu : ${statut}`);
    const rows = await db.query(
        `UPDATE social_post_variants
            SET statut = COALESCE($2, statut), revue = COALESCE($3, revue)
          WHERE id = $1 RETURNING *`,
        [id, statut || null, revue ? JSON.stringify(revue) : null]);
    return rows[0] || null;
}

// ── LES PUBLICATIONS ──────────────────────────────────────────────────────

async function programmer({ variantId, workspaceId, plateforme, quand }) {
    const rows = await db.query(
        `INSERT INTO social_publications (variant_id, workspace_id, plateforme, statut, programmee_le)
         VALUES ($1,$2,$3,'scheduled',$4) RETURNING *`,
        [variantId, workspaceId || null, plateforme, quand || null]);
    return rows[0];
}

// Ce que le planificateur demande : « qu'y a-t-il à publier maintenant ».
// `programmee_le IS NULL` veut dire « dès que possible ».
async function aPublierMaintenant(limite = 20) {
    return db.query(
        `SELECT p.*, v.texte, v.hashtags, v.cta, v.media_url, v.media_type
           FROM social_publications p
           JOIN social_post_variants v ON v.id = p.variant_id
          WHERE p.statut = 'scheduled'
            AND (p.programmee_le IS NULL OR p.programmee_le <= NOW())
          ORDER BY p.programmee_le NULLS FIRST
          LIMIT $1`, [Math.min(Number(limite) || 20, 100)]);
}

async function majPublication(id, { statut, externeId, externeUrl, provider, erreur, incrementerEssai }) {
    if (statut && !statutValide(statut)) throw new Error(`statut inconnu : ${statut}`);
    const rows = await db.query(
        `UPDATE social_publications
            SET statut      = COALESCE($2, statut),
                externe_id  = COALESCE($3, externe_id),
                externe_url = COALESCE($4, externe_url),
                provider    = COALESCE($5, provider),
                erreur      = $6,
                essais      = essais + $7,
                publiee_le  = CASE WHEN $2 = 'published' THEN NOW() ELSE publiee_le END
          WHERE id = $1 RETURNING *`,
        [id, statut || null, externeId || null, externeUrl || null, provider || null,
         erreur || null, incrementerEssai ? 1 : 0]);
    return rows[0] || null;
}

async function listerPublications({ workspaceId, communaute, limite = 100 }) {
    const params = [communaute || "samii"];
    let filtre = "";
    if (workspaceId) { params.push(workspaceId); filtre = `AND p.workspace_id = $${params.length}`; }
    params.push(Math.min(Number(limite) || 100, 300));
    return db.query(
        `SELECT p.*, v.plateforme AS v_plateforme, v.texte, s.titre, s.id AS post_id
           FROM social_publications p
           JOIN social_post_variants v ON v.id = p.variant_id
           JOIN social_posts s        ON s.id = v.post_id
          WHERE COALESCE(s.communaute,'samii') = $1 ${filtre}
          ORDER BY p.created_at DESC LIMIT $${params.length}`, params);
}

// ── LES MESURES ───────────────────────────────────────────────────────────
//
// Une ligne par RELEVÉ, jamais une mise à jour : les chiffres d'un post
// bougent pendant des jours, et écraser l'ancien relevé rendrait impossible
// de dire « ce post a explosé le mardi ».
async function enregistrerMesure({ publicationId, plateforme, mesures, brut }) {
    const m = mesures || {};
    const rows = await db.query(
        `INSERT INTO social_analytics
            (publication_id, plateforme, impressions, vues, likes, commentaires, partages, clics, abonnes_gagnes, brut)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [publicationId, plateforme,
         m.impressions ?? null, m.vues ?? null, m.likes ?? null, m.commentaires ?? null,
         m.partages ?? null, m.clics ?? null, m.abonnesGagnes ?? null,
         brut ? JSON.stringify(brut) : null]);
    return rows[0];
}

// ── LA TRACE DES AGENTS ───────────────────────────────────────────────────

async function tracerAgent({ agent, workspaceId, postId, statut, entree, sortie, erreur, dureeMs }) {
    try {
        const rows = await db.query(
            `INSERT INTO social_agent_runs (agent, workspace_id, post_id, statut, entree, sortie, erreur, duree_ms)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [agent, workspaceId || null, postId || null, statut || "ok",
             entree ? JSON.stringify(entree) : null,
             sortie ? JSON.stringify(sortie) : null,
             erreur || null, dureeMs || null]);
        return rows[0]?.id || null;
    } catch (err) {
        // La trace ne doit JAMAIS faire échouer le travail qu'elle trace.
        console.error("❌ tracerAgent :", err.message);
        return null;
    }
}

async function listerRuns({ agent, postId, limite = 50 }) {
    const conditions = ["1=1"]; const params = [];
    if (agent)  { params.push(agent);  conditions.push(`agent = $${params.length}`); }
    if (postId) { params.push(postId); conditions.push(`post_id = $${params.length}`); }
    params.push(Math.min(Number(limite) || 50, 200));
    return db.query(
        `SELECT id, agent, workspace_id, post_id, statut, erreur, duree_ms, created_at
           FROM social_agent_runs WHERE ${conditions.join(" AND ")}
          ORDER BY created_at DESC LIMIT $${params.length}`, params);
}

module.exports = {
    STATUTS, MODES, statutValide, modeValide, empreinte,
    creerPost, getPost, listerPosts, majStatutPost,
    enregistrerVariante, listerVariantes, getVariante, majVariante,
    programmer, aPublierMaintenant, majPublication, listerPublications,
    enregistrerMesure,
    tracerAgent, listerRuns,
};
