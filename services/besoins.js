// ==========================================================================
// SAMII OS — LES BESOINS DES MARCHANDS
//
// L'AMORÇAGE À L'ENVERS, ET POURQUOI C'EST NOTRE AVANTAGE.
//
// Toute place de marché meurt de la même chose : la salle vide. Jour 1, aucun
// prestataire ; le marchand voit du vide et ne revient pas, le développeur voit
// du vide et ne s'inscrit pas. Shopify a résolu ça en recrutant des
// développeurs pendant des années avant d'avoir un catalogue.
//
// Nous n'avons pas ce problème dans ce sens-là : les marchands sont DÉJÀ là.
// Le côté manquant, ce sont les développeurs. Alors on remplit la place par la
// DEMANDE, pas par l'offre. Pour un développeur, une page de besoins non
// satisfaits est infiniment plus attirante qu'une page de produits déjà faits :
// c'est du travail qui l'attend, avec un nom et un budget. Et pour le marchand,
// décrire ce qu'il lui faut est plus simple que de chercher dans un catalogue
// ce qu'il ne sait pas encore nommer.
//
// TROIS RÈGLES.
//   1. Publier un besoin ne coûte rien et n'engage à rien. Un marchand qui
//      craint d'être démarché ne publie pas — et sans besoins, pas de place.
//   2. Un développeur répond UNE fois par besoin : il modifie sa proposition
//      plutôt que d'en empiler cinq. Ce qui protège le marchand du harcèlement
//      protège aussi la lisibilité de la page.
//   3. Le prix proposé n'est qu'une proposition. Rien n'est dû, rien n'est
//      bloqué tant que le marchand n'a pas choisi — et c'est seulement là que
//      la transaction et le séquestre entrent en jeu (services/academie.js,
//      services/portefeuille.js).
// ==========================================================================
const crypto = require("crypto");
const db = require("./db");
const metiers = require("./metiers");

const STATUTS = ["ouvert", "attribue", "clos"];

function reference() {
    return `BES-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function nombreOuNull(v) {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// ── Côté marchand ────────────────────────────────────────────────────────

async function publier(auteurId, { titre, description, metier, budgetMin, budgetMax, devise = "USD", workspaceId = null }) {
    const t = String(titre || "").trim();
    if (t.length < 8) throw new Error("Donne un titre clair — au moins quelques mots.");
    const d = String(description || "").trim();
    if (d.length < 20) throw new Error("Décris ton besoin en quelques phrases : c'est ce qui décide qui te répond.");

    const min = nombreOuNull(budgetMin);
    const max = nombreOuNull(budgetMax);
    // Un budget inversé n'est presque jamais volontaire : on remet à l'endroit
    // au lieu de refuser, personne n'a envie de retaper son formulaire.
    const [bas, haut] = (min && max && min > max) ? [max, min] : [min, max];

    const rows = await db.query(
        `INSERT INTO besoins (reference, auteur_id, workspace_id, titre, description, metier, budget_min, budget_max, devise)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [reference(), String(auteurId), workspaceId, t.slice(0, 120), d.slice(0, 2000),
         metiers.estValide(metier) ? metier : null, bas, haut, devise],
    );
    return rows[0];
}

async function cloturer(auteurId, id, statut = "clos") {
    if (!STATUTS.includes(statut)) throw new Error("Statut inconnu.");
    const rows = await db.query(
        `UPDATE besoins SET statut = $3 WHERE id = $1 AND auteur_id = $2 RETURNING *`,
        [id, String(auteurId), statut],
    );
    if (!rows[0]) throw new Error("Besoin introuvable.");
    return rows[0];
}

// ── Côté développeur ─────────────────────────────────────────────────────

async function repondre(auteurId, besoinId, { message, prix, delaiJours, devise = "USD" }) {
    const m = String(message || "").trim();
    if (m.length < 20) throw new Error("Explique en quelques phrases comment tu t'y prendrais.");

    const besoin = await parId(besoinId);
    if (!besoin) throw new Error("Besoin introuvable.");
    if (besoin.statut !== "ouvert") throw new Error("Ce besoin n'accepte plus de réponses.");
    // Répondre à son propre besoin n'a aucun sens et fausserait le décompte
    // affiché aux autres.
    if (String(besoin.auteur_id) === String(auteurId)) throw new Error("C'est ton propre besoin.");

    const rows = await db.query(
        `INSERT INTO besoin_reponses (besoin_id, auteur_id, message, prix, devise, delai_jours)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (besoin_id, auteur_id) DO UPDATE
            SET message = EXCLUDED.message, prix = EXCLUDED.prix,
                delai_jours = EXCLUDED.delai_jours, created_at = now()
         RETURNING *`,
        [besoinId, String(auteurId), m.slice(0, 2000), nombreOuNull(prix), devise,
         Number.isFinite(Number(delaiJours)) ? Math.max(1, Math.round(Number(delaiJours))) : null],
    );
    return rows[0];
}

