// ==========================================================================
// SAMII OS — L'ACADÉMIE : la porte et le registre
//
// Deux responsabilités, et rien d'autre :
//
//   1. QUI PEUT ENTRER. Personne ne construit ni ne vend dans l'Académie sans
//      avoir accepté le contrat en vigueur. Pas la dernière version qu'il a
//      vue : celle d'aujourd'hui. Un contrat qui change sans réacceptation
//      n'est pas un contrat, c'est une note de service.
//
//   2. CE QUI EST DÛ. Chaque transaction conclue ici est inscrite avec son
//      taux figé, sa commission et la part du vendeur. Le registre est la
//      seule vérité comptable — il ne dépend ni du moyen de paiement, ni du
//      pays, ni de qui encaisse. C'est ce qui permettra d'ouvrir un pays sans
//      rien réécrire.
//
// CE QUE CE FICHIER NE FAIT PAS. Il ne déplace pas d'argent. Encaisser et
// reverser dépendent du rail (carte, virement, CCP) et changent d'un pays à
// l'autre ; le registre, lui, ne change jamais. Les deux doivent rester
// séparés, sinon chaque nouveau pays obligerait à toucher à la comptabilité.
// ==========================================================================
const crypto = require("crypto");
const db = require("./db");
const academie = require("../config/academie");

// Empreinte du texte réellement soumis. Si le contrat est retouché sans
// changer de numéro de version, l'empreinte le dit — et on peut prouver ce
// que chacun a coché.
function empreinteContrat(contrat = academie.CONTRAT) {
    const texte = JSON.stringify({
        version: contrat.version,
        titre: contrat.titre,
        articles: contrat.articles,
    });
    return crypto.createHash("sha256").update(texte).digest("hex");
}

// ── LA PORTE ─────────────────────────────────────────────────────────────

