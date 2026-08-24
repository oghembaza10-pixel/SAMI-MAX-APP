// ==========================================================================
// SAMII OS — APPLICATIONS TIERCES
//
// Le passage d'une API à une plateforme tient dans une seule différence :
// aujourd'hui le marchand remet une clé à quelqu'un ; ici l'application
// déclare ce dont elle a besoin, le marchand approuve, et il reprend son
// accord quand il veut.
//
// Trois règles qui ne doivent pas bouger :
//
//   1. L'APPLICATION NE CHOISIT PAS SES DROITS. Elle demande ; c'est
//      l'approbation du marchand qui crée la clé, et la clé ne peut jamais
//      porter plus que ce qui a été demandé ET approuvé.
//
//   2. RÉVOQUER L'INSTALLATION RÉVOQUE LA CLÉ. Le marchand ne doit pas avoir
//      à comprendre ce qu'est une clé pour reprendre ce qu'il a donné : un
//      bouton, et l'accès meurt dans la seconde.
//
//   3. UNE INSTALLATION VAUT POUR UN SEUL ESPACE. Installer une application
//      chez un client n'ouvre rien chez les autres, même pour une agence qui
//      gère les deux.
// ==========================================================================
const crypto = require("crypto");
const db = require("./db");
const portees = require("./portees");
const apiPartenaire = require("./apiPartenaire");

const STATUTS = ["brouillon", "publiee", "suspendue"];

function slugifier(nom) {
    const base = String(nom || "app").toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "app";
    // Suffixe aléatoire : deux développeurs peuvent légitimement appeler leur
    // application « Relance clients », et le slug est public.
    return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

// ── CÔTÉ DÉVELOPPEUR ─────────────────────────────────────────────────────

async function creer(developpeurId, { nom, description, urlSite, webhookUrl, porteesDemandees }) {
    const titre = String(nom || "").trim();
    if (!titre) throw new Error("Donne un nom à ton application.");

    const demandees = portees.nettoyer(porteesDemandees);
    if (!demandees.length) throw new Error("Déclare au moins une permission demandée.");

    if (webhookUrl && !/^https:\/\/.+/i.test(webhookUrl)) {
        throw new Error("L'URL de webhook doit commencer par https://");
    }

    const rows = await db.query(
        `INSERT INTO apps (slug, developpeur_id, nom, description, url_site, webhook_url, portees_demandees)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [slugifier(titre), developpeurId, titre.slice(0, 80),
         String(description || "").slice(0, 400), urlSite || null, webhookUrl || null, demandees],
    );
    return rows[0];
}

function listerDuDeveloppeur(developpeurId) {
    return db.query(
        `SELECT a.*, (SELECT COUNT(*)::int FROM app_installations i
                       WHERE i.app_id = a.id AND i.actif) AS installations
           FROM apps a WHERE a.developpeur_id = $1 ORDER BY a.created_at DESC`,
        [developpeurId],
    );
}

function listerPubliees() {
    return db.query(`SELECT * FROM apps WHERE statut = 'publiee' ORDER BY nom`);
}

async function parSlug(slug) {
    const rows = await db.query(`SELECT * FROM apps WHERE slug = $1`, [String(slug || "")]);
    return rows[0] || null;
}

/**
 * Une application n'est installable que si elle est publiée — sauf par son
 * propre développeur, qui doit pouvoir l'essayer avant de la proposer.
 */
function installable(app, utilisateurId) {
    if (!app) return false;
    if (app.statut === "suspendue") return false;
    if (app.statut === "publiee") return true;
    return String(app.developpeur_id) === String(utilisateurId);
}

// ── CÔTÉ MARCHAND ────────────────────────────────────────────────────────

/**
 * Installe une application dans un espace et retourne la clé créée.
 *
 * La clé porte l'intersection de ce que l'application demande et de ce que le
 * marchand accorde : décocher une permission au moment d'installer doit
 * vraiment la retirer, sinon la case ne servirait qu'à rassurer.
 */
async function installer(app, workspaceId, porteesAccordees) {
    const demandees = portees.nettoyer(app.portees_demandees);
    const accordees = portees.nettoyer(porteesAccordees).filter(p => demandees.includes(p));
    if (!accordees.length) throw new Error("Accorde au moins une permission pour installer.");

    const deja = await db.query(
        `SELECT id FROM app_installations WHERE app_id = $1 AND workspace_id = $2 AND actif`,
        [app.id, workspaceId],
    );
    if (deja.length) throw new Error("Cette application est déjà installée sur cet espace.");

    // La clé est créée d'abord, et son identifiant sert à relier les deux
    // lignes : si la création échoue, aucune installation fantôme ne subsiste.
    const { cle, id: cleId } = await apiPartenaire.creerCleDetaillee(
        workspaceId, `App · ${app.nom}`, accordees,
    );

    const rows = await db.query(
        `INSERT INTO app_installations (app_id, workspace_id, portees_accordees, cle_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (app_id, workspace_id)
         DO UPDATE SET actif = TRUE, portees_accordees = EXCLUDED.portees_accordees,
                       cle_id = EXCLUDED.cle_id, installee_le = NOW(), revoquee_le = NULL
         RETURNING id`,
        [app.id, workspaceId, accordees, cleId],
    );
    const installationId = rows[0].id;

    await db.query(`UPDATE api_cles SET installation_id = $1 WHERE id = $2`,
        [installationId, cleId]);

    return { cle, installationId, accordees };
}

function listerInstallations(workspaceId) {
    return db.query(
        `SELECT i.id, i.portees_accordees, i.installee_le, i.actif,
                a.nom, a.slug, a.description, a.url_site
           FROM app_installations i JOIN apps a ON a.id = i.app_id
          WHERE i.workspace_id = $1 AND i.actif
          ORDER BY i.installee_le DESC`,
        [workspaceId],
    );
}

/**
 * Reprend l'accès accordé. La clé est révoquée dans la même opération : une
 * installation désactivée dont la clé fonctionnerait encore serait le pire
 * des deux mondes — le marchand croit avoir repris ce qu'il a donné.
 */
async function revoquer(workspaceId, installationId) {
    const rows = await db.query(
        `UPDATE app_installations SET actif = FALSE, revoquee_le = NOW()
          WHERE id = $1 AND workspace_id = $2 AND actif RETURNING cle_id`,
        [installationId, workspaceId],
    );
    if (!rows.length) return false;
    if (rows[0].cle_id) {
        await db.query(`UPDATE api_cles SET actif = FALSE WHERE id = $1`, [rows[0].cle_id]);
    }
    return true;
}

module.exports = {
    STATUTS,
    creer, listerDuDeveloppeur, listerPubliees, parSlug, installable,
    installer, listerInstallations, revoquer,
};