// ── Lecture ──────────────────────────────────────────────────────────────

// Le nombre de réponses est affiché à tout le monde : un besoin sans réponse
// attire un développeur (la place est libre), un besoin très demandé prévient
// honnêtement qu'il faudra se démarquer.
async function lister({ metier = "", recherche = "", limite = 40 } = {}) {
    try {
        const clauses = ["b.statut = 'ouvert'"];
        const params = [];
        if (metier) { params.push(metier); clauses.push(`b.metier = $${params.length}`); }
        if (recherche) {
            params.push(`%${recherche.toLowerCase()}%`);
            clauses.push(`(LOWER(b.titre) LIKE $${params.length} OR LOWER(b.description) LIKE $${params.length})`);
        }
        params.push(Math.min(Number(limite) || 40, 100));
        return await db.query(
            `SELECT b.*, (SELECT COUNT(*)::int FROM besoin_reponses r WHERE r.besoin_id = b.id) AS reponses
               FROM besoins b WHERE ${clauses.join(" AND ")}
              ORDER BY b.created_at DESC LIMIT $${params.length}`,
            params,
        );
    } catch (err) {
        console.warn("⚠️ besoins.lister :", err.message);
        return [];
    }
}

async function parId(id) {
    const rows = await db.query(`SELECT * FROM besoins WHERE id = $1`, [id]);
    return rows[0] || null;
}

async function parReference(reference) {
    const rows = await db.query(`SELECT * FROM besoins WHERE reference = $1`, [reference]);
    return rows[0] || null;
}

// Les réponses ne sont visibles en entier que par l'auteur du besoin et par
// ceux qui ont répondu : une proposition chiffrée est une information
// commerciale, pas un contenu public.
// Deux requêtes plutôt qu'une jointure, volontairement. Les propositions et
// les noms n'ont pas la même importance : une jointure qui échoue (colonne
// renommée, table absente sur un environnement) ferait disparaître TOUTES les
// propositions d'un marchand pour une raison décorative — il croirait que
// personne ne lui a répondu et quitterait la place. Ici, un nom manquant coûte
// un nom, jamais une proposition.
async function listerReponses(besoinId) {
    let reponses;
    try {
        reponses = await db.query(
            `SELECT * FROM besoin_reponses WHERE besoin_id = $1 ORDER BY created_at DESC`,
            [besoinId],
        );
    } catch (err) {
        console.warn("⚠️ besoins.listerReponses :", err.message);
        return [];
    }
    if (!reponses.length) return reponses;

    const noms = new Map();
    try {
        const ids = [...new Set(reponses.map((r) => String(r.auteur_id)))];
        const rows = await db.query(
            `SELECT id::text AS id, COALESCE(NULLIF(TRIM(CONCAT(prenom, ' ', nom)), ''), '') AS nom_complet
               FROM utilisateurs WHERE id::text = ANY($1)`,
            [ids],
        );
        for (const u of rows) if (u.nom_complet) noms.set(u.id, u.nom_complet);
    } catch (err) {
        console.warn("⚠️ besoins.listerReponses (noms) :", err.message);
    }

    return reponses.map((r) => ({
        ...r,
        auteur_nom: noms.get(String(r.auteur_id)) || "Développeur de l'Académie",
    }));
}

async function mesBesoins(auteurId) {
    try {
        return await db.query(
            `SELECT b.*, (SELECT COUNT(*)::int FROM besoin_reponses r WHERE r.besoin_id = b.id) AS reponses
               FROM besoins b WHERE b.auteur_id = $1 ORDER BY b.created_at DESC`,
            [String(auteurId)],
        );
    } catch { return []; }
}

async function mesReponses(auteurId) {
    try {
        return await db.query(
            `SELECT r.*, b.titre, b.reference, b.statut AS besoin_statut
               FROM besoin_reponses r JOIN besoins b ON b.id = r.besoin_id
              WHERE r.auteur_id = $1 ORDER BY r.created_at DESC`,
            [String(auteurId)],
        );
    } catch { return []; }
}

// Combien de travail attend, pour l'annoncer aux développeurs sans mentir.
async function compterOuverts() {
    try {
        const rows = await db.query(`SELECT COUNT(*)::int AS n FROM besoins WHERE statut = 'ouvert'`);
        return rows[0]?.n || 0;
    } catch { return 0; }
}

module.exports = {
    STATUTS, publier, cloturer, repondre,
    lister, parId, parReference, listerReponses,
    mesBesoins, mesReponses, compterOuverts,
};
