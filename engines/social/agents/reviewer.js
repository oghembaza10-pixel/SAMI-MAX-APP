// ==========================================================================
// AGENT 4 — LE RELECTEUR
// ==========================================================================
//
// Le dernier à voir le contenu avant qu'il parte. C'est le seul agent dont
// le travail est de dire NON.
//
// ── DEUX NIVEAUX, ET LA DIFFÉRENCE COMPTE ────────────────────────────────
//
//   BLOQUANT   → la publication est refusée. Ce sont des faits vérifiables
//                par du code : texte vide, trop long, image manquante là où
//                elle est obligatoire, doublon.
//   REMARQUE   → c'est signalé, ça passe quand même. Ce sont des jugements :
//                le ton, la qualité de l'accroche, la clarté du CTA.
//
// Mélanger les deux serait une faute. Un jugement d'IA qui BLOQUE une
// publication, c'est SAMII qui censure un marchand sur une impression. Un
// fait vérifiable qu'on laisse passer, c'est une erreur d'API garantie.
//
// Le contrôle mécanique tourne TOUJOURS et ne coûte rien. L'avis de l'IA est
// un supplément : si le moteur ne répond pas, la relecture mécanique fait
// foi et la chaîne continue.

const base = require("./base");
const plateformes = require("../../../config/plateformes-sociales");
const db = require("../../../services/db");

const NOM = "reviewer";

// ── LE CONTRÔLE MÉCANIQUE ─────────────────────────────────────────────────
//
// Aucune IA ici. Que des faits.
function controlerMecanique(variante) {
    const p = plateformes.get(variante.plateforme);
    const bloquants = [];
    const remarques = [];

    if (!p) { bloquants.push(`plateforme inconnue : ${variante.plateforme}`); return { bloquants, remarques }; }
    if (plateformes.estCoupee(variante.plateforme)) bloquants.push(`${variante.plateforme} est coupée`);

    const texte = String(variante.texte || "").trim();
    if (!texte) bloquants.push("texte vide");
    if (texte && texte.length > p.maxCaracteres) {
        bloquants.push(`${texte.length} caractères pour ${p.maxCaracteres} autorisés`);
    }
    // Un texte de trois mots n'est pas une publication, c'est un accident.
    if (texte && texte.length < 20) bloquants.push(`texte trop court (${texte.length} caractères)`);

    if (p.mediaRequis && !variante.media_url && !variante.mediaUrl) {
        bloquants.push(`${p.nom} exige un visuel, aucun n'est fourni`);
    }

    const tags = String(variante.hashtags || "").split(/\s+/).filter((t) => t.startsWith("#"));
    if (p.hashtagsMax === 0 && tags.length) bloquants.push(`${tags.length} hashtag(s) sur une plateforme qui n'en veut pas`);
    if (p.hashtagsMax > 0 && tags.length > p.hashtagsMax) bloquants.push(`${tags.length} hashtags pour ${p.hashtagsMax} autorisés`);

    // Remarques : ça passe, mais on le dit.
    if (texte && texte.length < p.longueurVisee[0]) remarques.push(`plus court que visé (${texte.length} < ${p.longueurVisee[0]})`);
    if (texte && texte.length > p.longueurVisee[1]) remarques.push(`plus long que visé (${texte.length} > ${p.longueurVisee[1]})`);
    if (!variante.cta) remarques.push("aucun appel à l'action");
    // ── LES MARQUEURS NON REMPLACÉS ──────────────────────────────────────
    //
    // Un modèle qui n'a pas su remplir un champ laisse « [PRODUIT] » ou
    // « {{nom}} » dans le texte. Publier ça, c'est publier un brouillon.
    //
    // ATTENTION À LA CASSE : la première version cherchait `XXX` sans tenir
    // compte des majuscules. Résultat, tout texte contenant « xxx » était
    // bloqué — trouvé en écrivant le test, qui utilisait une chaîne de x
    // comme faux contenu. TODO, XXX et LOREM sont des marqueurs qui
    // s'écrivent EN MAJUSCULES ; les chercher autrement bloque du texte
    // légitime.
    //
    // Les crochets et accolades, eux, restent insensibles à la casse : leur
    // forme suffit, le contenu n'a pas d'importance.
    const marqueurStructure = /\[[^\]]{1,40}\]|\{\{[^}]{1,40}\}\}/.test(texte);
    const marqueurMot = /\b(XXX+|TODO|FIXME|LOREM IPSUM)\b/.test(texte);
    if (marqueurStructure || marqueurMot) bloquants.push("le texte contient un marqueur non remplacé");

    return { bloquants, remarques };
}

