// ==========================================================================
// SAMII OS — PRODUITS — catalogue réel proposé par Sami au client
// Point unique, réutilisé par les 3 canaux (Telegram, WhatsApp, Messenger/
// Instagram) : les trois avaient chacun leur propre copie de cette requête,
// et toutes les trois visaient une colonne `options` qui n'a jamais existé
// dans la table `produits` — chaque appel échouait silencieusement (attrapé
// par un catch vide) et renvoyait un catalogue vide, donc Sami répondait
// systématiquement "nous fonctionnons sur rendez-vous ou devis" même quand
// de vrais produits existaient. Corrigé en s'appuyant sur `produits_variantes`
// (déjà en base, jamais branchée nulle part) pour les tailles/couleurs.
// ==========================================================================
const db = require("./db");

async function getProduitsDuWorkspace(workspaceId) {
    try {
        const rows = await db.query(
            `SELECT p.id, p.nom, p.prix,
                    COALESCE(
                        json_agg(
                            json_build_object('taille', v.taille, 'couleur', v.couleur, 'stock', v.stock)
                            ORDER BY v.id
                        ) FILTER (WHERE v.id IS NOT NULL),
                        '[]'
                    ) AS variantes
             FROM produits p
             LEFT JOIN produits_variantes v ON v.produit_id = p.id
             WHERE p.workspace_id = $1 AND p.actif = true
             GROUP BY p.id, p.nom, p.prix
             ORDER BY p.nom`,
            [workspaceId]
        );
        return rows;
    } catch (err) {
        console.error("❌ produitsService.getProduitsDuWorkspace :", err.message);
        return [];
    }
}

module.exports = { getProduitsDuWorkspace };