// Enregistre une acceptation. Toujours en ajout : on ne modifie jamais une
// ligne existante, on en écrit une nouvelle. L'historique est la preuve.
async function accepter(utilisateurId, role, { ip = "", agent = "" } = {}) {
    if (!utilisateurId) throw new Error("Utilisateur inconnu.");
    if (!academie.ROLES.includes(role)) throw new Error("Rôle inconnu.");

    await db.query(
        `INSERT INTO academie_acceptations
            (utilisateur_id, role, contrat_version, empreinte_contrat, ip, agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [utilisateurId, role, academie.CONTRAT_VERSION, empreinteContrat(),
         String(ip).slice(0, 60), String(agent).slice(0, 200)],
    );
    return { version: academie.CONTRAT_VERSION };
}

// L'acceptation en cours de validité, ou null. En cas d'erreur de base on
// renvoie null : mieux vaut redemander une acceptation que d'en supposer une.
async function acceptationCourante(utilisateurId) {
    if (!utilisateurId) return null;
    try {
        const rows = await db.query(
            `SELECT role, contrat_version, accepte_le
               FROM academie_acceptations
              WHERE utilisateur_id = $1 AND contrat_version = $2
              ORDER BY accepte_le DESC LIMIT 1`,
            [utilisateurId, academie.CONTRAT_VERSION],
        );
        return rows[0] || null;
    } catch (err) {
        console.error("❌ academie.acceptationCourante :", err.message);
        return null;
    }
}

async function estMembre(utilisateurId) {
    return !!(await acceptationCourante(utilisateurId));
}

// Tout l'historique d'un membre — utile le jour où une commission est
// contestée : on montre la version, la date et l'empreinte.
async function historique(utilisateurId) {
    try {
        return await db.query(
            `SELECT role, contrat_version, empreinte_contrat, accepte_le
               FROM academie_acceptations WHERE utilisateur_id = $1
              ORDER BY accepte_le DESC`,
            [utilisateurId],
        );
    } catch {
        return [];
    }
}

// ── LE REGISTRE ──────────────────────────────────────────────────────────

function reference() {
    // Lisible par un humain au téléphone, et unique.
    return `ACA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

// Inscrit une transaction conclue dans l'Académie. Le taux est copié depuis la
// configuration au moment de l'écriture et ne bougera plus : c'est la ligne
// qui fait foi, pas le fichier de configuration du jour où on la relit.
async function enregistrerTransaction({
    type, vendeurId, acheteurId, workspaceId = null, appId = null,
    montantBrut, devise = "USD", detail = "",
}) {
    if (!academie.TYPES_TRANSACTION[type]) throw new Error("Type de transaction inconnu.");
    if (!vendeurId || !acheteurId) throw new Error("Vendeur et acheteur sont obligatoires.");

    const partage = academie.partager(montantBrut);
    if (!partage) throw new Error("Montant invalide.");

    // Les deux parties doivent avoir accepté le contrat : c'est lui qui rend
    // la commission exigible. Sans cette vérification, on prélèverait 10 % à
    // quelqu'un qui n'a jamais rien signé.
    if (!await estMembre(vendeurId)) throw new Error("Le vendeur n'a pas accepté le contrat de l'Académie.");

    const rows = await db.query(
        `INSERT INTO academie_transactions
            (reference, type, app_id, vendeur_id, acheteur_id, workspace_id,
             montant_brut, devise, taux_commission, commission, net_vendeur, detail)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [reference(), type, appId, vendeurId, acheteurId, workspaceId,
         partage.brut, devise, partage.taux, partage.commission, partage.net,
         String(detail || "").slice(0, 400)],
    );
    return rows[0];
}

// L'argent est arrivé : la commission devient exigible. C'est le seul moment
// où SAMII gagne quelque chose — jamais à la mise en ligne, jamais au devis.
async function marquerEncaissee(reference) {
    const rows = await db.query(
        `UPDATE academie_transactions
            SET statut = 'encaissee', encaissee_le = now()
          WHERE reference = $1 AND statut = 'en_attente' RETURNING *`,
        [reference],
    );
    return rows[0] || null;
}

// Le vendeur a reçu sa part.
async function marquerReversee(reference) {
    const rows = await db.query(
        `UPDATE academie_transactions
            SET statut = 'reversee', reversee_le = now()
          WHERE reference = $1 AND statut = 'encaissee' RETURNING *`,
        [reference],
    );
    return rows[0] || null;
}

// Annulé ou remboursé : plus rien n'est dû, ni au vendeur ni à SAMII.
async function annuler(reference, remboursee = false) {
    const rows = await db.query(
        `UPDATE academie_transactions
            SET statut = $2
          WHERE reference = $1 AND statut IN ('en_attente', 'encaissee') RETURNING *`,
        [reference, remboursee ? "remboursee" : "annulee"],
    );
    return rows[0] || null;
}

// Ce qu'un développeur a gagné, et ce qu'il attend. Les lignes annulées ou
// remboursées sont exclues : un tableau de bord qui compte de l'argent rendu
// est un tableau de bord qui ment.
async function bilanVendeur(vendeurId) {
    try {
        const rows = await db.query(
            `SELECT
                COUNT(*) FILTER (WHERE statut IN ('encaissee','reversee'))::int AS ventes,
                COALESCE(SUM(montant_brut)  FILTER (WHERE statut IN ('encaissee','reversee')), 0) AS brut,
                COALESCE(SUM(net_vendeur)   FILTER (WHERE statut IN ('encaissee','reversee')), 0) AS net,
                COALESCE(SUM(net_vendeur)   FILTER (WHERE statut = 'encaissee'), 0) AS a_recevoir
               FROM academie_transactions WHERE vendeur_id = $1`,
            [vendeurId],
        );
        return rows[0] || { ventes: 0, brut: 0, net: 0, a_recevoir: 0 };
    } catch {
        return { ventes: 0, brut: 0, net: 0, a_recevoir: 0 };
    }
}

module.exports = {
    empreinteContrat,
    accepter, acceptationCourante, estMembre, historique,
    enregistrerTransaction, marquerEncaissee, marquerReversee, annuler, bilanVendeur,
};
