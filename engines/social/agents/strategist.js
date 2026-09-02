// ==========================================================================
// AGENT 1 — LE STRATÈGE
// ==========================================================================
//
// Il décide QUOI dire, OÙ, et QUAND. Il n'écrit pas le contenu : c'est le
// travail du créateur, juste après lui.
//
// ── CE QU'IL A LE DROIT DE SAVOIR ─────────────────────────────────────────
//
// « SAMII doit apprendre des résultats RÉELS, pas inventer des
// statistiques. »
//
// Le stratège s'appuie sur ce que `social_analytics` contient VRAIMENT.
// Aujourd'hui cette table est vide — aucune publication réelle n'a encore
// eu lieu. Il le dit donc franchement dans son plan (`based_on: "aucun
// historique"`) au lieu de sortir des recommandations qui auraient l'air
// fondées sur des données.
//
// C'est le point qui distingue un système d'apprentissage d'un théâtre
// d'apprentissage.

const base = require("./base");
const db = require("../../../services/db");
const plateformes = require("../../../config/plateformes-sociales");

const NOM = "strategist";

// Ce que l'histoire nous apprend — ou son absence, dite clairement.
async function historique(workspaceId) {
    try {
        const lignes = await db.query(
            `SELECT a.plateforme,
                    COUNT(*)                    AS releves,
                    AVG(COALESCE(a.likes,0))    AS likes_moyens,
                    AVG(COALESCE(a.vues,0))     AS vues_moyennes,
                    AVG(COALESCE(a.clics,0))    AS clics_moyens
               FROM social_analytics a
               JOIN social_publications p ON p.id = a.publication_id
              WHERE ($1::text IS NULL OR p.workspace_id = $1)
                -- Les simulations ne sont PAS des résultats. Les compter
                -- reviendrait à apprendre de chiffres qu'on a inventés
                -- soi-même.
                AND COALESCE(p.provider,'') <> 'mock'
              GROUP BY a.plateforme
              ORDER BY likes_moyens DESC NULLS LAST`,
            [workspaceId || null]);
        return lignes;
    } catch (err) {
        // La table peut ne pas exister sur une base ancienne : ce n'est pas
        // une raison pour empêcher de faire un plan.
        console.warn("⚠️ stratège — historique indisponible :", err.message);
        return [];
    }
}

async function planifier({ workspaceId, objectif, contrainte, nbSujets = 3 } = {}) {
    return base.executer(NOM, { workspaceId, entree: { objectif, contrainte, nbSujets } }, async () => {
        const passe = await historique(workspaceId);
        const dispo = plateformes.listeActives();

        const resumeHistorique = passe.length
            ? passe.map((l) => `${l.plateforme}: ${Math.round(l.likes_moyens)} j'aime en moyenne sur ${l.releves} relevé(s)`).join(" · ")
            : "AUCUN historique réel — ne fais aucune recommandation qui prétendrait s'appuyer sur des chiffres.";

        const message = `Tu es le stratège de contenu d'OG Technology / SAMII.

Plateformes disponibles : ${dispo.map((p) => `${p.slug} (${p.ton})`).join(" | ")}
Résultats passés : ${resumeHistorique}
${objectif ? `Objectif demandé : ${objectif}` : "Objectif : faire connaître SAMII auprès de commerçants et marchands d'Afrique francophone."}
${contrainte ? `Contrainte : ${contrainte}` : ""}

Propose ${nbSujets} sujets de contenu. Pour chacun : le thème, l'objectif visé,
les plateformes les plus pertinentes (parmi celles listées), et un créneau
horaire conseillé.

Réponds UNIQUEMENT en JSON valide, sans texte autour :
{"sujets":[{"theme":"...","objectif":"...","plateformes":["..."],"creneau":"..."}]}`;

        const brut = await base.demander(message, { workspaceId, source: "social-strategist" });
        const json = base.lireJson(brut);

        if (!json?.sujets?.length) {
            throw new Error("le stratège n'a pas produit de plan lisible");
        }

        // On garde uniquement des plateformes qui existent ET ne sont pas
        // coupées : sans ce filtre, l'IA proposerait « twitter » et toute la
        // chaîne échouerait plus loin, sans qu'on sache pourquoi.
        const slugs = new Set(dispo.map((p) => p.slug));
        const sujets = json.sujets.map((s) => ({
            theme: String(s.theme || "").slice(0, 200),
            objectif: String(s.objectif || "").slice(0, 300),
            plateformes: (Array.isArray(s.plateformes) ? s.plateformes : [])
                .map((p) => String(p).toLowerCase()).filter((p) => slugs.has(p)),
            creneau: String(s.creneau || "").slice(0, 100),
        })).filter((s) => s.theme && s.plateformes.length);

        if (!sujets.length) throw new Error("aucun sujet exploitable après filtrage des plateformes");

        return {
            sujets,
            // La provenance de la décision, écrite noir sur blanc. Le jour où
            // quelqu'un demandera « pourquoi SAMII a choisi LinkedIn », la
            // réponse est ici et pas dans une supposition.
            fonde_sur: passe.length ? `${passe.length} plateforme(s) avec historique réel` : "aucun historique",
            plateformesDisponibles: dispo.map((p) => p.slug),
        };
    });
}

module.exports = { NOM, planifier, historique };
