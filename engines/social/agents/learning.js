// ==========================================================================
// AGENT 7 — L'APPRENTISSAGE
// ==========================================================================
//
// « Ne pas créer un FAUX système d'apprentissage. »
//
// C'est la consigne la plus importante de tout ce dossier, et la plus facile
// à trahir sans s'en rendre compte. Un agent qui rend des « enseignements »
// bien tournés à partir de zéro donnée a l'air de fonctionner. Il est même
// plus convaincant qu'un agent honnête — jusqu'au jour où on décide quelque
// chose en s'appuyant dessus.
//
// ── CE QUE CE FICHIER FAIT ────────────────────────────────────────────────
//
// Il lit ce qui s'est réellement passé, en compte les preuves, et refuse de
// conclure quand il n'y en a pas assez. C'est tout, et c'est volontaire.
//
// ── LE SEUIL ──────────────────────────────────────────────────────────────
//
// En dessous de `MINIMUM_OBSERVATIONS` relevés RÉELS, aucun enseignement
// n'est produit. Le seuil est bas (5) parce qu'il faut bien commencer
// quelque part, mais il n'est pas nul : une seule publication qui a bien
// marché n'apprend rien du tout — elle est peut-être partie un jour de
// match, ou reprise par un compte plus gros.

const base = require("./base");
const db = require("../../../services/db");

const NOM = "learning";

// Sous ce nombre, on ne conclut pas.
const MINIMUM_OBSERVATIONS = 5;

// ── LES DIMENSIONS QU'ON SAURA ANALYSER ───────────────────────────────────
//
// L'architecture demandée : sujets, hooks, formats, horaires, plateformes,
// fréquence, CTA. Chacune dit d'où viendra sa donnée — c'est ce qui rend
// visible, aujourd'hui, ce qui manque pour qu'elle serve.
const DIMENSIONS = {
    plateforme: { source: "social_publications.plateforme", pret: true },
    horaire: { source: "social_publications.publiee_le", pret: true },
    theme: { source: "social_posts.theme", pret: true },
    // Le hook n'est pas stocké séparément aujourd'hui : il est fondu dans le
    // texte de la variante. L'analyser demanderait de le ressortir — c'est
    // une évolution du modèle, pas un calcul. Dit ici plutôt que caché.
    hook: { source: "à extraire du texte des variantes", pret: false },
    format: { source: "social_post_variants.media_type", pret: true },
    cta: { source: "social_post_variants.cta", pret: true },
    frequence: { source: "rythme des publications", pret: true },
};

// ── CE QU'ON SAIT VRAIMENT ────────────────────────────────────────────────
async function observations({ workspaceId } = {}) {
    try {
        const rows = await db.query(
            `SELECT COUNT(DISTINCT p.id)                             AS publications_reelles,
                    COUNT(a.id)                                      AS releves,
                    COUNT(DISTINCT p.plateforme)                     AS plateformes,
                    MIN(p.publiee_le)                                AS premiere,
                    MAX(p.publiee_le)                                AS derniere
               FROM social_publications p
               LEFT JOIN social_analytics a ON a.publication_id = p.id
              WHERE p.statut = 'published'
                AND COALESCE(p.provider,'') <> 'mock'
                AND ($1::text IS NULL OR p.workspace_id = $1)`,
            [workspaceId || null]);
        const r = rows[0] || {};
        return {
            publicationsReelles: Number(r.publications_reelles || 0),
            releves: Number(r.releves || 0),
            plateformes: Number(r.plateformes || 0),
            premiere: r.premiere || null,
            derniere: r.derniere || null,
        };
    } catch (err) {
        console.warn("⚠️ apprentissage — lecture impossible :", err.message);
        return { publicationsReelles: 0, releves: 0, plateformes: 0, erreur: err.message };
    }
}

// ── APPRENDRE ─────────────────────────────────────────────────────────────
//
// Rend soit des enseignements fondés, soit un refus motivé. Jamais entre les
// deux.
async function apprendre({ workspaceId } = {}) {
    return base.executer(NOM, { workspaceId, entree: {} }, async () => {
        const obs = await observations({ workspaceId });

        if (obs.releves < MINIMUM_OBSERVATIONS) {
            return {
                // `pretAApprendre: false` est LA valeur que le stratège doit
                // regarder. Tant qu'elle est fausse, il ne doit rien tirer
                // d'ici.
                pretAApprendre: false,
                observations: obs,
                raison: `${obs.releves} relevé(s) réel(s) pour ${MINIMUM_OBSERVATIONS} nécessaires. `
                      + (obs.publicationsReelles === 0
                          ? "Aucune publication réelle n'a encore eu lieu : le système est en simulation."
                          : "Les publications existent mais leurs statistiques ne sont pas encore collectées "
                          + "(les permissions de lecture ne sont pas accordées)."),
                enseignements: [],
                dimensions: DIMENSIONS,
            };
        }

        // À partir d'ici, il y a de la matière. On croise ce qui est
        // réellement mesuré, dimension par dimension.
        const parPlateforme = await db.query(
            `SELECT p.plateforme, COUNT(a.id) AS n, ROUND(AVG(COALESCE(a.likes,0))) AS likes
               FROM social_publications p JOIN social_analytics a ON a.publication_id = p.id
              WHERE p.statut='published' AND COALESCE(p.provider,'') <> 'mock'
                AND ($1::text IS NULL OR p.workspace_id = $1)
              GROUP BY p.plateforme HAVING COUNT(a.id) >= 2 ORDER BY likes DESC`,
            [workspaceId || null]);

        const parHeure = await db.query(
            `SELECT EXTRACT(HOUR FROM p.publiee_le)::int AS heure,
                    COUNT(a.id) AS n, ROUND(AVG(COALESCE(a.likes,0))) AS likes
               FROM social_publications p JOIN social_analytics a ON a.publication_id = p.id
              WHERE p.statut='published' AND COALESCE(p.provider,'') <> 'mock'
                AND ($1::text IS NULL OR p.workspace_id = $1)
              GROUP BY heure HAVING COUNT(a.id) >= 2 ORDER BY likes DESC`,
            [workspaceId || null]);

        const enseignements = [];
        if (parPlateforme.length) {
            enseignements.push({
                dimension: "plateforme",
                constat: `${parPlateforme[0].plateforme} obtient le plus d'engagement`,
                appuye_sur: `${parPlateforme[0].n} relevé(s)`,
            });
        }
        if (parHeure.length) {
            enseignements.push({
                dimension: "horaire",
                constat: `les publications de ${parHeure[0].heure}h fonctionnent le mieux`,
                appuye_sur: `${parHeure[0].n} relevé(s)`,
            });
        }

        return {
            pretAApprendre: true,
            observations: obs,
            enseignements,
            dimensions: DIMENSIONS,
        };
    });
}

module.exports = { NOM, apprendre, observations, DIMENSIONS, MINIMUM_OBSERVATIONS };
