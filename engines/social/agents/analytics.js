// ==========================================================================
// AGENT 6 — L'ANALYSTE
// ==========================================================================
//
// ── CE QUI EST CONSTRUIT, ET CE QUI NE L'EST PAS ─────────────────────────
//
// « Préparer l'ARCHITECTURE pour récupérer impressions, vues, likes… »
//
// L'architecture est là : une table qui garde un relevé horodaté par
// publication, un collecteur par plateforme, et une lecture qui compare.
//
// Ce qui n'est PAS là : les appels aux API de statistiques. Aucune
// plateforme n'est encore autorisée à nous les donner — Meta n'a accordé ni
// `pages_read_engagement`, ni `instagram_manage_insights`. Écrire ces
// appels maintenant, ce serait du code qui ne peut pas être essayé.
//
// ── LA RÈGLE QUI TIENT TOUT ───────────────────────────────────────────────
//
// « SAMII doit apprendre des résultats RÉELS, pas inventer des
// statistiques. »
//
// Donc : aucun chiffre n'est produit ici. `collecter()` interroge un
// collecteur ; s'il n'y en a pas pour la plateforme, il rend
// `{ disponible: false, raison }` et n'écrit RIEN en base. Une table vide
// est une vérité ; une table remplie de nombres plausibles est un mensonge
// dont on ne se remet pas — parce que tous les agents en aval s'en
// serviront comme s'ils étaient vrais.

const base = require("./base");
const store = require("../../../services/socialStore");
const db = require("../../../services/db");

const NOM = "analytics";

// ── LES COLLECTEURS ───────────────────────────────────────────────────────
//
// Un par plateforme, quand elle nous laissera lire ses chiffres. Le contrat :
//
//     async (publication) → { mesures: {vues, likes, …}, brut } | null
//
// Vide aujourd'hui, volontairement. Ajouter Meta ici le jour où
// `pages_read_engagement` est accordée sera un ajout local — rien d'autre
// ne bougera.
const COLLECTEURS = {};

function enregistrerCollecteur(plateforme, fn) {
    COLLECTEURS[String(plateforme).toLowerCase()] = fn;
}

// Ce qu'on peut mesurer aujourd'hui, dit sans détour.
function couverture() {
    const plateformes = require("../../../config/plateformes-sociales");
    return plateformes.liste().map((p) => ({
        slug: p.slug,
        nom: p.nom,
        collecteur: !!COLLECTEURS[p.slug],
        raison: COLLECTEURS[p.slug] ? null
            : p.approbationMeta
                ? "Meta n'a pas encore accordé les permissions de lecture des statistiques"
                : "aucun collecteur écrit pour cette plateforme",
    }));
}

// ── COLLECTER ─────────────────────────────────────────────────────────────
async function collecter({ publicationId } = {}) {
    return base.executer(NOM, { entree: { publicationId } }, async () => {
        const rows = await db.query(`SELECT * FROM social_publications WHERE id = $1`, [publicationId]);
        const pub = rows[0];
        if (!pub) throw new Error(`publication ${publicationId} introuvable`);
        if (pub.statut !== "published") {
            return { disponible: false, raison: `publication non publiée (statut : ${pub.statut})` };
        }
        // Une simulation n'a pas de statistiques. En inventer serait
        // exactement ce que la mission interdit.
        if (pub.provider === "mock") {
            return { disponible: false, raison: "publication simulée — elle n'existe sur aucune plateforme" };
        }

        const collecteur = COLLECTEURS[pub.plateforme];
        if (!collecteur) {
            return { disponible: false, raison: `aucun collecteur pour ${pub.plateforme}` };
        }

        const releve = await collecteur(pub);
        if (!releve?.mesures) return { disponible: false, raison: "le collecteur n'a rien rendu" };

        const ligne = await store.enregistrerMesure({
            publicationId: pub.id, plateforme: pub.plateforme,
            mesures: releve.mesures, brut: releve.brut,
        });
        return { disponible: true, mesureId: ligne.id, mesures: releve.mesures };
    });
}

// ── COMPARER ──────────────────────────────────────────────────────────────
//
// La lecture que le stratège et l'agent d'apprentissage consommeront. Elle
// ne calcule que sur des lignes réellement relevées, et elle DIT combien il
// y en a — « 8 j'aime en moyenne » sur deux publications ne vaut rien, et
// celui qui lit doit pouvoir s'en rendre compte.
async function comparer({ workspaceId, depuisJours = 30 } = {}) {
    return base.executer(NOM, { workspaceId, entree: { depuisJours } }, async () => {
        const lignes = await db.query(
            `SELECT p.plateforme,
                    COUNT(DISTINCT p.id)                    AS publications,
                    COUNT(a.id)                             AS releves,
                    ROUND(AVG(COALESCE(a.vues,0)))          AS vues_moyennes,
                    ROUND(AVG(COALESCE(a.likes,0)))         AS likes_moyens,
                    ROUND(AVG(COALESCE(a.commentaires,0)))  AS commentaires_moyens,
                    ROUND(AVG(COALESCE(a.clics,0)))         AS clics_moyens
               FROM social_publications p
               LEFT JOIN social_analytics a ON a.publication_id = p.id
              WHERE p.statut = 'published'
                AND COALESCE(p.provider,'') <> 'mock'
                AND p.publiee_le > NOW() - ($2 || ' days')::interval
                AND ($1::text IS NULL OR p.workspace_id = $1)
              GROUP BY p.plateforme
              ORDER BY likes_moyens DESC NULLS LAST`,
            [workspaceId || null, String(Number(depuisJours) || 30)]);

        const avecDonnees = lignes.filter((l) => Number(l.releves) > 0);
        return {
            parPlateforme: lignes,
            // La recommandation n'est faite QUE si elle repose sur quelque
            // chose. Sinon on dit qu'on ne sait pas — ce qui est la bonne
            // réponse, et de loin la plus utile.
            recommandation: avecDonnees.length
                ? `Meilleure plateforme sur ${depuisJours} jours : ${avecDonnees[0].plateforme} (${avecDonnees[0].releves} relevé(s)).`
                : "Aucun relevé réel : aucune recommandation ne peut être fondée pour le moment.",
            fiable: avecDonnees.length > 0,
            couverture: couverture(),
        };
    });
}

module.exports = { NOM, collecter, comparer, couverture, enregistrerCollecteur, COLLECTEURS };