// ── LE DOUBLON ────────────────────────────────────────────────────────────
//
// « empêcher les publications dupliquées ».
//
// On regarde ce qui est DÉJÀ parti sur cette plateforme. Republier le même
// texte deux semaines plus tard sur Instagram, c'est ce qui fait qu'un
// compte a l'air abandonné à un robot.
async function dejaPublie(plateforme, texte, workspaceId) {
    const cle = String(texte || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 200);
    if (cle.length < 30) return null;
    try {
        const rows = await db.query(
            `SELECT p.id, p.publiee_le
               FROM social_publications p
               JOIN social_post_variants v ON v.id = p.variant_id
              WHERE p.plateforme = $1
                AND p.statut = 'published'
                AND ($3::text IS NULL OR p.workspace_id = $3)
                AND lower(regexp_replace(v.texte, '[^a-zA-Z0-9]', '', 'g')) LIKE $2
              LIMIT 1`,
            [plateforme, cle + "%", workspaceId || null]);
        return rows[0] || null;
    } catch (err) {
        // Ne pas pouvoir vérifier n'est PAS la même chose que « pas de
        // doublon ». On le dit plutôt que de laisser croire au contrôle.
        console.warn("⚠️ relecteur — vérification de doublon impossible :", err.message);
        return { indeterminé: true, erreur: err.message };
    }
}

async function relire({ workspaceId, postId, variante, avisIA = true } = {}) {
    return base.executer(NOM, { workspaceId, postId, entree: { plateforme: variante?.plateforme } }, async () => {
        if (!variante) throw new Error("aucune variante à relire");

        const { bloquants, remarques } = controlerMecanique(variante);

        const doublon = await dejaPublie(variante.plateforme, variante.texte, workspaceId);
        if (doublon && !doublon.indeterminé) {
            bloquants.push(`déjà publié sur ${variante.plateforme} (publication #${doublon.id})`);
        } else if (doublon?.indeterminé) {
            remarques.push("impossible de vérifier les doublons : " + doublon.erreur);
        }

        // L'avis de l'IA — un supplément, jamais un verdict.
        let avis = null;
        if (avisIA && !bloquants.length) {
            try {
                const p = plateformes.get(variante.plateforme);
                const brut = await base.demander(
                    `Relis ce contenu destiné à ${p.nom}. Ton attendu : ${p.ton}.

TEXTE : ${variante.texte}
${variante.cta ? `CTA : ${variante.cta}` : ""}

Signale uniquement ce qui est réellement problématique : fautes, ton inadapté,
promesse intenable, appel à l'action flou. Ne réécris pas.

Réponds UNIQUEMENT en JSON : {"note":0-10,"problemes":["..."],"avis":"une phrase"}`,
                    { workspaceId, source: "social-reviewer" });
                const json = base.lireJson(brut);
                if (json) {
                    avis = {
                        note: Number(json.note) || null,
                        problemes: (Array.isArray(json.problemes) ? json.problemes : []).slice(0, 5).map(String),
                        avis: String(json.avis || "").slice(0, 300),
                    };
                    // Les remarques de l'IA rejoignent les remarques, jamais
                    // les bloquants.
                    remarques.push(...avis.problemes);
                }
            } catch (err) {
                // Le moteur indisponible ne doit pas bloquer une publication
                // que le contrôle mécanique a validée.
                remarques.push("avis IA indisponible : " + err.message);
            }
        }

        const verdict = bloquants.length ? "refuse" : "approuve";
        return {
            verdict,
            approuve: verdict === "approuve",
            bloquants,
            remarques,
            avisIA: avis,
        };
    });
}

module.exports = { NOM, relire, controlerMecanique, dejaPublie };
